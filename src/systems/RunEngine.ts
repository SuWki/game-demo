import { BATTLE_TEMPLATES } from '../data/battleTemplates';
import { EVENT_CATALOG } from '../data/events';
import { buildNodeOptions, createOpeningBattleNode, getPhaseLabel } from '../data/nodes';
import { ROUTES, ROUTE_NAME_MAP } from '../data/routes';
import { UPGRADE_CATALOG } from '../data/upgrades';
import type {
  BattleState,
  EventDefinition,
  EventOption,
  NodeOption,
  PlayerStats,
  RouteId,
  RunOutcome,
  RunState,
  Services,
  UpgradeDefinition,
} from '../game/types';

interface EngineAnnouncement {
  kind: 'tip' | 'audio';
  text?: string;
  cue?: 'click' | 'upgrade' | 'hit' | 'crit' | 'pressure' | 'result';
}

const ARENA_WIDTH = 960;
const ARENA_HEIGHT = 540;
const CENTER_X = ARENA_WIDTH / 2;
const CENTER_Y = ARENA_HEIGHT / 2;

function createBaseStats(): PlayerStats {
  return {
    maxHp: 110,
    hp: 110,
    damage: 18,
    fireRate: 2.2,
    critChance: 0.08,
    critMultiplier: 1.7,
    pierce: 0,
    multishot: 1,
    moveSpeed: 1,
    dashInterval: 5.6,
    dashPulseDamage: 0,
    dashInvulnerability: 0.28,
    regeneration: 0,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export class RunEngine {
  private readonly services: Services;

  private readonly announcements: EngineAnnouncement[] = [];

  private firstUpgradeRecorded = false;

  private firstRouteHintRecorded = false;

  private readonly runStartedAtMs = performance.now();

  private readonly state: RunState;

  public constructor(services: Services) {
    this.services = services;
    const openingNode = createOpeningBattleNode();
    this.state = {
      status: 'battle',
      phase: 'opening',
      round: 0,
      totalRounds: 5,
      routeCounts: {
        crit: 0,
        pierce: 0,
        dash: 0,
      },
      committedRoute: null,
      maturedRoute: null,
      stats: createBaseStats(),
      selectedUpgrades: [],
      traversedNodes: [],
      battleWins: 0,
      nodeOptions: [],
      currentNode: openingNode,
      upgradeChoices: [],
      currentEvent: null,
      battle: null,
      result: null,
    };
    this.enterBattle(openingNode);
  }

  public getState(): Readonly<RunState> {
    return this.state;
  }

  public drainAnnouncements(): EngineAnnouncement[] {
    return this.announcements.splice(0, this.announcements.length);
  }

  public chooseNode(nodeId: string): void {
    const node = this.state.nodeOptions.find((candidate) => candidate.id === nodeId);
    if (!node) {
      return;
    }

    this.services.metrics.recordNodeSelected(node.type, node.title);
    this.state.currentNode = node;
    this.state.nodeOptions = [];
    this.state.traversedNodes.push({
      id: node.id,
      type: node.type,
      title: node.title,
    });
    this.state.phase = node.phase;
    this.enqueueTip(`${getPhaseLabel(node.phase)}：${node.title}`);

    if (node.type === 'battle') {
      this.enterBattle(node);
      return;
    }

    if (node.type === 'upgrade') {
      this.state.status = 'upgradeChoice';
      this.state.upgradeChoices = this.rollUpgradeChoices(Boolean(node.isFinalPrep));
      this.state.currentEvent = null;
      return;
    }

    this.state.status = 'eventChoice';
    this.state.currentEvent = this.rollEvent();
    this.state.upgradeChoices = [];
  }

  public chooseUpgrade(upgradeId: string): void {
    const upgrade = this.state.upgradeChoices.find((candidate) => candidate.id === upgradeId);
    if (!upgrade) {
      return;
    }

    this.applyModifiers(upgrade.modifiers);
    this.state.selectedUpgrades.push(upgrade.id);
    this.services.metrics.recordUpgradeSelected(upgrade.id, upgrade.routeId);
    if (!this.firstUpgradeRecorded) {
      this.services.metrics.markFirstUpgrade();
      this.firstUpgradeRecorded = true;
    }
    if (upgrade.routeId) {
      this.advanceRoute(upgrade.routeId);
    }

    this.enqueueAudio('upgrade');
    this.enqueueTip(`${upgrade.name} 已接入`);
    this.advanceRound();
  }

  public chooseEventOption(optionId: string): void {
    const eventDef = this.state.currentEvent;
    if (!eventDef) {
      return;
    }
    const option = eventDef.options.find((candidate) => candidate.id === optionId);
    if (!option) {
      return;
    }

    this.applyEventOption(option);
    this.services.metrics.recordEventSelected(eventDef.id, option.id, option.routeId);
    this.enqueueAudio('upgrade');
    this.enqueueTip(`${eventDef.name}：${option.label}`);
    this.advanceRound();
  }

  public tick(deltaMs: number): void {
    if (this.state.status !== 'battle' || !this.state.battle) {
      return;
    }

    const battle = this.state.battle;
    const dt = deltaMs / 1000;
    battle.elapsedSec += dt;
    battle.remainingSec = Math.max(0, battle.remainingSec - dt);

    this.updatePlayerMovement(battle, dt);
    this.spawnEnemies(battle, dt);
    this.updateShooting(battle, dt);
    this.updateBullets(battle, dt);
    this.updateEnemies(battle, dt);
    this.updatePulses(battle, dt);

    if (this.state.stats.regeneration > 0) {
      this.state.stats.hp = clamp(this.state.stats.hp + this.state.stats.regeneration * dt, 0, this.state.stats.maxHp);
    }

    if (this.state.stats.hp <= 0) {
      this.services.metrics.recordBattleCompleted(battle.templateId, 'loss');
      this.finishRun('defeat', '机体失稳，试飞提前结束。');
      return;
    }

    if (battle.templateId === 'elimination' && battle.kills >= battle.targetKills) {
      this.completeBattle();
      return;
    }

    if (battle.templateId === 'elite' && battle.eliteSpawned && !battle.eliteAlive) {
      this.completeBattle();
      return;
    }

    if (battle.templateId === 'survival' && battle.remainingSec <= 0) {
      this.completeBattle();
      return;
    }

    if (battle.remainingSec <= 0) {
      this.services.metrics.recordBattleCompleted(battle.templateId, 'loss');
      this.finishRun('defeat', '你没能顶住这一段的压力。');
    }
  }

  public getBattleLabel(): string {
    if (!this.state.battle) {
      return '';
    }
    const template = BATTLE_TEMPLATES[this.state.battle.templateId];
    if (template.id === 'survival') {
      return `${template.name} ${Math.ceil(this.state.battle.remainingSec)}s`;
    }
    if (template.id === 'elite') {
      return `${template.name} ${this.state.battle.eliteAlive ? '击破精英' : '准备交火'}`;
    }
    return `${template.name} ${this.state.battle.kills}/${this.state.battle.targetKills}`;
  }

  public getDominantRoute(): RouteId | null {
    const entries = Object.entries(this.state.routeCounts) as Array<[RouteId, number]>;
    const top = [...entries].sort((left, right) => right[1] - left[1])[0];
    return top && top[1] > 0 ? top[0] : null;
  }

  private enterBattle(node: NodeOption): void {
    const template = BATTLE_TEMPLATES[node.templateId ?? 'elimination'];
    this.state.status = 'battle';
    this.state.phase = node.phase;
    this.state.currentNode = node;
    this.state.currentEvent = null;
    this.state.upgradeChoices = [];
    this.state.battle = {
      templateId: template.id,
      label: template.name,
      description: template.description,
      durationSec: template.durationSec,
      remainingSec: template.durationSec,
      targetKills: template.targetKills,
      spawnIntervalSec: template.spawnIntervalSec,
      enemyHp: template.enemyHp,
      enemySpeed: template.enemySpeed,
      difficultyScale: node.difficultyScale ?? 1,
      kills: 0,
      elapsedSec: 0,
      nextEnemyId: 0,
      nextBulletId: 0,
      nextPulseId: 0,
      enemySpawnTimerSec: 0.1,
      fireCooldownSec: 0.1,
      dashCooldownSec: this.state.stats.dashInterval,
      invulnerableSec: 0,
      enemies: [],
      bullets: [],
      pulses: [],
      playerX: CENTER_X,
      playerY: CENTER_Y,
      eliteAlive: false,
      eliteSpawned: false,
    };
    this.enqueueTip(`${getPhaseLabel(node.phase)}进入：${template.name}`);
    this.enqueueAudio('pressure');
    this.services.metrics.recordBattleEntered(template.id, node.title);
  }

  private completeBattle(): void {
    const battle = this.state.battle;
    if (!battle) {
      return;
    }

    this.state.battleWins += 1;
    this.services.metrics.recordBattleCompleted(battle.templateId, 'win');
    this.enqueueTip(`${BATTLE_TEMPLATES[battle.templateId].name}完成`);
    this.advanceRound();
  }

  private advanceRound(): void {
    this.state.round += 1;
    if (this.state.round > this.state.totalRounds) {
      this.finishRun('victory', '你已完成这一轮试飞，整局流程可以顺利收尾。');
      return;
    }

    const focusRoute = this.getDominantRoute();
    const nextNodes = buildNodeOptions(this.state.round, focusRoute);
    if (nextNodes.length === 1) {
      this.state.nodeOptions = nextNodes;
      this.chooseNode(nextNodes[0].id);
      return;
    }

    this.state.phase = nextNodes[0]?.phase ?? this.state.phase;
    this.state.status = 'nodeChoice';
    this.state.nodeOptions = nextNodes;
    this.state.currentNode = null;
    this.state.currentEvent = null;
    this.state.upgradeChoices = [];
    this.state.battle = null;
  }

  private finishRun(outcome: RunOutcome, summary: string): void {
    const routeId = this.getDominantRoute();
    const runDurationSec = Number(((performance.now() - this.runStartedAtMs) / 1000).toFixed(2));
    this.state.status = 'result';
    this.state.phase = 'ended';
    this.state.nodeOptions = [];
    this.state.currentNode = null;
    this.state.currentEvent = null;
    this.state.upgradeChoices = [];
    this.state.battle = null;
    this.state.result = {
      outcome,
      summary,
      routeId,
      runDurationSec,
      nodesCleared: this.state.round,
      battleWins: this.state.battleWins,
    };
    this.services.metrics.finishRun(outcome, routeId, runDurationSec);
    this.enqueueAudio('result');
  }

  private rollUpgradeChoices(isFinalPrep: boolean): UpgradeDefinition[] {
    const dominantRoute = this.getDominantRoute();

    if (!dominantRoute) {
      return [
        UPGRADE_CATALOG.find((upgrade) => upgrade.id === 'crit-aim'),
        UPGRADE_CATALOG.find((upgrade) => upgrade.id === 'pierce-core'),
        UPGRADE_CATALOG.find((upgrade) => upgrade.id === 'dash-brush'),
      ].filter(Boolean) as UpgradeDefinition[];
    }

    const sameRoute = UPGRADE_CATALOG.filter(
      (upgrade) => upgrade.routeId === dominantRoute && !this.state.selectedUpgrades.includes(upgrade.id),
    );
    const offRoute = UPGRADE_CATALOG.filter(
      (upgrade) => upgrade.routeId && upgrade.routeId !== dominantRoute && !this.state.selectedUpgrades.includes(upgrade.id),
    );
    const generic = UPGRADE_CATALOG.filter(
      (upgrade) => !upgrade.routeId && !this.state.selectedUpgrades.includes(upgrade.id),
    );

    const pool: UpgradeDefinition[] = [];
    if (sameRoute.length > 0) {
      pool.push(pickRandom(sameRoute));
    }
    if (isFinalPrep && sameRoute.length > 1) {
      pool.push(sameRoute.find((upgrade) => upgrade.id !== pool[0].id) ?? pickRandom(sameRoute));
    } else if (offRoute.length > 0) {
      pool.push(pickRandom(offRoute));
    }
    if (generic.length > 0) {
      pool.push(pickRandom(generic));
    }

    return pool.slice(0, 3);
  }

  private rollEvent(): EventDefinition {
    const dominantRoute = this.getDominantRoute();
    const eventDef = pickRandom(EVENT_CATALOG);
    if (eventDef.id !== 'route-calibration' || !dominantRoute) {
      return eventDef;
    }

    return {
      ...eventDef,
      options: eventDef.options.map((option) =>
        option.id === 'route-calibration-focus'
          ? {
              ...option,
              routeId: dominantRoute,
            }
          : option,
      ),
    };
  }

  private applyEventOption(option: EventOption): void {
    if (option.modifiers) {
      this.applyModifiers(option.modifiers);
    }
    if (option.heal) {
      this.state.stats.hp = clamp(this.state.stats.hp + option.heal, 0, this.state.stats.maxHp);
    }
    if (option.routeId) {
      this.advanceRoute(option.routeId);
    }
  }

  private applyModifiers(modifiers: Partial<PlayerStats>): void {
    this.state.stats.maxHp += modifiers.maxHp ?? 0;
    this.state.stats.hp = clamp(this.state.stats.hp + (modifiers.maxHp ?? 0), 0, this.state.stats.maxHp);
    this.state.stats.damage += modifiers.damage ?? 0;
    this.state.stats.fireRate += modifiers.fireRate ?? 0;
    this.state.stats.critChance = clamp(this.state.stats.critChance + (modifiers.critChance ?? 0), 0, 0.85);
    this.state.stats.critMultiplier += modifiers.critMultiplier ?? 0;
    this.state.stats.pierce += modifiers.pierce ?? 0;
    this.state.stats.multishot += modifiers.multishot ?? 0;
    this.state.stats.moveSpeed += modifiers.moveSpeed ?? 0;
    this.state.stats.dashInterval = Math.max(1.8, this.state.stats.dashInterval + (modifiers.dashInterval ?? 0));
    this.state.stats.dashPulseDamage += modifiers.dashPulseDamage ?? 0;
    this.state.stats.dashInvulnerability += modifiers.dashInvulnerability ?? 0;
    this.state.stats.regeneration += modifiers.regeneration ?? 0;
  }

  private advanceRoute(routeId: RouteId): void {
    this.state.routeCounts[routeId] += 1;
    this.services.metrics.markRouteHint(routeId);

    if (!this.firstRouteHintRecorded) {
      this.firstRouteHintRecorded = true;
      this.services.metrics.markFirstRouteHint(routeId);
      this.enqueueTip(ROUTES.find((route) => route.id === routeId)?.shortHint ?? '');
    }

    const count = this.state.routeCounts[routeId];
    const otherCounts = Object.entries(this.state.routeCounts)
      .filter(([candidateRouteId]) => candidateRouteId !== routeId)
      .map(([, value]) => value);

    if (!this.state.committedRoute && count >= 2 && otherCounts.every((value) => count > value)) {
      this.state.committedRoute = routeId;
      this.services.metrics.markRouteCommitted(routeId);
      this.enqueueTip(`${ROUTE_NAME_MAP[routeId]}路线开始站稳`);
    }

    if (!this.state.maturedRoute && count >= 3) {
      this.state.maturedRoute = routeId;
      this.services.metrics.markRouteMatured(routeId);
      this.enqueueTip(ROUTES.find((route) => route.id === routeId)?.matureHint ?? '');
    }
  }

  private updatePlayerMovement(battle: BattleState, dt: number): void {
    const swingSpeed = 1.2 + this.state.stats.moveSpeed * 0.025;
    const radius = 28 + this.state.stats.moveSpeed * 0.7;
    const angle = battle.elapsedSec * swingSpeed;
    battle.playerX = CENTER_X + Math.cos(angle) * radius;
    battle.playerY = CENTER_Y + Math.sin(angle * 1.4) * radius * 0.72;

    battle.invulnerableSec = Math.max(0, battle.invulnerableSec - dt);
    battle.dashCooldownSec -= dt;
    if (this.state.stats.dashPulseDamage > 0 && battle.dashCooldownSec <= 0) {
      battle.dashCooldownSec = this.state.stats.dashInterval;
      battle.invulnerableSec = this.state.stats.dashInvulnerability;
      battle.pulses.push({
        id: battle.nextPulseId++,
        x: battle.playerX,
        y: battle.playerY,
        radius: 76,
        lifeSec: 0.28,
      });

      for (const enemy of battle.enemies) {
        const distance = Math.hypot(enemy.x - battle.playerX, enemy.y - battle.playerY);
        if (distance <= 76) {
          enemy.hp -= this.state.stats.dashPulseDamage;
        }
      }
    }
  }

  private spawnEnemies(battle: BattleState, dt: number): void {
    battle.enemySpawnTimerSec -= dt;
    if (battle.templateId === 'elite' && !battle.eliteSpawned && battle.elapsedSec >= 4) {
      battle.eliteSpawned = true;
      battle.eliteAlive = true;
      battle.enemies.push({
        id: battle.nextEnemyId++,
        x: CENTER_X,
        y: -60,
        hp: battle.enemyHp * battle.difficultyScale * 10,
        maxHp: battle.enemyHp * battle.difficultyScale * 10,
        speed: battle.enemySpeed * 0.85,
        radius: 22,
        elite: true,
      });
      this.enqueueTip('精英进入战场');
      this.enqueueAudio('pressure');
    }

    while (battle.enemySpawnTimerSec <= 0) {
      battle.enemySpawnTimerSec += battle.spawnIntervalSec / battle.difficultyScale;
      if (battle.templateId === 'elite' && battle.enemies.filter((enemy) => !enemy.elite).length >= 10) {
        break;
      }

      const edge = Math.floor(Math.random() * 4);
      const position = { x: 0, y: 0 };
      if (edge === 0) {
        position.x = Math.random() * ARENA_WIDTH;
        position.y = -20;
      } else if (edge === 1) {
        position.x = ARENA_WIDTH + 20;
        position.y = Math.random() * ARENA_HEIGHT;
      } else if (edge === 2) {
        position.x = Math.random() * ARENA_WIDTH;
        position.y = ARENA_HEIGHT + 20;
      } else {
        position.x = -20;
        position.y = Math.random() * ARENA_HEIGHT;
      }

      battle.enemies.push({
        id: battle.nextEnemyId++,
        x: position.x,
        y: position.y,
        hp: battle.enemyHp * battle.difficultyScale,
        maxHp: battle.enemyHp * battle.difficultyScale,
        speed: battle.enemySpeed * battle.difficultyScale,
        radius: 10 + Math.random() * 4,
        elite: false,
      });
    }
  }

  private updateShooting(battle: BattleState, dt: number): void {
    battle.fireCooldownSec -= dt;
    if (battle.fireCooldownSec > 0) {
      return;
    }

    battle.fireCooldownSec = 1 / this.state.stats.fireRate;
    const target = battle.enemies[0];
    const baseAngle = target
      ? Math.atan2(target.y - battle.playerY, target.x - battle.playerX)
      : -Math.PI / 2;
    const shotCount = Math.max(1, this.state.stats.multishot);
    const spreadCenter = (shotCount - 1) / 2;

    for (let index = 0; index < shotCount; index += 1) {
      const offset = (index - spreadCenter) * 0.18;
      const angle = baseAngle + offset;
      battle.bullets.push({
        id: battle.nextBulletId++,
        x: battle.playerX,
        y: battle.playerY,
        vx: Math.cos(angle) * 360,
        vy: Math.sin(angle) * 360,
        damage: this.state.stats.damage,
        lifeSec: 1.8,
        pierceRemaining: this.state.stats.pierce,
      });
    }
  }

  private updateBullets(battle: BattleState, dt: number): void {
    const nextBullets = [];
    for (const bullet of battle.bullets) {
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.lifeSec -= dt;
      let bulletActive = bullet.lifeSec > 0;

      for (const enemy of battle.enemies) {
        if (!bulletActive) {
          break;
        }
        const distance = Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y);
        if (distance > enemy.radius + 4) {
          continue;
        }

        const critical = Math.random() < this.state.stats.critChance;
        const damage = critical ? bullet.damage * this.state.stats.critMultiplier : bullet.damage;
        enemy.hp -= damage;
        this.enqueueAudio(critical ? 'crit' : 'hit');
        if (critical) {
          this.enqueueTip('暴击命中');
        }

        if (bullet.pierceRemaining > 0) {
          bullet.pierceRemaining -= 1;
        } else {
          bulletActive = false;
        }
      }

      if (bulletActive) {
        nextBullets.push(bullet);
      }
    }
    battle.bullets = nextBullets.filter(
      (bullet) =>
        bullet.x >= -40 &&
        bullet.x <= ARENA_WIDTH + 40 &&
        bullet.y >= -40 &&
        bullet.y <= ARENA_HEIGHT + 40 &&
        bullet.lifeSec > 0,
    );
  }

  private updateEnemies(battle: BattleState, dt: number): void {
    const survivors = [];
    for (const enemy of battle.enemies) {
      if (enemy.hp <= 0) {
        battle.kills += 1;
        if (enemy.elite) {
          battle.eliteAlive = false;
        }
        continue;
      }

      const angle = Math.atan2(battle.playerY - enemy.y, battle.playerX - enemy.x);
      enemy.x += Math.cos(angle) * enemy.speed * dt;
      enemy.y += Math.sin(angle) * enemy.speed * dt;

      const distance = Math.hypot(enemy.x - battle.playerX, enemy.y - battle.playerY);
      if (distance <= enemy.radius + 12) {
        if (battle.invulnerableSec <= 0) {
          const damage = enemy.elite ? 18 : 8;
          this.state.stats.hp = clamp(this.state.stats.hp - damage, 0, this.state.stats.maxHp);
          battle.invulnerableSec = 0.35;
          this.enqueueAudio('pressure');
        }
        continue;
      }

      survivors.push(enemy);
    }
    battle.enemies = survivors;
  }

  private updatePulses(battle: BattleState, dt: number): void {
    for (const pulse of battle.pulses) {
      pulse.lifeSec -= dt;
      pulse.radius += 120 * dt;
    }
    battle.pulses = battle.pulses.filter((pulse) => pulse.lifeSec > 0);
  }

  private enqueueTip(text: string): void {
    if (!text) {
      return;
    }
    this.announcements.push({
      kind: 'tip',
      text,
    });
  }

  private enqueueAudio(cue: EngineAnnouncement['cue']): void {
    this.announcements.push({
      kind: 'audio',
      cue,
    });
  }
}
