import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  PLAYER_COLLISION_RADIUS,
  clamp,
  createBaseStats,
  getBattleCompletionExperience,
  getExperienceToNextLevel,
} from '../data/balance';
import {
  BATTLE_TEMPLATES,
  getBattleProgressText,
  getBattleTargetKills,
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
  PlayerInputState,
  PlayerStats,
  RouteBuildStage,
  RouteId,
  RunEndingKind,
  RunOutcome,
  RunState,
  Services,
  UpgradeSource,
} from '../game/types';

interface EngineAnnouncement {
  kind: 'tip' | 'audio';
  text?: string;
  cue?: 'click' | 'upgrade' | 'hit' | 'crit' | 'pressure' | 'result';
}

const CENTER_X = ARENA_WIDTH / 2;
const CENTER_Y = ARENA_HEIGHT / 2;

function getBuildStageLabel(buildStage: RouteBuildStage): string {
  switch (buildStage) {
    case 'hinted':
      return '已出倾向';
    case 'committed':
      return '开始站稳';
    case 'matured':
      return '已经成型';
    default:
      return '未站稳';
  }
}

function getEndingLabel(endingKind: RunEndingKind): string {
  switch (endingKind) {
    case 'hpDepleted':
      return '耐久归零';
    case 'timeOut':
      return '压力失守';
    default:
      return '完成试飞';
  }
}

export class RunEngine {
  private readonly services: Services;

  private readonly announcements: EngineAnnouncement[] = [];

  private readonly routeMomentShown: Record<RouteId, boolean> = {
    crit: false,
    pierce: false,
    dash: false,
  };

  private readonly runStartedAtMs = performance.now();

  private readonly state: RunState;

  private readonly inputState: PlayerInputState = {
    up: false,
    down: false,
    left: false,
    right: false,
  };

  private firstUpgradeRecorded = false;

  private firstRouteHintRecorded = false;

  private advanceAfterPendingUpgrades = false;

  public constructor(services: Services) {
    this.services = services;
    const openingNode = createOpeningBattleNode();
    this.state = {
      status: 'battle',
      phase: 'opening',
      round: 0,
      totalRounds: 5,
      level: 1,
      experience: 0,
      experienceToNext: getExperienceToNextLevel(1),
      queuedLevelUps: 0,
      upgradeSource: null,
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

  public setInputState(nextInput: PlayerInputState): void {
    this.inputState.up = nextInput.up;
    this.inputState.down = nextInput.down;
    this.inputState.left = nextInput.left;
    this.inputState.right = nextInput.right;
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
      this.state.upgradeSource = 'nodePrep';
      this.state.upgradeChoices = this.rollUpgradeChoices('nodePrep');
      this.state.currentEvent = null;
      return;
    }

    this.state.status = 'eventChoice';
    this.state.currentEvent = this.rollEvent();
    this.state.upgradeSource = null;
    this.state.upgradeChoices = [];
  }

  public chooseUpgrade(upgradeId: string): void {
    const upgrade = this.state.upgradeChoices.find((candidate) => candidate.id === upgradeId);
    if (!upgrade) {
      return;
    }

    const source = this.state.upgradeSource;
    this.applyEffects(upgrade.effects);
    if (upgrade.repeatable || !this.state.selectedUpgrades.includes(upgrade.sourceId)) {
      this.state.selectedUpgrades.push(upgrade.sourceId);
    }
    this.services.metrics.recordUpgradeSelected(`${upgrade.sourceId}:${upgrade.rarity}`, upgrade.routeId);
    if (!this.firstUpgradeRecorded) {
      this.services.metrics.markFirstUpgrade();
      this.firstUpgradeRecorded = true;
    }

    this.enqueueAudio('upgrade');
    this.enqueueTip(`${upgrade.rarityLabel}品 ${upgrade.name}`);

    this.state.upgradeChoices = [];
    this.state.upgradeSource = null;

    if (source === 'levelUp') {
      this.state.queuedLevelUps = Math.max(0, this.state.queuedLevelUps - 1);
      if (this.state.queuedLevelUps > 0) {
        this.openQueuedLevelUpPanel();
        return;
      }

      if (this.advanceAfterPendingUpgrades) {
        this.advanceAfterPendingUpgrades = false;
        this.advanceRound();
        return;
      }

      this.state.status = 'battle';
      return;
    }

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
    battle.invulnerableSec = Math.max(0, battle.invulnerableSec - dt);

    this.updatePlayerMovement(battle, dt);
    this.spawnEnemies(battle, dt);
    this.updateShooting(battle, dt);
    this.updateBullets(battle, dt);
    this.updateEnemies(battle, dt);
    this.updatePulses(battle, dt);
    this.updateExperienceOrbs(battle, dt);

    if (this.state.stats.regeneration > 0) {
      this.state.stats.hp = clamp(this.state.stats.hp + this.state.stats.regeneration * dt, 0, this.state.stats.maxHp);
    }

    if (this.state.stats.hp <= 0) {
      this.services.metrics.recordBattleCompleted(battle.templateId, 'loss');
      this.finishRun('defeat', 'hpDepleted');
      return;
    }

    if (isBattleVictory(battle)) {
      this.completeBattle();
      return;
    }

    if (battle.remainingSec <= 0) {
      this.services.metrics.recordBattleCompleted(battle.templateId, 'loss');
      this.finishRun('defeat', 'timeOut');
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

  private getResultRoute(): RouteId | null {
    return this.state.maturedRoute ?? this.state.committedRoute ?? this.getDominantRoute();
  }

  private getCurrentBattleIndex(): number {
    return Math.max(1, this.state.round + 1);
  }

  private getRouteBuildStage(routeId: RouteId): RouteBuildStage {
    if (this.state.maturedRoute === routeId) {
      return 'matured';
    }
    if (this.state.committedRoute === routeId) {
      return 'committed';
    }
    if (this.state.routeCounts[routeId] > 0) {
      return 'hinted';
    }
    return 'unformed';
  }

  private rollUpgradeChoices(source: UpgradeSource) {
    return rollUpgradeChoices(this.state, source);
  }

  private rollEvent(): EventDefinition {
    return rollEventDefinition(this.state);
  }

  private enterBattle(node: NodeOption): void {
    const template = BATTLE_TEMPLATES[node.templateId ?? 'elimination'];
    const battleIndex = this.getCurrentBattleIndex();

    this.state.status = 'battle';
    this.state.phase = node.phase;
    this.state.currentNode = node;
    this.state.currentEvent = null;
    this.state.upgradeChoices = [];
    this.state.upgradeSource = null;
    this.state.battle = {
      templateId: template.id,
      label: template.name,
      description: template.description,
      durationSec: template.durationSec,
      remainingSec: template.durationSec,
      targetKills: getBattleTargetKills(template.id),
      spawnIntervalSec: template.spawnIntervalSec,
      enemyHp: 0,
      enemySpeed: 0,
      difficultyScale: node.difficultyScale ?? 1,
      kills: 0,
      elapsedSec: 0,
      nextEnemyId: 0,
      nextBulletId: 0,
      nextPulseId: 0,
      enemySpawnTimerSec: 0.2,
      fireCooldownSec: 0.1,
      dashCooldownSec: this.state.stats.dashInterval,
      invulnerableSec: 0,
      enemies: [],
      bullets: [],
      pulses: [],
      experienceOrbs: [],
      playerX: CENTER_X,
      playerY: CENTER_Y,
      eliteAlive: false,
      eliteSpawned: false,
      critOverdriveSec: 0,
      critChain: 0,
      dashCharge: 0,
      dashDriveSec: 0,
    };
    this.state.battle.enemyHp = this.getRegularEnemyHp(template, battleIndex, node.phase, this.state.battle.difficultyScale);
    this.state.battle.enemySpeed = this.getRegularEnemySpeed(template, battleIndex, node.phase, this.state.battle.difficultyScale);
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
    const completionExp = getBattleCompletionExperience(
      BATTLE_TEMPLATES[battle.templateId],
      this.getCurrentBattleIndex(),
      this.state.phase,
    );
    this.enqueueTip(`${BATTLE_TEMPLATES[battle.templateId].name}完成`);
    this.gainExperience(completionExp);

    if (this.state.queuedLevelUps > 0 && this.state.status === 'upgradeChoice') {
      this.advanceAfterPendingUpgrades = true;
      return;
    }

    this.advanceRound();
  }

  private advanceRound(): void {
    this.state.round += 1;
    if (this.state.round > this.state.totalRounds) {
      this.finishRun('victory', 'victory');
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
    this.state.upgradeSource = null;
    this.state.battle = null;
  }

  private finishRun(outcome: RunOutcome, endingKind: RunEndingKind): void {
    const routeId = this.getResultRoute();
    const buildStage = this.getBuildStage();
    const buildLabel = getBuildStageLabel(buildStage);
    const buildSummary = this.getBuildSummary(routeId, buildStage);
    const endingLabel = getEndingLabel(endingKind);
    const finalNodeTitle = this.state.currentNode?.title ?? getPhaseLabel(this.state.phase);
    const endingReason = this.getEndingReason(endingKind, finalNodeTitle);
    const summary = this.getResultSummary(outcome, routeId, buildStage);
    const runDurationSec = Number(((performance.now() - this.runStartedAtMs) / 1000).toFixed(2));
    const nodesCleared = Math.min(this.state.round, this.state.totalRounds);
    this.state.status = 'result';
    this.state.phase = 'ended';
    this.state.nodeOptions = [];
    this.state.currentNode = null;
    this.state.currentEvent = null;
    this.state.upgradeChoices = [];
    this.state.upgradeSource = null;
    this.state.battle = null;
    this.state.result = {
      outcome,
      summary,
      routeId,
      buildStage,
      buildLabel,
      buildSummary,
      endingKind,
      endingLabel,
      endingReason,
      finalNodeTitle,
      runDurationSec,
      nodesCleared,
      battleWins: this.state.battleWins,
      levelReached: this.state.level,
    };
    this.services.metrics.finishRun({
      outcome,
      routeId,
      durationSec: runDurationSec,
      buildStage,
      buildSummary,
      endingKind,
      endingReason,
      finalNodeTitle,
      battleWins: this.state.battleWins,
      nodesCleared,
    });
    this.enqueueAudio('result');
  }

  private getBuildStage(): RouteBuildStage {
    if (this.state.maturedRoute) {
      return 'matured';
    }
    if (this.state.committedRoute) {
      return 'committed';
    }
    if (this.getDominantRoute()) {
      return 'hinted';
    }
    return 'unformed';
  }

  private getBuildSummary(routeId: RouteId | null, buildStage: RouteBuildStage): string {
    if (!routeId) {
      return '本局还没有站稳主路线';
    }

    const routeName = ROUTE_NAME_MAP[routeId];
    switch (buildStage) {
      case 'matured':
        return `${routeName}路线已经成型`;
      case 'committed':
        return `${routeName}路线已经开始站稳`;
      case 'hinted':
        return `${routeName}倾向已经出现`;
      default:
        return '本局还没有站稳主路线';
    }
  }

  private getEndingReason(endingKind: RunEndingKind, finalNodeTitle: string): string {
    switch (endingKind) {
      case 'hpDepleted':
        return `${finalNodeTitle}阶段中机体耐久归零`;
      case 'timeOut':
        return `${finalNodeTitle}阶段的压力没能顶住`;
      default:
        return `${finalNodeTitle}已完成收束`;
    }
  }

  private getResultSummary(outcome: RunOutcome, routeId: RouteId | null, buildStage: RouteBuildStage): string {
    if (!routeId) {
      return outcome === 'victory' ? '这轮试飞已经顺利收束。' : '这局还没站稳路线，就先被打断了。';
    }

    const routeName = ROUTE_NAME_MAP[routeId];
    if (outcome === 'victory') {
      if (buildStage === 'matured') {
        return `${routeName}路线已经完整撑到了收尾。`;
      }
      if (buildStage === 'committed') {
        return `${routeName}路线已经站稳，并顺利撑到了收尾。`;
      }
      return `${routeName}路线把这轮试飞带到了收尾。`;
    }

    if (buildStage === 'matured' || buildStage === 'committed') {
      return `${routeName}路线已经起势，但这局还是在收尾前被打断了。`;
    }
    return `${routeName}路线刚露出倾向，这局就先被打断了。`;
  }

  private applyModifiers(modifiers: Partial<PlayerStats>): void {
    this.state.stats.maxHp += modifiers.maxHp ?? 0;
    this.state.stats.hp = clamp(this.state.stats.hp + (modifiers.maxHp ?? 0), 0, this.state.stats.maxHp);
    this.state.stats.damage += modifiers.damage ?? 0;
    this.state.stats.fireRate += modifiers.fireRate ?? 0;
    this.state.stats.projectileSpeed += modifiers.projectileSpeed ?? 0;
    this.state.stats.critChance = clamp(this.state.stats.critChance + (modifiers.critChance ?? 0), 0, 0.85);
    this.state.stats.critMultiplier += modifiers.critMultiplier ?? 0;
    this.state.stats.pierce += modifiers.pierce ?? 0;
    this.state.stats.multishot += modifiers.multishot ?? 0;
    this.state.stats.moveSpeed += modifiers.moveSpeed ?? 0;
    this.state.stats.dashInterval = Math.max(1.6, this.state.stats.dashInterval + (modifiers.dashInterval ?? 0));
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
    const count = this.state.routeCounts[routeId];
    if (count === 1) {
      this.services.metrics.markRouteHint(routeId);
    }

    if (!this.firstRouteHintRecorded) {
      this.firstRouteHintRecorded = true;
      this.services.metrics.markFirstRouteHint(routeId);
      this.enqueueTip(ROUTES.find((route) => route.id === routeId)?.shortHint ?? '');
    }

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
    let moveX = 0;
    let moveY = 0;
    if (this.inputState.left) {
      moveX -= 1;
    }
    if (this.inputState.right) {
      moveX += 1;
    }
    if (this.inputState.up) {
      moveY -= 1;
    }
    if (this.inputState.down) {
      moveY += 1;
    }

    const magnitude = Math.hypot(moveX, moveY) || 1;
    const normalizedX = moveX / magnitude;
    const normalizedY = moveY / magnitude;
    const moveSpeed = this.getPlayerMoveSpeed();

    battle.playerX = clamp(battle.playerX + normalizedX * moveSpeed * dt, 24, ARENA_WIDTH - 24);
    battle.playerY = clamp(battle.playerY + normalizedY * moveSpeed * dt, 24, ARENA_HEIGHT - 24);

    battle.dashCooldownSec -= dt;
    if (this.state.stats.dashPulseDamage <= 0 || battle.dashCooldownSec > 0) {
      return;
    }

    const dashStage = this.getRouteBuildStage('dash');
    const dashCharge = battle.dashCharge;
    const pulseRadius = this.getDashPulseRadius(dashCharge, dashStage);
    const pulseDamage = this.getDashPulseDamage(dashCharge, dashStage);

    battle.dashCooldownSec = this.getDashCooldownAfterPulse(dashStage);
    battle.invulnerableSec = this.state.stats.dashInvulnerability + (dashStage === 'matured' ? 0.12 : 0);
    battle.dashDriveSec = Math.max(
      battle.dashDriveSec,
      this.getDashDriveDuration(dashCharge),
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
          const knockback = (dashStage === 'matured' ? 40 : dashStage === 'committed' ? 30 : 18) + dashCharge * 4;
          enemy.x += Math.cos(angle) * knockback;
          enemy.y += Math.sin(angle) * knockback;
        }
      }
    }

    const dashHeal = this.getDashPulseHeal(dashCharge, dashStage);
    if (dashHeal > 0) {
      this.state.stats.hp = clamp(this.state.stats.hp + dashHeal, 0, this.state.stats.maxHp);
    }

    if (dashCharge >= 2 && !this.routeMomentShown.dash) {
      this.routeMomentShown.dash = true;
      this.enqueueTip('穿梭节奏开始接上了');
    }

    battle.dashCharge = 0;
  }

  private spawnEnemies(battle: BattleState, dt: number): void {
    const template = BATTLE_TEMPLATES[battle.templateId];
    battle.enemySpawnTimerSec -= dt;
    if (shouldSpawnElite(battle)) {
      const eliteRule = template.eliteRule;
      if (!eliteRule) {
        return;
      }
      battle.eliteSpawned = true;
      battle.eliteAlive = true;
      const eliteHp = this.getRegularEnemyHp(template, this.getCurrentBattleIndex(), this.state.phase, battle.difficultyScale, eliteRule.hpMultiplier);
      battle.enemies.push({
        id: battle.nextEnemyId++,
        x: CENTER_X,
        y: -60,
        hp: eliteHp,
        maxHp: eliteHp,
        speed: this.getRegularEnemySpeed(template, this.getCurrentBattleIndex(), this.state.phase, battle.difficultyScale, eliteRule.speedMultiplier),
        radius: eliteRule.radius,
        elite: true,
        grazeCooldownSec: 0,
      });
      this.enqueueTip('精英进入战场');
      this.enqueueAudio('pressure');
    }

    while (battle.enemySpawnTimerSec <= 0) {
      battle.enemySpawnTimerSec += this.getEnemySpawnInterval(template, battle.elapsedSec);
      const regularEnemyCap = this.getRegularEnemyCap(battle);
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

      const hp = this.getRegularEnemyHp(template, this.getCurrentBattleIndex(), this.state.phase, battle.difficultyScale);
      battle.enemies.push({
        id: battle.nextEnemyId++,
        x: position.x,
        y: position.y,
        hp,
        maxHp: hp,
        speed: this.getRegularEnemySpeed(template, this.getCurrentBattleIndex(), this.state.phase, battle.difficultyScale),
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

    const target = this.getNearestEnemy(battle);
    const effectiveFireRate = this.getEffectiveFireRate(battle);
    battle.fireCooldownSec = 1 / effectiveFireRate;
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
    const projectileSpeed = this.getProjectileSpeed();

    for (let index = 0; index < shotCount; index += 1) {
      const offset = (index - spreadCenter) * 0.18;
      const angle = baseAngle + offset;
      battle.bullets.push({
        id: battle.nextBulletId++,
        x: battle.playerX,
        y: battle.playerY,
        vx: Math.cos(angle) * projectileSpeed,
        vy: Math.sin(angle) * projectileSpeed,
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
          battle.critOverdriveSec = Math.min(4.2, battle.critOverdriveSec + this.getCritOverdriveDurationGain());
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
      const dashStage = this.getRouteBuildStage('dash');
      if (
        this.state.routeCounts.dash > 0 &&
        enemy.grazeCooldownSec <= 0 &&
        distance <= this.getDashGrazeOuterRadius(dashStage) &&
        distance > this.getDashGrazeInnerRadius()
      ) {
        enemy.grazeCooldownSec = 0.8;
        battle.dashCharge = Math.min(6, battle.dashCharge + 1);
        if (dashStage === 'committed' || dashStage === 'matured') {
          battle.dashDriveSec = Math.max(battle.dashDriveSec, 0.7);
          battle.dashCooldownSec = Math.max(0.75, battle.dashCooldownSec - 0.35);
          this.state.stats.hp = clamp(this.state.stats.hp + 0.9, 0, this.state.stats.maxHp);
        }
      }

      if (distance <= enemy.radius + PLAYER_COLLISION_RADIUS) {
        if (battle.invulnerableSec <= 0) {
          let damage = enemy.elite ? 18 : 8;
          damage *= this.getDashDamageMultiplier(dashStage, battle.dashDriveSec);
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

  private updateExperienceOrbs(battle: BattleState, dt: number): void {
    const pickupRadius = this.getPickupRadius();
    const magnetRadius = this.getMagnetRadius();
    const survivors = [];

    for (const orb of battle.experienceOrbs) {
      const distance = Math.hypot(orb.x - battle.playerX, orb.y - battle.playerY);
      if (distance <= pickupRadius) {
        this.gainExperience(orb.value);
        continue;
      }

      if (distance <= magnetRadius) {
        const angle = Math.atan2(battle.playerY - orb.y, battle.playerX - orb.x);
        const attraction = 180 + Math.max(0, magnetRadius - distance) * 2.2;
        orb.velocityX = Math.cos(angle) * attraction;
        orb.velocityY = Math.sin(angle) * attraction;
      } else {
        orb.velocityX *= 0.92;
        orb.velocityY *= 0.92;
      }

      orb.x += orb.velocityX * dt;
      orb.y += orb.velocityY * dt;
      survivors.push(orb);
    }

    battle.experienceOrbs = survivors;
  }

  private gainExperience(amount: number): void {
    if (amount <= 0) {
      return;
    }

    this.state.experience += amount;
    let leveled = false;

    while (this.state.experience >= this.state.experienceToNext) {
      this.state.experience -= this.state.experienceToNext;
      this.state.level += 1;
      this.state.experienceToNext = getExperienceToNextLevel(this.state.level);
      this.state.queuedLevelUps += 1;
      leveled = true;
    }

    if (leveled) {
      this.enqueueAudio('upgrade');
      this.enqueueTip(`等级提升 Lv.${this.state.level}`);
      this.openQueuedLevelUpPanel();
    }
  }

  private openQueuedLevelUpPanel(): void {
    if (this.state.queuedLevelUps <= 0 || this.state.status === 'result') {
      return;
    }
    this.state.status = 'upgradeChoice';
    this.state.upgradeSource = 'levelUp';
    this.state.upgradeChoices = this.rollUpgradeChoices('levelUp');
    this.state.currentEvent = null;
    this.state.nodeOptions = [];
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

  private trySpawnPierceEchoShots(
    battle: BattleState,
    bullet: BattleState['bullets'][number],
    currentEnemy: BattleState['enemies'][number],
  ): void {
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

    const echoTargets = nearbyTargets.slice(0, this.getPierceEchoCount());
    for (const target of echoTargets) {
      const angle = Math.atan2(target.y - currentEnemy.y, target.x - currentEnemy.x);
      const projectileSpeed = Math.max(300, this.getProjectileSpeed() - 30);
      battle.bullets.push({
        id: battle.nextBulletId++,
        x: currentEnemy.x,
        y: currentEnemy.y,
        vx: Math.cos(angle) * projectileSpeed,
        vy: Math.sin(angle) * projectileSpeed,
        damage: bullet.damage * this.getPierceEchoDamageRatio(),
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
    const critSplashRatio = this.getCritSplashRatio(battle);
    if (critSplashRatio > 0) {
      for (const target of battle.enemies) {
        if (target.id === enemy.id || target.hp <= 0) {
          continue;
        }
        const distance = Math.hypot(target.x - enemy.x, target.y - enemy.y);
        if (distance <= 72) {
          target.hp -= this.state.stats.damage * critSplashRatio;
        }
      }
    }

    const pierceRefund = this.getPierceCooldownRefund();
    if (pierceRefund > 0) {
      battle.fireCooldownSec = Math.max(0.04, battle.fireCooldownSec - pierceRefund);
    }

    if (this.state.routeCounts.dash > 0) {
      battle.dashDriveSec = Math.max(battle.dashDriveSec, 0.35);
      if (this.getRouteBuildStage('dash') !== 'unformed') {
        this.state.stats.hp = clamp(this.state.stats.hp + 2, 0, this.state.stats.maxHp);
      }
    }

    const orbValue = this.getEnemyExperienceValue(battle, enemy.elite);
    battle.experienceOrbs.push({
      id: enemy.id,
      x: enemy.x,
      y: enemy.y,
      value: orbValue,
      velocityX: (Math.random() - 0.5) * 60,
      velocityY: (Math.random() - 0.5) * 60,
    });
  }

  private getNearestEnemy(battle: BattleState): BattleState['enemies'][number] | null {
    if (battle.enemies.length === 0) {
      return null;
    }

    return [...battle.enemies].sort(
      (left, right) =>
        Math.hypot(left.x - battle.playerX, left.y - battle.playerY) -
        Math.hypot(right.x - battle.playerX, right.y - battle.playerY),
    )[0];
  }

  private getRegularEnemyHp(
    template: (typeof BATTLE_TEMPLATES)[keyof typeof BATTLE_TEMPLATES],
    round: number,
    phase: RunState['phase'],
    difficultyScale: number,
    eliteMultiplier = 1,
  ): number {
    return Math.round(template.enemyHp * (1 + (round - 1) * 0.2 + this.getPhaseTier(phase) * 0.12) * difficultyScale * eliteMultiplier);
  }

  private getRegularEnemySpeed(
    template: (typeof BATTLE_TEMPLATES)[keyof typeof BATTLE_TEMPLATES],
    round: number,
    phase: RunState['phase'],
    difficultyScale: number,
    speedMultiplier = 1,
  ): number {
    return Math.round(template.enemySpeed * (1 + (round - 1) * 0.06 + this.getPhaseTier(phase) * 0.03) * difficultyScale * speedMultiplier);
  }

  private getEnemySpawnInterval(
    template: (typeof BATTLE_TEMPLATES)[keyof typeof BATTLE_TEMPLATES],
    elapsedSec: number,
  ): number {
    const depthFactor = 1 + (this.getCurrentBattleIndex() - 1) * 0.08 + this.getPhaseTier(this.state.phase) * 0.05;
    const pressureFactor = 1 + Math.min(elapsedSec, 30) * 0.015;
    const interval = template.spawnIntervalSec / (depthFactor * pressureFactor);
    return clamp(interval, template.spawnIntervalSec * 0.38, template.spawnIntervalSec);
  }

  private getRegularEnemyCap(battle: BattleState): number | null {
    return BATTLE_TEMPLATES[battle.templateId].eliteRule?.regularEnemyCap ?? null;
  }

  private getEnemyExperienceValue(battle: BattleState, isElite: boolean): number {
    const template = BATTLE_TEMPLATES[battle.templateId];
    const baseValue = 4 + this.getCurrentBattleIndex() * 2 + this.getPhaseTier(this.state.phase) * 2 + template.enemyHp * 0.08;
    return Math.round(isElite ? baseValue * 4.5 : baseValue);
  }

  private getPhaseTier(phase: RunState['phase']): number {
    switch (phase) {
      case 'opening':
        return 0;
      case 'mid':
        return 1;
      case 'late':
        return 2;
      case 'finalPrep':
        return 3;
      case 'finalBattle':
        return 4;
      case 'ended':
      default:
        return 0;
    }
  }

  private getPlayerMoveSpeed(): number {
    return this.state.stats.moveSpeed;
  }

  private getProjectileSpeed(): number {
    return this.state.stats.projectileSpeed;
  }

  private getPickupRadius(): number {
    return 28 + this.state.stats.moveSpeed * 0.04;
  }

  private getMagnetRadius(): number {
    return 120 + this.state.stats.moveSpeed * 0.12;
  }

  private getDashGrazeOuterRadius(buildStage: RouteBuildStage): number {
    return 64 + this.state.stats.moveSpeed * 0.03 + (buildStage === 'matured' ? 14 : buildStage === 'committed' ? 8 : 0);
  }

  private getDashGrazeInnerRadius(): number {
    return PLAYER_COLLISION_RADIUS + 10;
  }

  private getDashPulseRadius(dashCharge: number, buildStage: RouteBuildStage): number {
    const stageBonus = buildStage === 'matured' ? 10 : buildStage === 'committed' ? 6 : 4;
    return 78 + this.state.stats.moveSpeed * 0.04 + dashCharge * stageBonus;
  }

  private getDashPulseDamage(dashCharge: number, buildStage: RouteBuildStage): number {
    const stageBonus = buildStage === 'matured' ? 8 : buildStage === 'committed' ? 4 : 2;
    return this.state.stats.dashPulseDamage + dashCharge * stageBonus;
  }

  private getDashPulseHeal(dashCharge: number, buildStage: RouteBuildStage): number {
    if (buildStage === 'unformed') {
      return 0;
    }
    const baseHeal = buildStage === 'matured' ? 2.2 : 1.1;
    return dashCharge * baseHeal;
  }

  private getDashDriveDuration(dashCharge: number): number {
    return (this.state.routeCounts.dash > 0 ? 0.9 : 0.45) + dashCharge * 0.18;
  }

  private getDashCooldownAfterPulse(buildStage: RouteBuildStage): number {
    return Math.max(1.5, this.state.stats.dashInterval - (buildStage === 'matured' ? 0.35 : buildStage === 'committed' ? 0.2 : 0));
  }

  private getDashDamageMultiplier(buildStage: RouteBuildStage, dashDriveSec: number): number {
    if (dashDriveSec <= 0) {
      return 1;
    }
    if (buildStage === 'matured') {
      return 0.55;
    }
    if (buildStage === 'committed') {
      return 0.72;
    }
    return 0.85;
  }

  private getEffectiveFireRate(battle: BattleState): number {
    let fireRate = this.state.stats.fireRate;
    if (battle.critOverdriveSec > 0) {
      fireRate += 0.4 + this.state.routeCounts.crit * 0.12;
    }
    if (battle.dashDriveSec > 0) {
      fireRate += 0.35 + this.state.routeCounts.dash * 0.1;
    }
    return fireRate;
  }

  private getEffectiveCritChance(battle: BattleState): number {
    let critChance = this.state.stats.critChance;
    const buildStage = this.getRouteBuildStage('crit');
    if (battle.critOverdriveSec > 0) {
      critChance += 0.08;
      if (buildStage === 'committed') {
        critChance += 0.08;
      }
      if (buildStage === 'matured') {
        critChance += 0.08;
      }
    }
    return clamp(critChance, 0, 0.95);
  }

  private getCritOverdriveDurationGain(): number {
    const buildStage = this.getRouteBuildStage('crit');
    if (buildStage === 'matured') {
      return 0.7;
    }
    if (buildStage === 'committed') {
      return 0.55;
    }
    return 0.45;
  }

  private getCritSplashRatio(battle: BattleState): number {
    if (this.getRouteBuildStage('crit') !== 'matured' || battle.critOverdriveSec <= 0) {
      return 0;
    }
    return 0.45;
  }

  private getPierceEchoCount(): number {
    let count = 1;
    if (this.state.stats.multishot > 1) {
      count += 1;
    }
    if (this.getRouteBuildStage('pierce') === 'matured') {
      count += 1;
    }
    return count;
  }

  private getPierceEchoDamageRatio(): number {
    const buildStage = this.getRouteBuildStage('pierce');
    return buildStage === 'committed' || buildStage === 'matured' ? 0.72 : 0.58;
  }

  private getPierceCooldownRefund(): number {
    const buildStage = this.getRouteBuildStage('pierce');
    return buildStage === 'committed' || buildStage === 'matured' ? 0.06 : 0;
  }
}
