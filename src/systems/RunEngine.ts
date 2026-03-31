import {
  BATTLE_TEMPLATES,
  getBattleProgressText,
  getBattleTargetKills,
  getRegularEnemyCap,
  isBattleVictory,
  shouldSpawnElite,
} from '../data/battleTemplates';
import { rollEventDefinition, rollUpgradeChoices } from '../data/contentSelectors';
import { buildNodeOptions, createOpeningBattleNode, getPhaseLabel } from '../data/nodes';
import { ROUTES, ROUTE_NAME_MAP } from '../data/routes';
import type {
  BattleState,
  ContentEffect,
  EventDefinition,
  NodeOption,
  PlayerStats,
  RouteId,
  RunOutcome,
  RunState,
  Services,
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

export class RunEngine {
  private readonly services: Services;

  private readonly announcements: EngineAnnouncement[] = [];

  private readonly routeMomentShown: Record<RouteId, boolean> = {
    crit: false,
    pierce: false,
    dash: false,
  };

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

    this.applyEffects(upgrade.effects);
    this.state.selectedUpgrades.push(upgrade.id);
    this.services.metrics.recordUpgradeSelected(upgrade.id, upgrade.routeId);
    if (!this.firstUpgradeRecorded) {
      this.services.metrics.markFirstUpgrade();
      this.firstUpgradeRecorded = true;
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

    const optionRouteId = option.routeId === 'dominant' ? this.getDominantRoute() ?? undefined : option.routeId;
    this.applyEffects(option.effects ?? []);
    this.services.metrics.recordEventSelected(eventDef.id, option.id, optionRouteId);
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
    battle.critOverdriveSec = Math.max(0, battle.critOverdriveSec - dt);
    battle.dashDriveSec = Math.max(0, battle.dashDriveSec - dt);

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

    if (isBattleVictory(battle)) {
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
    return getBattleProgressText(this.state.battle);
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
      targetKills: getBattleTargetKills(template.id),
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
      critOverdriveSec: 0,
      critChain: 0,
      dashCharge: 0,
      dashDriveSec: 0,
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

  private rollUpgradeChoices(isFinalPrep: boolean) {
    return rollUpgradeChoices(this.state, isFinalPrep);
  }

  private rollEvent(): EventDefinition {
    return rollEventDefinition(this.state);
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

  private applyEffects(effects: ContentEffect[]): void {
    for (const effect of effects) {
      if (effect.type === 'stats') {
        this.applyModifiers(effect.modifiers);
        continue;
      }

      if (effect.type === 'heal') {
        this.state.stats.hp = clamp(this.state.stats.hp + effect.amount, 0, this.state.stats.maxHp);
        continue;
      }

      const routeId = effect.routeId === 'dominant' ? this.getDominantRoute() : effect.routeId;
      if (routeId) {
        this.advanceRoute(routeId);
      }
    }
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
      const dashCharge = battle.dashCharge;
      const dashRank = this.state.routeCounts.dash;
      const pulseRadius = 76 + dashCharge * (this.state.maturedRoute === 'dash' ? 10 : 6);
      const pulseDamage =
        this.state.stats.dashPulseDamage +
        dashCharge * (this.state.committedRoute === 'dash' ? 4 : 2) +
        (this.state.maturedRoute === 'dash' ? 8 : 0);

      battle.dashCooldownSec = Math.max(
        1.6,
        this.state.stats.dashInterval - (this.state.committedRoute === 'dash' ? 0.2 : 0),
      );
      battle.invulnerableSec =
        this.state.stats.dashInvulnerability + (this.state.maturedRoute === 'dash' ? 0.12 : 0);
      battle.dashDriveSec = Math.max(
        battle.dashDriveSec,
        (dashRank > 0 ? 0.9 : 0.4) + dashCharge * 0.18,
      );
      battle.pulses.push({
        id: battle.nextPulseId++,
        x: battle.playerX,
        y: battle.playerY,
        radius: pulseRadius,
        lifeSec: 0.28,
      });

      for (const enemy of battle.enemies) {
        const distance = Math.hypot(enemy.x - battle.playerX, enemy.y - battle.playerY);
        if (distance <= pulseRadius) {
          enemy.hp -= pulseDamage;
          if (this.state.routeCounts.dash > 0) {
            const angle = Math.atan2(enemy.y - battle.playerY, enemy.x - battle.playerX);
            const knockback = (this.state.committedRoute === 'dash' ? 34 : 18) + dashCharge * 5;
            enemy.x += Math.cos(angle) * knockback;
            enemy.y += Math.sin(angle) * knockback;
          }
        }
      }

      if (dashRank > 0) {
        this.state.stats.hp = clamp(
          this.state.stats.hp +
            dashCharge * (this.state.committedRoute === 'dash' ? 1.4 : 0.7) +
            (this.state.maturedRoute === 'dash' ? 2 : 0),
          0,
          this.state.stats.maxHp,
        );
      }

      if (dashCharge >= 2 && !this.routeMomentShown.dash) {
        this.routeMomentShown.dash = true;
        this.enqueueTip('穿梭节奏开始接上了');
      }

      battle.dashCharge = 0;
    }
  }

  private spawnEnemies(battle: BattleState, dt: number): void {
    battle.enemySpawnTimerSec -= dt;
    if (shouldSpawnElite(battle)) {
      const template = BATTLE_TEMPLATES[battle.templateId];
      const eliteRule = template.eliteRule;
      if (!eliteRule) {
        return;
      }
      battle.eliteSpawned = true;
      battle.eliteAlive = true;
      battle.enemies.push({
        id: battle.nextEnemyId++,
        x: CENTER_X,
        y: -60,
        hp: battle.enemyHp * battle.difficultyScale * eliteRule.hpMultiplier,
        maxHp: battle.enemyHp * battle.difficultyScale * eliteRule.hpMultiplier,
        speed: battle.enemySpeed * eliteRule.speedMultiplier,
        radius: eliteRule.radius,
        elite: true,
        grazeCooldownSec: 0,
      });
      this.enqueueTip('精英进入战场');
      this.enqueueAudio('pressure');
    }

    while (battle.enemySpawnTimerSec <= 0) {
      battle.enemySpawnTimerSec += battle.spawnIntervalSec / battle.difficultyScale;
      const regularEnemyCap = getRegularEnemyCap(battle.templateId);
      if (regularEnemyCap !== null && battle.enemies.filter((enemy) => !enemy.elite).length >= regularEnemyCap) {
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
        grazeCooldownSec: 0,
      });
    }
  }

  private updateShooting(battle: BattleState, dt: number): void {
    battle.fireCooldownSec -= dt;
    if (battle.fireCooldownSec > 0) {
      return;
    }

    const effectiveFireRate = this.getEffectiveFireRate(battle);
    battle.fireCooldownSec = 1 / effectiveFireRate;
    const target = battle.enemies[0];
    const baseAngle = target
      ? Math.atan2(target.y - battle.playerY, target.x - battle.playerX)
      : -Math.PI / 2;
    let shotCount = Math.max(1, this.state.stats.multishot);
    if (battle.critOverdriveSec > 0 && this.state.committedRoute === 'crit') {
      shotCount += 1;
    }
    if (battle.dashDriveSec > 0 && this.state.maturedRoute === 'dash') {
      shotCount += 1;
    }
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
        canEcho: this.state.routeCounts.pierce > 0,
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

        const critical = Math.random() < this.getEffectiveCritChance(battle);
        const damage = critical ? bullet.damage * this.state.stats.critMultiplier : bullet.damage;
        enemy.hp -= damage;
        this.enqueueAudio(critical ? 'crit' : 'hit');
        if (critical) {
          battle.critOverdriveSec = Math.min(
            4.2,
            battle.critOverdriveSec + 0.45 + (this.state.committedRoute === 'crit' ? 0.25 : 0),
          );
          battle.critChain += 1;
          this.enqueueTip('暴击命中');
          if (battle.critChain >= 2 && !this.routeMomentShown.crit) {
            this.routeMomentShown.crit = true;
            this.enqueueTip('暴击节奏开始升温');
          }
        } else if (battle.critChain > 0) {
          battle.critChain = Math.max(0, battle.critChain - 1);
        }

        this.trySpawnPierceEchoShots(battle, bullet, enemy);

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
      enemy.grazeCooldownSec = Math.max(0, enemy.grazeCooldownSec - dt);
      if (enemy.hp <= 0) {
        battle.kills += 1;
        this.handleEnemyDefeated(battle, enemy);
        if (enemy.elite) {
          battle.eliteAlive = false;
        }
        continue;
      }

      const angle = Math.atan2(battle.playerY - enemy.y, battle.playerX - enemy.x);
      enemy.x += Math.cos(angle) * enemy.speed * dt;
      enemy.y += Math.sin(angle) * enemy.speed * dt;

      const distance = Math.hypot(enemy.x - battle.playerX, enemy.y - battle.playerY);
      if (
        this.state.routeCounts.dash > 0 &&
        enemy.grazeCooldownSec <= 0 &&
        distance <= enemy.radius + 68 &&
        distance > enemy.radius + 18
      ) {
        enemy.grazeCooldownSec = 0.8;
        battle.dashCharge = Math.min(6, battle.dashCharge + 1);
        if (this.state.committedRoute === 'dash') {
          battle.dashDriveSec = Math.max(battle.dashDriveSec, 0.7);
          battle.dashCooldownSec = Math.max(0.75, battle.dashCooldownSec - 0.35);
          this.state.stats.hp = clamp(this.state.stats.hp + 0.9, 0, this.state.stats.maxHp);
        }
      }

      if (distance <= enemy.radius + 12) {
        if (battle.invulnerableSec <= 0) {
          let damage = enemy.elite ? 18 : 8;
          if (this.state.routeCounts.dash > 0 && battle.dashDriveSec > 0) {
            damage *= this.state.maturedRoute === 'dash' ? 0.55 : 0.72;
          }
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

  private getEffectiveFireRate(battle: BattleState): number {
    let fireRate = this.state.stats.fireRate;

    if (battle.critOverdriveSec > 0) {
      fireRate += 0.4 + this.state.routeCounts.crit * 0.12;
      if (this.state.maturedRoute === 'crit') {
        fireRate += 0.25;
      }
    }

    if (battle.dashDriveSec > 0) {
      fireRate += 0.35 + this.state.routeCounts.dash * 0.1;
    }

    return fireRate;
  }

  private getEffectiveCritChance(battle: BattleState): number {
    let critChance = this.state.stats.critChance;

    if (battle.critOverdriveSec > 0) {
      critChance += 0.08;
      if (this.state.committedRoute === 'crit') {
        critChance += 0.08;
      }
      if (this.state.maturedRoute === 'crit') {
        critChance += 0.08;
      }
    }

    return clamp(critChance, 0, 0.95);
  }

  private trySpawnPierceEchoShots(battle: BattleState, bullet: BattleState['bullets'][number], currentEnemy: BattleState['enemies'][number]): void {
    if (!bullet.canEcho || this.state.routeCounts.pierce <= 0) {
      return;
    }

    const nearbyTargets = battle.enemies
      .filter((enemy) => enemy.id !== currentEnemy.id && enemy.hp > 0)
      .sort(
        (left, right) =>
          Math.hypot(left.x - currentEnemy.x, left.y - currentEnemy.y) -
          Math.hypot(right.x - currentEnemy.x, right.y - currentEnemy.y),
      );

    if (nearbyTargets.length === 0) {
      return;
    }

    let echoCount = 1;
    if (this.state.stats.multishot > 1) {
      echoCount += 1;
    }
    if (this.state.maturedRoute === 'pierce') {
      echoCount += 1;
    }

    const echoTargets = nearbyTargets.slice(0, echoCount);
    for (const target of echoTargets) {
      const angle = Math.atan2(target.y - currentEnemy.y, target.x - currentEnemy.x);
      battle.bullets.push({
        id: battle.nextBulletId++,
        x: currentEnemy.x,
        y: currentEnemy.y,
        vx: Math.cos(angle) * 320,
        vy: Math.sin(angle) * 320,
        damage: bullet.damage * (this.state.committedRoute === 'pierce' ? 0.72 : 0.58),
        lifeSec: 0.75,
        pierceRemaining: Math.max(0, this.state.stats.pierce - 1),
        canEcho: false,
      });
    }

    bullet.canEcho = false;
    if (!this.routeMomentShown.pierce) {
      this.routeMomentShown.pierce = true;
      this.enqueueTip('穿透火力开始扇裂');
    }
  }

  private handleEnemyDefeated(battle: BattleState, enemy: BattleState['enemies'][number]): void {
    if (this.state.maturedRoute === 'crit' && battle.critOverdriveSec > 0) {
      for (const target of battle.enemies) {
        if (target.id === enemy.id || target.hp <= 0) {
          continue;
        }
        const distance = Math.hypot(target.x - enemy.x, target.y - enemy.y);
        if (distance <= 72) {
          target.hp -= this.state.stats.damage * 0.45;
        }
      }
    }

    if (this.state.committedRoute === 'pierce') {
      battle.fireCooldownSec = Math.max(0.04, battle.fireCooldownSec - 0.06);
    }

    if (this.state.routeCounts.dash > 0) {
      battle.dashDriveSec = Math.max(battle.dashDriveSec, 0.35);
      if (this.state.committedRoute === 'dash') {
        this.state.stats.hp = clamp(this.state.stats.hp + 2, 0, this.state.stats.maxHp);
      }
    }
  }
}
