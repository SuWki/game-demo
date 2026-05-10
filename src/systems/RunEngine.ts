import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  VIEWPORT_HEIGHT,
  VIEWPORT_WIDTH,
  PLAYER_COLLISION_RADIUS,
  clamp,
  createBaseStats,
  getBattleCompletionExperience,
  getCritOverdriveDurationGain,
  getCritSplashRatio,
  getDashCooldownAfterPulse,
  getDashDamageMultiplier,
  getDashDriveDuration,
  getDashGrazeInnerRadius,
  getDashGrazeOuterRadius,
  getDashPulseDamage,
  getDashPulseHeal,
  getDashPulseRadius,
  getEffectiveCritChance,
  getEffectiveFireRate,
  getEnemyContactDamage,
  getEnemyExperienceValue,
  getEnemyHealth,
  getEnemyMoveSpeed,
  getEnemySpawnInterval,
  getExperienceToNextLevel,
  getMagnetRadius,
  getPhaseTier,
  getPickupRadius,
  getPierceCooldownRefund,
  getPierceEchoCount,
  getPierceEchoDamageRatio,
  getPlayerMoveSpeed,
  getProjectileSpeed,
  getRegularEnemyCap,
  getSpawnBurstCount,
} from '../data/balance';
import {
  BATTLE_TEMPLATES,
  getBattleActiveEliteBehavior,
  getBattleTargetKills,
  isBattleVictory,
  shouldSpawnElite,
} from '../data/battleTemplates';
import { rollEventDefinition, rollUpgradeChoices } from '../data/contentSelectors';
import { ENEMY_ARCHETYPES, getEnemyArchetype, pickEnemyArchetype } from '../data/enemyArchetypes';
import { buildNodeOptions, createOpeningBattleNode, getPhaseLabel } from '../data/nodes';
import { ROUTES, ROUTE_NAME_MAP } from '../data/routes';
import { UPGRADE_ARCHETYPES } from '../data/upgrades';
import type {
  BattlePressurePhaseDefinition,
  BattleState,
  BattleDebugRuntimeConfig,
  BattleTemplateId,
  ContentEffect,
  ContentTier,
  DebugBattlePhaseId,
  EnemyArchetypeId,
  PressurePocketShiftModeId,
  PressurePatternModeId,
  PressureSafeWindowAxis,
  EventDefinition,
  EventOption,
  EliteBehaviorId,
  NodeRecord,
  NodeOption,
  NodeType,
  AudioCue,
  PlayerInputState,
  PlayerStats,
  PickedEventRecord,
  RouteBuildStage,
  RouteId,
  RunEndingKind,
  RunOutcome,
  RunState,
  Services,
  StatModifiers,
  UpgradeArchetype,
  UpgradeDefinition,
  UpgradeSource,
} from '../game/types';

interface EngineAnnouncement {
  kind: 'tip' | 'audio';
  text?: string;
  cue?: AudioCue;
}

interface RouteAdvanceMeta {
  pickId: string;
}

const CENTER_X = ARENA_WIDTH / 2;
const CENTER_Y = ARENA_HEIGHT / 2;
const ROUTE_COMMIT_THRESHOLD = 3;
const ROUTE_MATURE_THRESHOLD = 5;
const BOSS_SAFE_WINDOW_REACTION_SEC = 0.82;
const BOSS_SAFE_WINDOW_POCKET_REACTION_SEC = 0.64;
const BASE_PLAYER_MOVE_SPEED = createBaseStats().moveSpeed;
const BOSS_SAFE_WINDOW_EDGE_MARGIN_X = 12;
const BOSS_SAFE_WINDOW_EDGE_MARGIN_Y = 10;

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

  // 输入缓冲系统 - 150ms窗口
  // 为每个方向键维护一个缓冲计时器，在150ms内即使按键松开也视为按下
  private inputBufferMs = {
    up: 0,
    down: 0,
    left: 0,
    right: 0,
  };
  private readonly INPUT_BUFFER_WINDOW_MS = 150;

  private debugConfig: BattleDebugRuntimeConfig = {
    freezeEnemyMovement: false,
    freezeEnemyProjectiles: false,
    freezeEnemySpawning: false,
    freezePlayerAutoFire: false,
    invulnerablePlayer: false,
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
      queuedRewardUpgrades: 0,
      currentUpgradeIsReward: false,
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
      eventHistory: [],
      traversedNodes: [],
      battleWins: 0,
      nodeOptions: [],
      currentNode: openingNode,
      lastUpgradeChanges: null,
      upgradeFlashSec: 0,
      levelUpPanelDelaySec: 0,
      upgradeChoices: [],
      currentEvent: null,
      battle: null,
      result: null,
      activeRoutePerks: {},
    };
    this.enterBattle(openingNode);
  }

  public getState(): Readonly<RunState> {
    return this.state;
  }

  public setInputState(nextInput: PlayerInputState): void {
    const now = performance.now();
    // 更新输入缓冲：按键按下时重置缓冲，松开时保留150ms
    if (nextInput.up) {
      this.inputBufferMs.up = now;
    }
    if (nextInput.down) {
      this.inputBufferMs.down = now;
    }
    if (nextInput.left) {
      this.inputBufferMs.left = now;
    }
    if (nextInput.right) {
      this.inputBufferMs.right = now;
    }

    this.inputState.up = nextInput.up;
    this.inputState.down = nextInput.down;
    this.inputState.left = nextInput.left;
    this.inputState.right = nextInput.right;
  }

  // 获取缓冲后的输入状态（在150ms窗口内视为持续按下）
  private getBufferedInputState(): PlayerInputState {
    const now = performance.now();
    const isBuffered = (lastPressMs: number) => now - lastPressMs < this.INPUT_BUFFER_WINDOW_MS;
    return {
      up: this.inputState.up || isBuffered(this.inputBufferMs.up),
      down: this.inputState.down || isBuffered(this.inputBufferMs.down),
      left: this.inputState.left || isBuffered(this.inputBufferMs.left),
      right: this.inputState.right || isBuffered(this.inputBufferMs.right),
    };
  }

  public setDebugConfig(nextConfig: BattleDebugRuntimeConfig): void {
    this.debugConfig = { ...nextConfig };
  }

  public restartDebugBattle(templateId: BattleTemplateId, phase: DebugBattlePhaseId): void {
    const template = BATTLE_TEMPLATES[templateId];
    const battlePhase = template.encounterType === 'boss' ? 'finalBattle' : phase;
    const nodeType: NodeType = template.encounterType === 'boss' ? 'boss' : 'battle';
    const debugNode: NodeOption = {
      id: `debug-${templateId}-${battlePhase}`,
      type: nodeType,
      title: `[DEBUG] ${template.name}`,
      description: `Debug restart for ${template.id}`,
      templateId,
      phase: battlePhase,
      difficultyScale: 1,
    };

    this.state.status = 'battle';
    this.state.phase = battlePhase;
    this.state.round = this.getDebugRoundForPhase(battlePhase);
    this.state.currentEvent = null;
    this.state.currentNode = debugNode;
    this.state.nodeOptions = [];
    this.state.upgradeChoices = [];
    this.state.upgradeSource = null;
    this.state.result = null;
    this.state.queuedLevelUps = 0;
    this.state.levelUpPanelDelaySec = 0;
    this.state.stats.hp = this.state.stats.maxHp;
    this.enterBattle(debugNode);
  }

  public setDebugBattlePressureState(options: {
    eliteHpRatio?: number;
    remainingSec?: number;
    pressurePhaseElapsedSec?: number;
  }): boolean {
    const battle = this.state.battle;
    if (!battle || !battle.eliteAlive) {
      return false;
    }

    const eliteEnemy = this.getEliteEnemy(battle);
    if (!eliteEnemy) {
      return false;
    }

    if (typeof options.eliteHpRatio === 'number' && Number.isFinite(options.eliteHpRatio)) {
      const ratio = clamp(options.eliteHpRatio, 0.05, 1);
      eliteEnemy.hp = clamp(eliteEnemy.maxHp * ratio, 1, eliteEnemy.maxHp);
    }

    if (typeof options.remainingSec === 'number' && Number.isFinite(options.remainingSec)) {
      battle.remainingSec = clamp(options.remainingSec, 1, BATTLE_TEMPLATES[battle.templateId].durationSec);
    }

    if (
      typeof options.pressurePhaseElapsedSec === 'number' &&
      Number.isFinite(options.pressurePhaseElapsedSec) &&
      battle.pressurePhaseIndex >= 0
    ) {
      battle.pressurePhaseElapsedSec = Math.max(0, options.pressurePhaseElapsedSec);
    }

    return true;
  }

  public drainAnnouncements(): EngineAnnouncement[] {
    return this.announcements.splice(0, this.announcements.length);
  }

  public chooseNode(nodeId: string): void {
    const node = this.state.nodeOptions.find((candidate) => candidate.id === nodeId);
    if (!node) {
      return;
    }

    this.services.metrics.recordNodeSelected(node.type, node.title, {
      phase: node.phase,
      focusRoute: this.getDominantRoute(),
    });
    this.state.currentNode = node;
    this.state.nodeOptions = [];
    this.state.traversedNodes.push({
      id: node.id,
      type: node.type,
      title: node.title,
    });
    this.state.phase = node.phase;
    this.enqueueTip(`${getPhaseLabel(node.phase)}：${node.title}`);

    if (node.type === 'battle' || node.type === 'boss') {
      this.enterBattle(node);
      return;
    }

    if (node.type === 'upgrade') {
      this.state.status = 'upgradeChoice';
      this.state.upgradeSource = 'nodePrep';
      this.state.upgradeChoices = this.rollUpgradeChoices('nodePrep');
      this.state.currentEvent = null;
      if (this.state.upgradeChoices.length === 0) {
        this.enqueueTip('本次整备没有可用强化，已继续推进。');
        this.advanceRound();
        return;
      }
      this.services.metrics.recordUpgradeOfferSeen(this.state.upgradeChoices, {
        phase: this.state.phase,
        source: 'nodePrep',
      });
      this.recordRedirectUpgradeOffers(this.state.upgradeChoices);
      return;
    }

    if (node.type === 'anomaly') {
      this.state.status = 'eventChoice';
      this.state.currentEvent = this.rollAnomaly();
      this.state.upgradeSource = null;
      this.state.upgradeChoices = [];
      this.recordRedirectEventOffers(this.state.currentEvent);
    }
  }

  public chooseUpgrade(upgradeId: string): void {
    const upgrade = this.state.upgradeChoices.find((candidate) => candidate.id === upgradeId);
    if (!upgrade) {
      return;
    }

    const source = this.state.upgradeSource;
    const previousDominantRoute = this.getDominantRoute();

    // Capture stats before upgrade
    const statsBefore = { ...this.state.stats };

    this.applyEffects(upgrade.effects, {
      pickId: `upgrade:${upgrade.sourceId}`,
    });

    // Capture stats after upgrade and calculate changes
    const statsAfter = this.state.stats;
    const statChanges = this.calculateStatChanges(statsBefore, statsAfter);
    this.state.lastUpgradeChanges = statChanges;

    // 检测并激活关键路线牌机制
    this.activateRoutePerkFromTags(upgrade.tags);
    if (!this.state.selectedUpgrades.includes(upgrade.sourceId)) {
      this.state.selectedUpgrades.push(upgrade.sourceId);
    }
    this.services.metrics.recordUpgradeSelected(
      upgrade.sourceId,
      upgrade.routeId,
      upgrade.contentTier,
      {
        phase: this.state.phase,
        source: source ?? undefined,
        rarity: upgrade.rarity,
        category: upgrade.category,
        valueScore: upgrade.valueScore,
        valueBucket: upgrade.valueBucket,
        tags: upgrade.tags,
        isHybridPick: this.isHybridTagged(upgrade.tags),
        isLatePayoff: this.isLatePayoffTagged(upgrade.tags, upgrade.contentTier),
      },
    );
    if (this.isRedirectUpgradePick(upgrade, previousDominantRoute)) {
      this.services.metrics.recordRedirectPick({
        phase: this.state.phase,
        pickId: `upgrade:${upgrade.sourceId}`,
        fromRoute: previousDominantRoute,
        toRoute: upgrade.routeId as RouteId,
      });
    }
    if (!this.firstUpgradeRecorded) {
      this.services.metrics.markFirstUpgrade();
      this.firstUpgradeRecorded = true;
    }

    this.enqueueAudio('upgradeEquipped');
    this.enqueueTip(`${upgrade.rarityLabel}品 ${upgrade.name}`);
    this.state.upgradeFlashSec = Math.max(this.state.upgradeFlashSec, 0.22);

    this.state.upgradeChoices = [];
    this.state.upgradeSource = null;

    if (source === 'levelUp') {
      this.state.queuedLevelUps = Math.max(0, this.state.queuedLevelUps - 1);
      if (this.state.currentUpgradeIsReward) {
        this.state.queuedRewardUpgrades = Math.max(0, this.state.queuedRewardUpgrades - 1);
      }
      this.state.currentUpgradeIsReward = false;
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

    const previousDominantRoute = this.getDominantRoute();
    const optionRouteId = option.routeId === 'dominant' ? this.getDominantRoute() ?? undefined : option.routeId;
    this.applyEffects(option.effects ?? [], {
      pickId: `event:${eventDef.id}:${option.id}`,
    });
    const isRedirectPick = Boolean(optionRouteId && previousDominantRoute && optionRouteId !== previousDominantRoute);
    const isHybridPick =
      isRedirectPick ||
      eventDef.id === 'signal-soften' ||
      eventDef.id === 'phase-splitter' ||
      eventDef.id === 'cross-branch-signal' ||
      eventDef.id === 'route-handoff' ||
      eventDef.id === 'relay-splice' ||
      eventDef.id === 'null-lens' ||
      eventDef.id === 'mirror-cache' ||
      eventDef.id === 'carrier-breach';
    const isLatePayoff = this.isLatePayoffEvent(eventDef);
    this.state.eventHistory.push({
      eventId: eventDef.id,
      optionId: option.id,
      routeId: optionRouteId,
      anomalyClass: eventDef.anomalyClass,
      contentTier: eventDef.contentTier,
      isHybridPick,
      isLatePayoff,
      isRedirectPick,
    });
    this.services.metrics.recordEventSelected(eventDef.id, option.id, optionRouteId, eventDef.contentTier, {
      phase: this.state.phase,
      contentKind: eventDef.contentKind ?? 'event',
      anomalyClass: eventDef.anomalyClass,
      isHybridPick,
      isLatePayoff,
    });
    if (isRedirectPick && optionRouteId) {
      this.services.metrics.recordRedirectPick({
        phase: this.state.phase,
        pickId: `event:${eventDef.id}:${option.id}`,
        fromRoute: previousDominantRoute,
        toRoute: optionRouteId,
      });
    }
    this.enqueueAudio(eventDef.contentKind === 'anomaly' ? 'anomaly' : 'confirm');
    this.enqueueTip(`${eventDef.name}：${option.label}`);
    this.advanceRound();
  }

  public tick(deltaMs: number): void {
    // 处理 Boss 战结束过渡
    if (this.state.status === 'bossEnding' && this.state.bossEnding) {
      const dt = deltaMs / 1000;
      this.state.bossEnding.elapsedSec += dt;
      if (this.state.bossEnding.elapsedSec >= this.state.bossEnding.durationSec) {
        // 过渡结束，进入最终结算
        const outcome = this.state.bossEnding.outcome;
        this.state.bossEnding = null;
        if (outcome === 'victory') {
          this.advanceRound();
        } else {
          this.finishRun('defeat', outcome === 'defeat' ? 'hpDepleted' : 'timeOut');
        }
      }
      return;
    }

    // 处理关卡结束过渡
    if (this.state.status === 'phaseTransition' && this.state.phaseTransition) {
      const dt = deltaMs / 1000;
      this.state.phaseTransition.elapsedSec += dt;
      if (this.state.phaseTransition.elapsedSec >= this.state.phaseTransition.durationSec) {
        this.state.phaseTransition = null;
        this.advanceRound();
      }
      return;
    }

    if (this.state.status !== 'battle' || !this.state.battle) {
      return;
    }

    const battle = this.state.battle;
    const dt = deltaMs / 1000;

    // 升级闪光计时器衰减
    if (this.state.upgradeFlashSec > 0) {
      this.state.upgradeFlashSec = Math.max(0, this.state.upgradeFlashSec - dt);
    }
    if (this.state.levelUpPanelDelaySec > 0) {
      this.state.levelUpPanelDelaySec = Math.max(0, this.state.levelUpPanelDelaySec - dt);
      if (this.state.levelUpPanelDelaySec === 0 && this.state.queuedLevelUps > 0) {
        this.openQueuedLevelUpPanel();
        return;
      }
    }
    battle.elapsedSec += dt;
    battle.impactFreezeSec = Math.max(0, battle.impactFreezeSec - dt);
    if (battle.impactFreezeSec <= 0) {
      battle.impactFreezeFactor = 1;
    }
    const simulationDt = dt * (battle.impactFreezeSec > 0 ? battle.impactFreezeFactor : 1);
    battle.remainingSec = Math.max(0, battle.remainingSec - simulationDt);
    battle.critOverdriveSec = Math.max(0, battle.critOverdriveSec - simulationDt);
    battle.dashDriveSec = Math.max(0, battle.dashDriveSec - simulationDt);
    battle.dashCounterWindowSec = Math.max(0, battle.dashCounterWindowSec - simulationDt);
    // crit-crownfire: 破绽爆发后短时收益窗口递减
    battle.critBurstBonusSec = Math.max(0, battle.critBurstBonusSec - simulationDt);
    battle.eliteCrackWindowSec = Math.max(0, battle.eliteCrackWindowSec - simulationDt);
    battle.eliteBreachFlashSec = Math.max(0, battle.eliteBreachFlashSec - simulationDt);
    battle.eliteBreachCalloutCooldownSec = Math.max(0, battle.eliteBreachCalloutCooldownSec - simulationDt);
    battle.invulnerableSec = Math.max(0, battle.invulnerableSec - simulationDt);
    battle.playerImpactSec = Math.max(0, battle.playerImpactSec - dt);
    battle.playerRecoverySec = Math.max(0, battle.playerRecoverySec - dt);
    battle.killFlowSec = Math.max(0, battle.killFlowSec - dt);
    battle.killStreakDecaySec = Math.max(0, battle.killStreakDecaySec - dt);
    if (battle.killStreakDecaySec === 0 && battle.killStreakCount > 0) {
      battle.killStreakCount = 0;
      battle.killStreakMultiplier = 1.0;
    }
    battle.pierceFlowSec = Math.max(0, battle.pierceFlowSec - dt);
    battle.pickupFlowSec = Math.max(0, battle.pickupFlowSec - dt);
    battle.pickupLeadSec = Math.max(0, battle.pickupLeadSec - dt);
    battle.playerDamageFlashSec = Math.max(0, battle.playerDamageFlashSec - dt);
    battle.cameraShakeSec = Math.max(0, battle.cameraShakeSec - dt);
    battle.tempoPulseSec = Math.max(0, battle.tempoPulseSec - dt);
    battle.playerShotFlashSec = Math.max(0, battle.playerShotFlashSec - dt);
    battle.playerShotRecoilSec = Math.max(0, battle.playerShotRecoilSec - dt);
    battle.playerMoveBoostSec = Math.max(0, battle.playerMoveBoostSec - dt);
    battle.playerTurnBurstSec = Math.max(0, battle.playerTurnBurstSec - dt);
    battle.playerNearMissSec = Math.max(0, battle.playerNearMissSec - dt);
    battle.playerNearMissCooldownSec = Math.max(0, battle.playerNearMissCooldownSec - dt);
    battle.monitorDashLateMomentCooldownSec = Math.max(0, battle.monitorDashLateMomentCooldownSec - dt);
    battle.monitorDashCounterCooldownSec = Math.max(0, battle.monitorDashCounterCooldownSec - dt);
    battle.monitorEliteCrackFollowThroughCooldownSec = Math.max(
      0,
      battle.monitorEliteCrackFollowThroughCooldownSec - dt,
    );
    battle.monitorKillPickupContinueCooldownSec = Math.max(
      0,
      battle.monitorKillPickupContinueCooldownSec - dt,
    );

    // Crit路线独特被动计时器衰减
    battle.critComboDecaySec = Math.max(0, battle.critComboDecaySec - dt);
    if (battle.critComboDecaySec === 0) {
      battle.critComboStacks = 0;
      battle.critFinisherReady = false;
    }
    battle.critBurstChainSec = Math.max(0, battle.critBurstChainSec - dt);
    if (battle.critBurstChainSec === 0) {
      battle.critBurstChainCount = 0;
    }

    // Pierce路线独特被动计时器衰减
    battle.pierceChainDecaySec = Math.max(0, battle.pierceChainDecaySec - dt);
    if (battle.pierceChainDecaySec === 0) {
      battle.pierceChainStacks = 0;
    }

    // Dash路线独特被动计时器衰减
    battle.dashMomentumDecaySec = Math.max(0, battle.dashMomentumDecaySec - dt);
    if (battle.dashMomentumDecaySec === 0) {
      battle.dashMomentumStacks = 0;
    }
    battle.dashCounterWindowSec = Math.max(0, battle.dashCounterWindowSec - dt);

    if (battle.pickupFlowSec <= 0) {
      battle.pickupFlowCount = 0;
    }
    if (battle.pickupLeadSec <= 0) {
      battle.pickupLeadEnemyId = null;
    }
    if (battle.eliteCrackWindowSec <= 0) {
      battle.eliteCrackEscortCount = 0;
    }
    if (battle.killFlowSec <= 0) {
      battle.killFlowCount = 0;
    }
    if (battle.pierceFlowSec <= 0) {
      battle.pierceFlowCount = 0;
    }
    if (battle.playerShotRecoilSec <= 0) {
      battle.playerShotRecoilStrength = 0;
    } else {
      battle.playerShotRecoilStrength = Math.max(0, battle.playerShotRecoilStrength - dt * 34);
    }
    if (battle.cameraShakeSec <= 0) {
      battle.cameraShakeStrength = 0;
    } else {
      battle.cameraShakeStrength = Math.max(0, battle.cameraShakeStrength - dt * 1.8);
    }
    battle.pressurePhaseElapsedSec += simulationDt;
    battle.pressureTransitionSec = Math.max(0, battle.pressureTransitionSec - simulationDt);

    this.updatePressurePhase(battle);
    this.updatePressureSignature(battle, simulationDt);
    this.updatePressurePattern(battle, simulationDt);
    this.updatePlayerMovement(battle, dt);
    this.applyBossSafeWindowPenalty(battle, simulationDt);
    this.spawnEnemies(battle, simulationDt);
    this.updateShooting(battle, simulationDt);
    this.updateBullets(battle, simulationDt);
    this.updateEnemies(battle, simulationDt);
    if (this.state.battle !== battle) {
      return;
    }
    this.updateEnemyProjectiles(battle, simulationDt);
    if (this.state.battle !== battle) {
      return;
    }
    this.updatePulses(battle, dt);
    this.updateExperienceOrbs(battle, simulationDt);
    this.updateBossFirelineMonitoring(battle);

    if (this.state.stats.regeneration > 0) {
      this.state.stats.hp = clamp(
        this.state.stats.hp + this.state.stats.regeneration * simulationDt,
        0,
        this.state.stats.maxHp,
      );
    }

    if (this.finishBattleOnPlayerDefeat(battle)) {
      return;
    }

    if (isBattleVictory(battle)) {
      this.completeBattle();
      return;
    }

    if (battle.remainingSec <= 0) {
      const template = BATTLE_TEMPLATES[battle.templateId];
      if (template.winCondition.type === 'survive') {
        this.completeBattle();
      }
    }
  }

  public getBattleLabel(): string {
    const battle = this.state.battle;
    if (!battle) {
      return '';
    }

    const template = BATTLE_TEMPLATES[battle.templateId];
    const label = battle.label || template.name;

    switch (template.winCondition.type) {
      case 'survive':
        return `${label} 生存`;
      case 'elite':
        return `${label} ${battle.eliteAlive ? '\u51fb\u7834\u7cbe\u82f1' : '\u51c6\u5907\u4ea4\u706b'}`;
      case 'kills':
      default:
        return `${label} ${battle.kills}/${template.winCondition.target ?? battle.targetKills}`;
    }
  }

  public getDominantRoute(): RouteId | null {
    const entries = Object.entries(this.state.routeCounts) as Array<[RouteId, number]>;
    const top = [...entries].sort((left, right) => right[1] - left[1])[0];
    return top && top[1] > 0 ? top[0] : null;
  }

  private calculateStatChanges(before: PlayerStats, after: PlayerStats): StatModifiers {
    const changes: StatModifiers = {};

    if (after.maxHp !== before.maxHp) changes.maxHp = after.maxHp - before.maxHp;
    if (after.damage !== before.damage) changes.damage = after.damage - before.damage;
    if (after.fireRate !== before.fireRate) changes.fireRate = after.fireRate - before.fireRate;
    if (after.projectileSpeed !== before.projectileSpeed) changes.projectileSpeed = after.projectileSpeed - before.projectileSpeed;
    if (after.critChance !== before.critChance) changes.critChance = after.critChance - before.critChance;
    if (after.critMultiplier !== before.critMultiplier) changes.critMultiplier = after.critMultiplier - before.critMultiplier;
    if (after.pierce !== before.pierce) changes.pierce = after.pierce - before.pierce;
    if (after.multishot !== before.multishot) changes.multishot = after.multishot - before.multishot;
    if (after.moveSpeed !== before.moveSpeed) changes.moveSpeed = after.moveSpeed - before.moveSpeed;
    if (after.dashInterval !== before.dashInterval) changes.dashInterval = after.dashInterval - before.dashInterval;
    if (after.dashPulseDamage !== before.dashPulseDamage) changes.dashPulseDamage = after.dashPulseDamage - before.dashPulseDamage;
    if (after.dashInvulnerability !== before.dashInvulnerability) changes.dashInvulnerability = after.dashInvulnerability - before.dashInvulnerability;
    if (after.regeneration !== before.regeneration) changes.regeneration = after.regeneration - before.regeneration;

    return changes;
  }

  private getResultRoute(): RouteId | null {
    return this.state.maturedRoute ?? this.state.committedRoute ?? this.getDominantRoute();
  }

  private getCurrentBattleIndex(): number {
    return Math.max(1, this.state.round + 1);
  }

  private getDebugRoundForPhase(phase: DebugBattlePhaseId): number {
    switch (phase) {
      case 'opening':
        return 0;
      case 'mid':
        return 1;
      case 'late':
        return 2;
      case 'finalBattle':
        return 4;
      default:
        return 0;
    }
  }

  public getRouteBuildStage(routeId: RouteId): RouteBuildStage {
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

  private rollAnomaly(): EventDefinition {
    return rollEventDefinition(this.state, 'anomaly');
  }

  private enterBattle(node: NodeOption): void {
    const template = BATTLE_TEMPLATES[node.templateId ?? 'elimination'];
    const battleIndex = this.getCurrentBattleIndex();
    const encounterType = template.encounterType ?? (node.type === 'boss' ? 'boss' : 'battle');
    const battleLabel = encounterType === 'boss' ? `Boss \u00b7 ${node.title}` : template.name;

    this.state.status = 'battle';
    this.state.phase = node.phase;
    this.state.currentNode = node;
    this.state.currentEvent = null;
    this.state.upgradeChoices = [];
    this.state.upgradeSource = null;
    this.state.battle = {
      encounterType,
      templateId: template.id,
      label: battleLabel,
      description:
        encounterType === 'boss'
          ? `${node.description} ${template.description}`
          : template.description,
      durationSec: template.durationSec,
      remainingSec: template.durationSec,
      targetKills: getBattleTargetKills(template.id),
      spawnIntervalSec: template.spawnIntervalSec,
      enemyHp: 0,
      enemySpeed: 0,
      difficultyScale: node.difficultyScale ?? 1,
      kills: 0,
      elapsedSec: 0,
      pressurePhaseIndex: -1,
      pressurePhaseElapsedSec: 0,
      pressurePhaseLabel: template.eliteRule ? (encounterType === 'boss' ? '接敌' : '交火') : undefined,
      pressureTransitionSec: 0,
      pressureSignatureLabel: undefined,
      pressureSignatureSec: 0,
      pressureSignaturePulseSec: 0,
      pressurePatternLabel: undefined,
      pressurePatternMode: undefined,
      pressurePatternPulseSec: 0,
      pressurePatternFlashSec: 0,
      pressurePatternPulseCount: 0,
      pressureSafeWindowAxis: undefined,
      pressureSafeWindowShiftType: undefined,
      pressureSafeWindowCenter: CENTER_X,
      pressureSafeWindowSpan: 0,
      pressureSafeWindowSecondaryCenter: CENTER_Y,
      pressureSafeWindowSecondarySpan: 0,
      pressureSafeWindowSec: 0,
      pressurePocketShiftSeen: [],
      nextEnemyId: 0,
      nextBulletId: 0,
      nextPulseId: 0,
      nextEnemyProjectileId: 0,
      enemySpawnTimerSec: 0.2,
      eliteSupportCooldownSec: 0,
      spawnCursor: 0,
      fireCooldownSec: 0.1,
      dashCooldownSec: this.state.stats.dashInterval,
      invulnerableSec: 0,
      impactFreezeSec: 0,
      impactFreezeFactor: 1,
      enemies: [],
      bullets: [],
      pulses: [],
      experienceOrbs: [],
      enemyProjectiles: [],
      playerX: CENTER_X,
      playerY: CENTER_Y,
      playerVelocityX: 0,
      playerVelocityY: 0,
      playerMoveDirX: 0,
      playerMoveDirY: 0,
      playerAimDirX: 0,
      playerAimDirY: -1,
      eliteAlive: false,
      eliteSpawned: false,
      eliteCrackWindowSec: 0,
      eliteCrackEscortCount: 0,
      eliteBreachFlashSec: 0,
      eliteBreachCalloutCooldownSec: 0,
      critOverdriveSec: 0,
      critChain: 0,
      dashCharge: 0,
      dashDriveSec: 0,
      playerKnockbackVX: 0,
      playerKnockbackVY: 0,
      playerImpactSec: 0,
      playerRecoverySec: 0,
      killFlowSec: 0,
      killFlowCount: 0,
      killStreakCount: 0,
      killStreakDecaySec: 0,
      killStreakMultiplier: 1.0,
      pierceFlowSec: 0,
      pierceFlowCount: 0,
      pickupFlowSec: 0,
      pickupFlowCount: 0,
      pickupLeadSec: 0,
      pickupLeadEnemyId: null,
      playerDamageFlashSec: 0,
      playerDamageAngle: -Math.PI / 2,
      cameraShakeSec: 0,
      cameraShakeStrength: 0,
      cameraShakeFrequency: 11,
      tempoPulseSec: 0,
      playerShotFlashSec: 0,
      playerShotRecoilSec: 0,
      playerShotRecoilStrength: 0,
      playerMoveBoostSec: 0,
      playerTurnBurstSec: 0,
      playerNearMissSec: 0,
      playerNearMissAngle: -Math.PI / 2,
      playerNearMissCooldownSec: 0,
      lateDashWindowMoments: 0,
      dashCounterMoments: 0,
      dashCounterWindowSec: 0,
      eliteCrackSeen: false,
      eliteCrackFollowThroughMoments: 0,
      bossFirelineCoverage: 0,
      bossSafeWindowMoments: 0,
      bossSafeWindowGraceSec: 0,
      outsideSafeDamageTimerSec: 0,
      outsideSafeDamageTickCount: 0,
      insideSafeProjectileClears: 0,
      killPickupContinueMoments: 0,
      monitorDashLateMomentCooldownSec: 0,
      monitorDashCounterCooldownSec: 0,
      monitorEliteCrackFollowThroughCooldownSec: 0,
      monitorKillPickupContinueCooldownSec: 0,
      // 流派构筑第四轮：路线关键牌战斗状态
      pierceSeamkeepActive: this.state.activeRoutePerks?.pierceSeamkeep ?? false,
      pierceFloodgateReady: this.state.activeRoutePerks?.pierceFloodgate ?? false,
      pierceRiftbloomActive: (this.state.activeRoutePerks?.pierceRiftbloom ?? false) || (this.state.activeRoutePerks?.piercePrism ?? false),
      dashBrushActive: this.state.activeRoutePerks?.dashBrush ?? false,
      dashSidestepBankActive: this.state.activeRoutePerks?.dashSidestepBank ?? false,
      dashZeroWindowReady: this.state.activeRoutePerks?.dashZeroWindow ?? false,
      dashAfterimageReady: this.state.activeRoutePerks?.dashAfterimage ?? false,
      // Crit 关键牌战斗状态
      critAfterglowActive: this.state.activeRoutePerks?.critAfterglow ?? false,
      critEmbershardActive: this.state.activeRoutePerks?.critEmbershard ?? false,
      critCrownfireReady: this.state.activeRoutePerks?.critCrownfire ?? false,
      critBurstBonusSec: 0,
      critBurstBonusRatio: 0,
      // Crit路线独特被动状态
      critComboStacks: 0,
      critComboDecaySec: 0,
      critFinisherReady: false,
      critBurstChainSec: 0,
      critBurstChainCount: 0,
      // Pierce路线独特被动状态
      pierceFractureMark: new Set<number>(),
      pierceChainStacks: 0,
      pierceChainDecaySec: 0,
      // Dash路线独特被动状态
      dashAfterimages: [],
      dashConsecutiveCount: 0,
      dashConsecutiveWindowSec: 0,
      dashGhostStrikeReady: false,
      dashMomentumStacks: 0,
      dashMomentumDecaySec: 0,
    };
    this.state.battle.enemyHp = this.getRegularEnemyHp(template, battleIndex, node.phase, this.state.battle.difficultyScale);
    this.state.battle.enemySpeed = this.getRegularEnemySpeed(template, battleIndex, node.phase, this.state.battle.difficultyScale);
    this.enqueueTip(
      encounterType === 'boss'
        ? `Boss 警报：${node.title}`
        : `${getPhaseLabel(node.phase)}进入：${template.name}`,
    );
    this.enqueueAudio(encounterType === 'boss' ? 'boss' : 'pressure');
    this.services.metrics.recordBattleEntered(template.id, node.title, template.contentTier, {
      phase: node.phase,
      isLatePayoff: this.isLatePhase(node.phase) && template.contentTier === 'rare',
      encounterType,
      nodeType: node.type,
    });
  }

  private getActivePressurePhase(battle: BattleState): BattlePressurePhaseDefinition | null {
    const phases = BATTLE_TEMPLATES[battle.templateId].eliteRule?.pressurePhases ?? [];
    if (battle.pressurePhaseIndex < 0 || battle.pressurePhaseIndex >= phases.length) {
      return null;
    }

    return phases[battle.pressurePhaseIndex] ?? null;
  }

  private getActiveEliteBehavior(
    battle: BattleState,
    template: (typeof BATTLE_TEMPLATES)[keyof typeof BATTLE_TEMPLATES],
  ): EliteBehaviorId {
    return getBattleActiveEliteBehavior(battle.templateId, battle.pressurePhaseIndex) ?? template.eliteRule?.behavior ?? 'frontline';
  }

  private activatePressureSignature(battle: BattleState, phase: BattlePressurePhaseDefinition): void {
    const durationSec = phase.signatureDurationSec ?? 0;
    if (durationSec <= 0 || !phase.signatureLabel) {
      battle.pressureSignatureLabel = undefined;
      battle.pressureSignatureSec = 0;
      battle.pressureSignaturePulseSec = 0;
      return;
    }

    battle.pressureSignatureLabel = phase.signatureLabel;
    battle.pressureSignatureSec = durationSec;
    battle.pressureSignaturePulseSec = 0;

    if (battle.encounterType === 'boss') {
      this.services.metrics.recordBossSignatureSeen(battle.templateId, phase.id, phase.label, phase.signatureLabel, durationSec);
    }
  }

  private clearPressureSafeWindow(battle: BattleState): void {
    battle.pressureSafeWindowAxis = undefined;
    battle.pressureSafeWindowShiftType = undefined;
    battle.pressureSafeWindowCenter = CENTER_X;
    battle.pressureSafeWindowSpan = 0;
    battle.pressureSafeWindowSecondaryCenter = CENTER_Y;
    battle.pressureSafeWindowSecondarySpan = 0;
    battle.pressureSafeWindowSec = 0;
    battle.bossSafeWindowGraceSec = 0;
  }

  private clearPressurePattern(battle: BattleState): void {
    battle.pressurePatternLabel = undefined;
    battle.pressurePatternMode = undefined;
    battle.pressurePatternPulseSec = 0;
    battle.pressurePatternFlashSec = 0;
    battle.pressurePatternPulseCount = 0;
    battle.pressurePocketShiftSeen = [];
    this.clearPressureSafeWindow(battle);
  }

  private activatePressurePattern(battle: BattleState, phase: BattlePressurePhaseDefinition): void {
    const pulseIntervalSec = phase.patternPulseIntervalSec ?? 0;
    if (pulseIntervalSec <= 0 || !phase.patternLabel || !phase.patternMode) {
      this.clearPressurePattern(battle);
      return;
    }

    battle.pressurePatternLabel = phase.patternLabel;
    battle.pressurePatternMode = phase.patternMode;
    battle.pressurePatternPulseSec = Math.min(0.65, Math.max(0.2, pulseIntervalSec * 0.45));
    battle.pressurePatternFlashSec = Math.max(battle.pressurePatternFlashSec, 0.24);
    battle.pressurePatternPulseCount = 0;
    this.clearPressureSafeWindow(battle);

    if (battle.encounterType === 'boss') {
      this.services.metrics.recordBossPhasePatternSeen(battle.templateId, phase.id, phase.label, phase.patternLabel);
    }
  }

  private updatePressureSignature(battle: BattleState, dt: number): void {
    if (battle.pressureSignatureSec <= 0) {
      battle.pressureSignatureLabel = undefined;
      battle.pressureSignaturePulseSec = 0;
      return;
    }

    const phase = this.getActivePressurePhase(battle);
    if (!phase) {
      battle.pressureSignatureLabel = undefined;
      battle.pressureSignatureSec = 0;
      battle.pressureSignaturePulseSec = 0;
      return;
    }

    battle.pressureSignatureSec = Math.max(0, battle.pressureSignatureSec - dt);
    battle.pressureSignaturePulseSec = Math.max(0, battle.pressureSignaturePulseSec - dt);
    if (battle.pressureSignatureSec <= 0) {
      battle.pressureSignatureLabel = undefined;
      battle.pressureSignaturePulseSec = 0;
      return;
    }

    const pulseIntervalSec = phase.signaturePulseIntervalSec ?? 0;
    const shouldPulse = pulseIntervalSec > 0 && battle.pressureSignaturePulseSec <= 0;
    if (!shouldPulse) {
      return;
    }

    if ((phase.signatureEscortBurst ?? 0) > 0) {
      this.spawnPhaseEscortBurst(battle, phase.signatureEscortBurst ?? 0);
    }
    if ((phase.signatureVolleyCount ?? 0) > 0) {
      this.firePressureVolley(battle, phase.signatureVolleyCount ?? 0);
    }

    battle.pressureSignaturePulseSec = pulseIntervalSec;
  }

  private updatePressurePattern(battle: BattleState, dt: number): void {
    battle.pressurePatternFlashSec = Math.max(0, battle.pressurePatternFlashSec - dt);
    battle.pressureSafeWindowSec = Math.max(0, battle.pressureSafeWindowSec - dt);
    if (battle.pressureSafeWindowSec <= 0) {
      this.clearPressureSafeWindow(battle);
    }
    const phase = this.getActivePressurePhase(battle);
    if (!phase || !phase.patternLabel || !phase.patternMode || (phase.patternPulseIntervalSec ?? 0) <= 0) {
      this.clearPressurePattern(battle);
      return;
    }

    if (battle.pressurePatternLabel !== phase.patternLabel || battle.pressurePatternMode !== phase.patternMode) {
      this.activatePressurePattern(battle, phase);
    }

    battle.pressurePatternPulseSec = Math.max(0, battle.pressurePatternPulseSec - dt);
    if (battle.pressurePatternPulseSec > 0) {
      return;
    }

    this.executePressurePattern(battle, phase);
    battle.pressurePatternPulseSec = phase.patternPulseIntervalSec ?? 0;
    battle.pressurePatternFlashSec = Math.max(battle.pressurePatternFlashSec, 0.48);
  }

  private executePressurePattern(battle: BattleState, phase: BattlePressurePhaseDefinition): void {
    battle.pressurePatternPulseCount += 1;
    switch (phase.patternMode) {
      case 'laneCrush':
        this.openPressureSafeWindow(battle, phase, 'vertical');
        this.spawnPressureWallShots(battle, phase, 'vertical');
        this.spawnPatternEscortWave(
          battle,
          phase.patternEscortBurst ?? 0,
          phase.patternMode,
          phase.patternEscortArchetype,
        );
        return;
      case 'sideClamp':
        this.openPressureSafeWindow(battle, phase, 'horizontal');
        this.spawnPressureWallShots(battle, phase, 'horizontal');
        this.spawnPatternEscortWave(
          battle,
          phase.patternEscortBurst ?? 0,
          phase.patternMode,
          phase.patternEscortArchetype,
        );
        return;
      case 'crossfireWave':
        this.openPressureSafeWindow(battle, phase, 'pocket');
        this.spawnPressurePocketShots(battle, phase);
        this.firePressureVolley(battle, phase.patternVolleyCount ?? 0, {
          spreadRad: phase.patternVolleySpreadRad ?? 0.2,
          shotsPerShooter: phase.patternVolleyShotsPerShooter ?? 2,
          respectsSafeWindow: true,
        });
        return;
      default:
        return;
    }
  }

  private getBattleViewportBounds(battle: BattleState): {
    left: number;
    right: number;
    top: number;
    bottom: number;
    width: number;
    height: number;
  } {
    const width = Math.min(VIEWPORT_WIDTH, ARENA_WIDTH);
    const height = Math.min(VIEWPORT_HEIGHT, ARENA_HEIGHT);
    const left = clamp(battle.playerX - width * 0.5, 0, Math.max(0, ARENA_WIDTH - width));
    const top = clamp(battle.playerY - height * 0.5, 0, Math.max(0, ARENA_HEIGHT - height));

    return {
      left,
      right: left + width,
      top,
      bottom: top + height,
      width,
      height,
    };
  }

  private updateBossFirelineMonitoring(battle: BattleState): void {
    if (battle.encounterType !== 'boss' || battle.templateId !== 'boss-bastion') {
      return;
    }

    const phase = this.getActivePressurePhase(battle);
    if (!phase || phase.id !== 'fireline') {
      return;
    }

    const view = this.getBattleViewportBounds(battle);
    const visibleProjectiles = battle.enemyProjectiles.filter(
      (projectile) =>
        projectile.x >= view.left - 18 &&
        projectile.x <= view.right + 18 &&
        projectile.y >= view.top - 18 &&
        projectile.y <= view.bottom + 18,
    ).length;
    const activeEscorts = battle.enemies.filter((enemy) => !enemy.elite && enemy.hp > 0).length;
    const safeAreaRatio =
      battle.pressureSafeWindowAxis === 'pocket' &&
      battle.pressureSafeWindowSpan > 0 &&
      battle.pressureSafeWindowSecondarySpan > 0
        ? (battle.pressureSafeWindowSpan * battle.pressureSafeWindowSecondarySpan) / Math.max(1, view.width * view.height)
        : battle.pressureSafeWindowAxis && battle.pressureSafeWindowSpan > 0
          ? battle.pressureSafeWindowSpan / Math.max(1, battle.pressureSafeWindowAxis === 'vertical' ? view.width : view.height)
          : 0;
    const dangerCoverage = clamp(1 - safeAreaRatio, 0, 1);
    const projectileCoverage = clamp(visibleProjectiles / 18, 0, 1);
    const escortCoverage = clamp(activeEscorts / 5, 0, 1);
    const phasePulseCoverage = clamp(battle.pressurePatternPulseCount / 4, 0, 1);
    const coverage =
      dangerCoverage * 0.5 +
      projectileCoverage * 0.26 +
      escortCoverage * 0.12 +
      phasePulseCoverage * 0.12;
    battle.bossFirelineCoverage = Math.max(battle.bossFirelineCoverage, Number(coverage.toFixed(3)));
  }

  private openPressureSafeWindow(
    battle: BattleState,
    phase: BattlePressurePhaseDefinition,
    axis: PressureSafeWindowAxis,
  ): void {
    const view = this.getBattleViewportBounds(battle);

    if (axis === 'pocket') {
      const shiftType = this.getPressurePocketShiftType(battle, phase);
      const shiftProfile = this.getPressurePocketShiftProfile(shiftType);
      // 安全区尺寸收窄 20%（原值 * 0.8）
      const baseSafeWindowSpan = clamp((phase.patternSafeWindowSize ?? 184) * 0.8, 122, view.width * 0.34);
      const baseSafeWindowSecondarySpan = clamp(
        (phase.patternSafeWindowSecondarySize ?? baseSafeWindowSpan * 0.68) * 0.8,
        86,
        view.height * 0.32,
      );
      const safeWindowSpan = clamp(baseSafeWindowSpan * shiftProfile.widthScale, 144, view.width * 0.44);
      const safeWindowSecondarySpan = clamp(
        baseSafeWindowSecondarySpan * shiftProfile.heightScale,
        104,
        view.height * 0.42,
      );
      const safeWindowCenter = this.choosePressureSafePocketCenter(battle, safeWindowSpan, safeWindowSecondarySpan, shiftType);
      const baseSafeWindowSec = (phase.patternSafeWindowLingerSec ?? 1.08) * shiftProfile.lingerScale;
      const safeWindowSec =
        battle.encounterType === 'boss'
          ? this.getBossSafeWindowLingerSec(baseSafeWindowSec, phase.patternPulseIntervalSec)
          : clamp(baseSafeWindowSec, 0.72, 1.72);

      battle.pressureSafeWindowAxis = axis;
      battle.pressureSafeWindowShiftType = shiftType;
      battle.pressureSafeWindowCenter = safeWindowCenter.x;
      battle.pressureSafeWindowSpan = safeWindowSpan;
      battle.pressureSafeWindowSecondaryCenter = safeWindowCenter.y;
      battle.pressureSafeWindowSecondarySpan = safeWindowSecondarySpan;
      battle.pressureSafeWindowSec = safeWindowSec;
      if (battle.encounterType === 'boss') {
        battle.bossSafeWindowMoments += 1;
        this.refreshBossSafeWindowGrace(battle);
        this.clearBossSafeWindowBlockers(battle);
        this.enqueueTip('安全区出现：进入蓝色区域');
      }

      if (battle.encounterType === 'boss' && !battle.pressurePocketShiftSeen.includes(shiftType)) {
        this.services.metrics.recordBossSafeWindowSeen(
          battle.templateId,
          phase.id,
          phase.label,
          phase.patternLabel ?? phase.label,
          axis,
          safeWindowSpan,
          safeWindowSec,
          safeWindowSecondarySpan,
          shiftType,
        );
        battle.pressurePocketShiftSeen.push(shiftType);
      }
      return;
    }

    const dimension = axis === 'vertical' ? view.width : view.height;
    const minimumSpan = axis === 'vertical' ? 134 : 108; // 原164/132收窄18-20%
    const maximumSpan = dimension * 0.38; // 原0.48收窄20%
    const safeWindowSpan = clamp(
      (phase.patternSafeWindowSize ?? (axis === 'vertical' ? 212 : 156)) * 0.8,
      minimumSpan,
      maximumSpan,
    );
    const safeWindowCenter = this.choosePressureSafeWindowCenter(battle, axis, safeWindowSpan);
    const baseSafeWindowSec = phase.patternSafeWindowLingerSec ?? (axis === 'vertical' ? 1.28 : 1.18);
    const safeWindowSec =
      battle.encounterType === 'boss'
        ? this.getBossSafeWindowLingerSec(baseSafeWindowSec, phase.patternPulseIntervalSec)
        : clamp(baseSafeWindowSec, 0.82, 1.9);

    battle.pressureSafeWindowAxis = axis;
    battle.pressureSafeWindowShiftType = undefined;
    battle.pressureSafeWindowCenter = safeWindowCenter;
    battle.pressureSafeWindowSpan = safeWindowSpan;
    battle.pressureSafeWindowSecondaryCenter =
      axis === 'vertical' ? view.top + view.height * 0.5 : view.left + view.width * 0.5;
    battle.pressureSafeWindowSecondarySpan = 0;
    battle.pressureSafeWindowSec = safeWindowSec;
    if (battle.encounterType === 'boss') {
      battle.bossSafeWindowMoments += 1;
      this.refreshBossSafeWindowGrace(battle);
      this.clearBossSafeWindowBlockers(battle);
      this.enqueueTip('安全区出现：进入蓝色区域');
    }

    if (battle.encounterType === 'boss' && battle.pressurePatternPulseCount === 1) {
      this.services.metrics.recordBossSafeWindowSeen(
        battle.templateId,
        phase.id,
        phase.label,
        phase.patternLabel ?? phase.label,
        axis,
        safeWindowSpan,
        safeWindowSec,
      );
    }
  }

  private choosePressureSafeWindowCenter(
    battle: BattleState,
    axis: PressureSafeWindowAxis,
    span: number,
  ): number {
    const view = this.getBattleViewportBounds(battle);
    const dimension = axis === 'vertical' ? view.width : view.height;
    const viewStart = axis === 'vertical' ? view.left : view.top;
    const playerCoord = axis === 'vertical' ? battle.playerX : battle.playerY;
    const laneRatios = axis === 'vertical' ? [0.32, 0.68, 0.5, 0.36, 0.64] : [0.3, 0.7, 0.5, 0.38, 0.62];
    const pulseIndex = Math.max(0, battle.pressurePatternPulseCount - 1) % laneRatios.length;
    const anchoredLane = viewStart + dimension * laneRatios[pulseIndex];
    if (battle.encounterType === 'boss') {
      return this.chooseBossPressureSafeWindowCenter(battle, axis, span, anchoredLane);
    }
    const blendedCenter = anchoredLane * 0.72 + playerCoord * 0.28;
    const margin = axis === 'vertical' ? 72 : 58;
    return clamp(
      blendedCenter,
      viewStart + margin + span * 0.5,
      viewStart + dimension - margin - span * 0.5,
    );
  }

  private choosePressureSafePocketCenter(
    battle: BattleState,
    spanX: number,
    spanY: number,
    shiftType: PressurePocketShiftModeId,
  ): { x: number; y: number } {
    const view = this.getBattleViewportBounds(battle);
    const shiftModes = this.getActivePressurePhase(battle)?.patternPocketShiftModes;
    const shiftModeCount = Math.max(1, shiftModes?.length ?? 0);
    const shiftCycleIndex = Math.floor(Math.max(0, battle.pressurePatternPulseCount - 1) / shiftModeCount);
    const shiftProfile = this.getPressurePocketShiftProfile(shiftType);
    const anchor = shiftProfile.anchors[shiftCycleIndex % shiftProfile.anchors.length];
    const anchorX = view.left + view.width * anchor.x;
    const anchorY = view.top + view.height * anchor.y;
    if (battle.encounterType === 'boss') {
      return this.chooseBossPressureSafePocketCenter(battle, spanX, spanY, shiftType, anchorX, anchorY);
    }
    const playerBlend = shiftProfile.playerBlend;
    const blendedX = anchorX * (1 - playerBlend) + battle.playerX * playerBlend;
    const blendedY = anchorY * (1 - playerBlend) + battle.playerY * playerBlend;
    return {
      x: clamp(blendedX, view.left + 84 + spanX * 0.5, view.right - 84 - spanX * 0.5),
      y: clamp(blendedY, view.top + 74 + spanY * 0.5, view.bottom - 74 - spanY * 0.5),
    };
  }

  private getBossSafeWindowLingerSec(baseLingerSec: number, pulseIntervalSec: number | undefined): number {
    const minimumReadableSec = Math.max(baseLingerSec, (pulseIntervalSec ?? baseLingerSec) + 0.12);
    return clamp(minimumReadableSec, 1.12, 2.34);
  }

  private getBossSafeWindowTargetDistance(axis: PressureSafeWindowAxis): number {
    const reactionSec = axis === 'pocket' ? BOSS_SAFE_WINDOW_POCKET_REACTION_SEC : BOSS_SAFE_WINDOW_REACTION_SEC;
    const targetDistance = BASE_PLAYER_MOVE_SPEED * reactionSec;
    return axis === 'pocket' ? clamp(targetDistance, 118, 172) : clamp(targetDistance, 132, 204);
  }

  private chooseBossPressureSafeWindowCenter(
    battle: BattleState,
    axis: PressureSafeWindowAxis,
    span: number,
    anchoredLane: number,
  ): number {
    const view = this.getBattleViewportBounds(battle);
    const dimension = axis === 'vertical' ? view.width : view.height;
    const viewStart = axis === 'vertical' ? view.left : view.top;
    const viewEnd = viewStart + dimension;
    const playerCoord = axis === 'vertical' ? battle.playerX : battle.playerY;
    const margin = axis === 'vertical' ? BOSS_SAFE_WINDOW_EDGE_MARGIN_X : BOSS_SAFE_WINDOW_EDGE_MARGIN_Y;
    const minCenter = viewStart + margin + span * 0.5;
    const maxCenter = viewEnd - margin - span * 0.5;
    if (battle.bossSafeWindowMoments <= 0) {
      return clamp(playerCoord, minCenter, maxCenter);
    }
    const targetDistance = this.getBossSafeWindowTargetDistance(axis);
    const positiveTravelMax = Math.max(0, maxCenter - playerCoord);
    const negativeTravelMax = Math.max(0, playerCoord - minCenter);
    const preferredSign = anchoredLane >= playerCoord ? 1 : -1;
    const preferredTravelMax = preferredSign > 0 ? positiveTravelMax : negativeTravelMax;
    const alternateTravelMax = preferredSign > 0 ? negativeTravelMax : positiveTravelMax;
    const travelSign =
      preferredTravelMax >= Math.min(targetDistance, 48) || preferredTravelMax >= alternateTravelMax - 16
        ? preferredSign
        : -preferredSign;
    const resolvedTravelMax = travelSign > 0 ? positiveTravelMax : negativeTravelMax;
    const resolvedTravelDistance = Math.min(targetDistance, resolvedTravelMax);
    const center = playerCoord + travelSign * resolvedTravelDistance;
    return clamp(center, minCenter, maxCenter);
  }

  private chooseBossPressureSafePocketCenter(
    battle: BattleState,
    spanX: number,
    spanY: number,
    shiftType: PressurePocketShiftModeId,
    anchorX: number,
    anchorY: number,
  ): { x: number; y: number } {
    const view = this.getBattleViewportBounds(battle);
    const halfX = spanX * 0.5;
    const halfY = spanY * 0.5;
    const minX = view.left + BOSS_SAFE_WINDOW_EDGE_MARGIN_X + halfX;
    const maxX = view.right - BOSS_SAFE_WINDOW_EDGE_MARGIN_X - halfX;
    const minY = view.top + BOSS_SAFE_WINDOW_EDGE_MARGIN_Y + halfY;
    const maxY = view.bottom - BOSS_SAFE_WINDOW_EDGE_MARGIN_Y - halfY;
    if (battle.bossSafeWindowMoments <= 0) {
      return {
        x: clamp(battle.playerX, minX, maxX),
        y: clamp(battle.playerY, minY, maxY),
      };
    }
    const targetDistance = this.getBossSafeWindowTargetDistance('pocket');
    const directionX = anchorX - battle.playerX;
    const directionY = anchorY - battle.playerY;
    const directionLength = Math.hypot(directionX, directionY);
    const fallbackAngle = this.getBossPressurePocketFallbackAngle(battle, shiftType);
    const baseAngle = directionLength > 1 ? Math.atan2(directionY, directionX) : fallbackAngle;
    const lateralSign = battle.pressurePatternPulseCount % 2 === 0 ? 1 : -1;
    const angleOffsets = [0, 0.42 * lateralSign, -0.42 * lateralSign, 0.82 * lateralSign, -0.82 * lateralSign];
    const radialOffsets = [0, -28, 26];
    let bestCandidate = {
      x: clamp(anchorX, minX, maxX),
      y: clamp(anchorY, minY, maxY),
    };
    let bestScore = Number.POSITIVE_INFINITY;

    for (const angleOffset of angleOffsets) {
      const angle = baseAngle + angleOffset;
      const dirX = Math.cos(angle);
      const dirY = Math.sin(angle);
      for (const radialOffset of radialOffsets) {
        const rawX = battle.playerX + dirX * (targetDistance + radialOffset);
        const rawY = battle.playerY + dirY * (targetDistance + radialOffset);
        const candidateX = clamp(rawX, minX, maxX);
        const candidateY = clamp(rawY, minY, maxY);
        const centerDistance = Math.hypot(candidateX - battle.playerX, candidateY - battle.playerY);
        const anchorDrift = Math.hypot(candidateX - anchorX, candidateY - anchorY);
        const clampLoss = Math.hypot(candidateX - rawX, candidateY - rawY);
        const score =
          Math.abs(centerDistance - targetDistance) +
          anchorDrift * 0.18 +
          clampLoss * 0.52;

        if (score < bestScore) {
          bestScore = score;
          bestCandidate = { x: candidateX, y: candidateY };
        }
      }
    }

    return bestCandidate;
  }

  private getBossPressurePocketFallbackAngle(
    battle: BattleState,
    shiftType: PressurePocketShiftModeId,
  ): number {
    const baseAngle =
      shiftType === 'edgeBounce'
        ? Math.PI * 0.18
        : shiftType === 'centerReset'
          ? -Math.PI * 0.5
          : -Math.PI * 0.28;
    return baseAngle + Math.max(0, battle.pressurePatternPulseCount - 1) * 0.46;
  }

  private getPressurePocketShiftType(
    battle: BattleState,
    phase: BattlePressurePhaseDefinition,
  ): PressurePocketShiftModeId {
    const shiftModes: PressurePocketShiftModeId[] =
      phase.patternPocketShiftModes?.length ? phase.patternPocketShiftModes : ['sweep'];
    const pulseIndex = Math.max(0, battle.pressurePatternPulseCount - 1);
    return shiftModes[pulseIndex % shiftModes.length] ?? 'sweep';
  }

  private getPressurePocketShiftProfile(shiftType: PressurePocketShiftModeId): {
    anchors: Array<{ x: number; y: number }>;
    playerBlend: number;
    widthScale: number;
    heightScale: number;
    lingerScale: number;
  } {
    switch (shiftType) {
      case 'centerReset':
        return {
          anchors: [
            { x: 0.5, y: 0.5 },
            { x: 0.34, y: 0.36 },
            { x: 0.5, y: 0.5 },
            { x: 0.66, y: 0.64 },
            { x: 0.5, y: 0.5 },
          ],
          playerBlend: 0.18,
          widthScale: 1.08,
          heightScale: 1.06,
          lingerScale: 1.08,
        };
      case 'edgeBounce':
        return {
          anchors: [
            { x: 0.24, y: 0.3 },
            { x: 0.76, y: 0.3 },
            { x: 0.8, y: 0.7 },
            { x: 0.2, y: 0.7 },
            { x: 0.2, y: 0.5 },
            { x: 0.8, y: 0.5 },
          ],
          playerBlend: 0.14,
          widthScale: 0.92,
          heightScale: 0.94,
          lingerScale: 0.9,
        };
      case 'sweep':
      default:
        return {
          anchors: [
            { x: 0.34, y: 0.36 },
            { x: 0.66, y: 0.36 },
            { x: 0.64, y: 0.66 },
            { x: 0.36, y: 0.66 },
            { x: 0.5, y: 0.5 },
          ],
          playerBlend: 0.22,
          widthScale: 1,
          heightScale: 1,
          lingerScale: 1,
        };
    }
  }

  private collectPressureSlotPositions(
    dimension: number,
    margin: number,
    shotSlots: number,
    safeStart: number,
    safeEnd: number,
  ): number[] {
    const slotPositions: number[] = [];
    const safePadding = 30;

    for (let index = 0; index < shotSlots; index += 1) {
      const ratio = shotSlots === 1 ? 0.5 : index / (shotSlots - 1);
      const position = margin + ratio * (dimension - margin * 2);
      if (position > safeStart - safePadding && position < safeEnd + safePadding) {
        continue;
      }
      slotPositions.push(position);
    }

    if (slotPositions.length === 0) {
      slotPositions.push(
        clamp(safeStart - (safePadding + 18), margin, dimension - margin),
        clamp(safeEnd + safePadding + 18, margin, dimension - margin),
      );
    }

    return slotPositions;
  }

  private isPointInsidePressureSafeWindow(
    battle: BattleState,
    x: number,
    y: number,
    padding = 0,
  ): boolean {
    if (!battle.pressureSafeWindowAxis || battle.pressureSafeWindowSec <= 0 || battle.pressureSafeWindowSpan <= 0) {
      return false;
    }

    const safeStartX = battle.pressureSafeWindowCenter - battle.pressureSafeWindowSpan * 0.5 - padding;
    const safeEndX = battle.pressureSafeWindowCenter + battle.pressureSafeWindowSpan * 0.5 + padding;

    if (battle.pressureSafeWindowAxis === 'vertical') {
      return x >= safeStartX && x <= safeEndX;
    }

    if (battle.pressureSafeWindowAxis === 'horizontal') {
      return y >= safeStartX && y <= safeEndX;
    }

    if (battle.pressureSafeWindowSecondarySpan <= 0) {
      return false;
    }

    const safeStartY = battle.pressureSafeWindowSecondaryCenter - battle.pressureSafeWindowSecondarySpan * 0.5 - padding;
    const safeEndY = battle.pressureSafeWindowSecondaryCenter + battle.pressureSafeWindowSecondarySpan * 0.5 + padding;
    return x >= safeStartX && x <= safeEndX && y >= safeStartY && y <= safeEndY;
  }

  private getDistanceOutsidePressureSafeWindow(battle: BattleState, x: number, y: number, padding = 0): number {
    if (!battle.pressureSafeWindowAxis || battle.pressureSafeWindowSec <= 0 || battle.pressureSafeWindowSpan <= 0) {
      return 0;
    }

    const halfX = battle.pressureSafeWindowSpan * 0.5 + padding;
    const dx = Math.max(0, Math.abs(x - battle.pressureSafeWindowCenter) - halfX);

    if (battle.pressureSafeWindowAxis === 'vertical') {
      return dx;
    }

    if (battle.pressureSafeWindowAxis === 'horizontal') {
      return Math.max(0, Math.abs(y - battle.pressureSafeWindowCenter) - halfX);
    }

    if (battle.pressureSafeWindowSecondarySpan <= 0) {
      return dx;
    }

    const halfY = battle.pressureSafeWindowSecondarySpan * 0.5 + padding;
    const dy = Math.max(0, Math.abs(y - battle.pressureSafeWindowSecondaryCenter) - halfY);
    return Math.hypot(dx, dy);
  }

  private refreshBossSafeWindowGrace(battle: BattleState): void {
    if (battle.encounterType !== 'boss') {
      return;
    }

    const distance = this.getDistanceOutsidePressureSafeWindow(battle, battle.playerX, battle.playerY, 12);
    if (distance <= 0) {
      battle.bossSafeWindowGraceSec = 0;
      battle.outsideSafeDamageTimerSec = 0;
      return;
    }

    const moveSpeed = Math.max(120, getPlayerMoveSpeed(this.state.stats));
    battle.bossSafeWindowGraceSec = clamp(distance / moveSpeed + 0.28, 0.58, 1.18);
    battle.outsideSafeDamageTimerSec = 0;
  }

  private applyBossSafeWindowPenalty(battle: BattleState, dt: number): void {
    if (battle.encounterType !== 'boss' || battle.pressureSafeWindowSec <= 0) {
      battle.bossSafeWindowGraceSec = 0;
      battle.outsideSafeDamageTimerSec = 0;
      return;
    }

    const inside = this.isPointInsidePressureSafeWindow(battle, battle.playerX, battle.playerY, 12);

    if (inside) {
      // 安全区内：极短保护 + 清理贴脸敌人
      battle.invulnerableSec = Math.max(battle.invulnerableSec, 0.08);
      battle.bossSafeWindowGraceSec = 0;
      battle.outsideSafeDamageTimerSec = 0;
      this.clearBossSafeWindowBlockers(battle);
      return;
    }

    if (battle.bossSafeWindowGraceSec > 0) {
      battle.bossSafeWindowGraceSec = Math.max(0, battle.bossSafeWindowGraceSec - dt);
      battle.outsideSafeDamageTimerSec = 0;
      return;
    }

    // 安全区外：可感知 tick 伤害
    // 用冷却控制每 0.35s 左右触发一次
    const tickInterval = 0.35;
    battle.outsideSafeDamageTimerSec = (battle.outsideSafeDamageTimerSec || 0) + dt;

    if (battle.outsideSafeDamageTimerSec >= tickInterval) {
      battle.outsideSafeDamageTimerSec = 0;
      battle.outsideSafeDamageTickCount = (battle.outsideSafeDamageTickCount || 0) + 1;

      const template = BATTLE_TEMPLATES[battle.templateId];
      const damagePerTick = Math.max(
        8,
        this.getContactDamage(template, this.getCurrentBattleIndex(), this.state.phase, battle.difficultyScale, 0.35),
      );

      // 扣除伤害
      this.state.stats.hp = clamp(this.state.stats.hp - damagePerTick, 0, this.state.stats.maxHp);

      // 视觉反馈：玩家伤害闪烁 + 近失提示 + 威胁方向
      battle.playerDamageFlashSec = Math.max(battle.playerDamageFlashSec, 0.22);
      battle.playerNearMissSec = Math.max(battle.playerNearMissSec, 0.18);

      // 威胁方向指向安全区中心
      this.registerPlayerThreatDirection(
        battle,
        battle.pressureSafeWindowCenter,
        battle.pressureSafeWindowSecondaryCenter,
        0.18,
      );

      // 音频反馈：pressure 音效
      this.services.audio.play('pressure');
    }
  }

  private clearBossSafeWindowBlockers(battle: BattleState): void {
    if (battle.encounterType !== 'boss' || !battle.pressureSafeWindowAxis) {
      return;
    }

    for (const enemy of battle.enemies) {
      if (enemy.elite) {
        continue;
      }

      const blocksWindow = this.isPointInsidePressureSafeWindow(battle, enemy.x, enemy.y, enemy.radius + 44);
      const blocksPlayer = Math.hypot(enemy.x - battle.playerX, enemy.y - battle.playerY) <= enemy.radius + 72;
      if (!blocksWindow && !blocksPlayer) {
        continue;
      }

      const angle = Math.atan2(enemy.y - battle.playerY, enemy.x - battle.playerX);
      const pushDistance = 104 + enemy.radius * 1.6;
      enemy.x = clamp(enemy.x + Math.cos(angle) * pushDistance, 24, ARENA_WIDTH - 24);
      enemy.y = clamp(enemy.y + Math.sin(angle) * pushDistance, 24, ARENA_HEIGHT - 24);
      enemy.recoverySec = Math.max(enemy.recoverySec, 0.28);
      enemy.rangedCooldownSec = Math.max(enemy.rangedCooldownSec, 0.38);
    }
  }

  private getPressureProjectileStats(
    battle: BattleState,
    damageMultiplier: number,
  ): { projectileSpeed: number; projectileDamage: number } {
    const currentPhase = this.getActivePressurePhase(battle);
    return {
      projectileSpeed: 252 * (currentPhase?.rangedProjectileSpeedMultiplier ?? 1),
      projectileDamage: Math.max(
        6,
        Math.round(
          this.getContactDamage(
            BATTLE_TEMPLATES[battle.templateId],
            this.getCurrentBattleIndex(),
            this.state.phase,
            battle.difficultyScale,
            damageMultiplier,
          ),
        ),
      ),
    };
  }

  private spawnPressureWallShots(
    battle: BattleState,
    phase: BattlePressurePhaseDefinition,
    axis: PressureSafeWindowAxis,
  ): void {
    if (battle.pressureSafeWindowSpan <= 0) {
      return;
    }

    const view = this.getBattleViewportBounds(battle);
    const dimension = axis === 'vertical' ? view.width : view.height;
    const offset = axis === 'vertical' ? view.left : view.top;
    const margin = axis === 'vertical' ? 72 : 58;
    const shotSlots = Math.max(4, phase.patternWallShotCount ?? (axis === 'vertical' ? 7 : 6));
    const safeStart = battle.pressureSafeWindowCenter - battle.pressureSafeWindowSpan * 0.5 - offset;
    const safeEnd = battle.pressureSafeWindowCenter + battle.pressureSafeWindowSpan * 0.5 - offset;
    const slotPositions = this.collectPressureSlotPositions(dimension, margin, shotSlots, safeStart, safeEnd).map(
      (position) => position + offset,
    );
    const { projectileSpeed, projectileDamage } = this.getPressureProjectileStats(battle, 0.7);

    for (const position of slotPositions) {
      if (axis === 'vertical') {
        this.spawnEnemyProjectile(battle, position, view.top - 22, projectileSpeed, projectileDamage, 6, Math.PI / 2, {
          respectsSafeWindow: true,
        });
        this.spawnEnemyProjectile(
          battle,
          position,
          view.bottom + 22,
          projectileSpeed,
          projectileDamage,
          6,
          -Math.PI / 2,
          {
            respectsSafeWindow: true,
          },
        );
        continue;
      }

      this.spawnEnemyProjectile(battle, view.left - 22, position, projectileSpeed, projectileDamage, 6, 0, {
        respectsSafeWindow: true,
      });
      this.spawnEnemyProjectile(battle, view.right + 22, position, projectileSpeed, projectileDamage, 6, Math.PI, {
        respectsSafeWindow: true,
      });
    }
  }

  private spawnPressurePocketShots(battle: BattleState, phase: BattlePressurePhaseDefinition): void {
    if (battle.pressureSafeWindowAxis !== 'pocket' || battle.pressureSafeWindowSpan <= 0) {
      return;
    }

    const view = this.getBattleViewportBounds(battle);
    const shiftType = battle.pressureSafeWindowShiftType ?? 'sweep';
    const safeStartX = battle.pressureSafeWindowCenter - battle.pressureSafeWindowSpan * 0.5;
    const safeEndX = battle.pressureSafeWindowCenter + battle.pressureSafeWindowSpan * 0.5;
    const safeStartY = battle.pressureSafeWindowSecondaryCenter - battle.pressureSafeWindowSecondarySpan * 0.5;
    const safeEndY = battle.pressureSafeWindowSecondaryCenter + battle.pressureSafeWindowSecondarySpan * 0.5;
    const horizontalSlotCount = Math.max(4, (phase.patternWallShotCount ?? 5) + (shiftType === 'edgeBounce' ? 1 : 0));
    const verticalSlotCount = Math.max(
      4,
      (phase.patternWallShotCount ?? 5) - 1 + (shiftType === 'centerReset' ? -1 : 0),
    );
    const xMargin = shiftType === 'edgeBounce' ? 72 : 84;
    const yMargin = shiftType === 'centerReset' ? 76 : 68;
    const xSlots = this.collectPressureSlotPositions(
      view.width,
      xMargin,
      horizontalSlotCount,
      safeStartX - view.left,
      safeEndX - view.left,
    ).map((position) => position + view.left);
    const ySlots = this.collectPressureSlotPositions(
      view.height,
      yMargin,
      verticalSlotCount,
      safeStartY - view.top,
      safeEndY - view.top,
    ).map((position) => position + view.top);
    const damageMultiplier = shiftType === 'centerReset' ? 0.64 : shiftType === 'edgeBounce' ? 0.7 : 0.68;
    const { projectileSpeed, projectileDamage } = this.getPressureProjectileStats(battle, damageMultiplier);

    for (const x of xSlots) {
      this.spawnEnemyProjectile(battle, x, view.top - 24, projectileSpeed, projectileDamage, 6, Math.PI / 2, {
        respectsSafeWindow: true,
      });
      this.spawnEnemyProjectile(
        battle,
        x,
        view.bottom + 24,
        projectileSpeed,
        projectileDamage,
        6,
        -Math.PI / 2,
        {
          respectsSafeWindow: true,
        },
      );
    }

    for (const y of ySlots) {
      this.spawnEnemyProjectile(battle, view.left - 24, y, projectileSpeed, projectileDamage, 6, 0, {
        respectsSafeWindow: true,
      });
      this.spawnEnemyProjectile(battle, view.right + 24, y, projectileSpeed, projectileDamage, 6, Math.PI, {
        respectsSafeWindow: true,
      });
    }
  }

  private finishBattleOnPlayerDefeat(battle: BattleState): boolean {
    if (this.state.stats.hp > 0 || this.state.status === 'result' || this.state.battle !== battle) {
      return false;
    }

    this.finalizeBossPressureMetrics(battle);
    this.services.metrics.recordBattleCompleted(
      battle.templateId,
      'loss',
      BATTLE_TEMPLATES[battle.templateId].contentTier,
      this.getBattleMonitoringSummary(battle),
    );
    // Boss 战失败：显示专属收尾画面
    if (battle.encounterType === 'boss') {
      this.state.status = 'bossEnding';
      this.state.bossEnding = {
        outcome: 'defeat',
        label: '机体失效 / Boss 未击破',
        elapsedSec: 0,
        durationSec: 1.5,
      };
      this.enqueueAudio('defeat');
      return true;
    }
    this.finishRun('defeat', 'hpDepleted');
    return true;
  }

  private recordBossPhaseMetrics(
    battle: BattleState,
    phase: BattlePressurePhaseDefinition,
    durationSec: number,
  ): void {
    this.services.metrics.recordBossPhaseDuration(
      battle.templateId,
      phase.id,
      phase.label,
      durationSec,
    );
    if (phase.patternLabel) {
      this.services.metrics.recordBossPhasePatternDuration(
        battle.templateId,
        phase.id,
        phase.label,
        phase.patternLabel,
        durationSec,
      );
    }
  }

  private finalizeBossPressureMetrics(battle: BattleState): void {
    if (battle.encounterType !== 'boss') {
      return;
    }

    const activePhase = this.getActivePressurePhase(battle);
    if (!activePhase || battle.pressurePhaseElapsedSec <= 0) {
      return;
    }

    this.recordBossPhaseMetrics(battle, activePhase, battle.pressurePhaseElapsedSec);
  }

  private getBattleMonitoringSummary(battle: BattleState): {
    lateDashWindowMoments: number;
    dashCounterMoments: number;
    eliteCrackSeen: boolean;
    eliteCrackFollowThroughMoments: number;
    bossFirelineCoverage: number;
    bossSafeWindowMoments: number;
    killPickupContinueMoments: number;
  } {
    return {
      lateDashWindowMoments: battle.lateDashWindowMoments,
      dashCounterMoments: battle.dashCounterMoments,
      eliteCrackSeen: battle.eliteCrackSeen,
      eliteCrackFollowThroughMoments: battle.eliteCrackFollowThroughMoments,
      bossFirelineCoverage: battle.bossFirelineCoverage,
      bossSafeWindowMoments: battle.bossSafeWindowMoments,
      killPickupContinueMoments: battle.killPickupContinueMoments,
    };
  }

  private isLateDashMonitoringPhase(): boolean {
    return this.state.phase === 'late' || this.state.phase === 'finalPrep' || this.state.phase === 'finalBattle';
  }

  private markLateDashWindowMoment(battle: BattleState, strength: number): void {
    if (!this.isLateDashMonitoringPhase() || strength < 0.28 || battle.monitorDashLateMomentCooldownSec > 0) {
      return;
    }

    battle.lateDashWindowMoments += 1;
    battle.monitorDashLateMomentCooldownSec = 0.34;
  }

  private markDashCounterMoment(battle: BattleState, strength: number): void {
    if (strength < 0.24 || battle.monitorDashCounterCooldownSec > 0) {
      return;
    }

    battle.dashCounterMoments += 1;
    battle.monitorDashCounterCooldownSec = 0.42;
  }

  private markEliteCrackFollowThroughMoment(battle: BattleState, strength: number): void {
    if (strength < 0.18 || battle.monitorEliteCrackFollowThroughCooldownSec > 0) {
      return;
    }

    battle.eliteCrackFollowThroughMoments += 1;
    battle.monitorEliteCrackFollowThroughCooldownSec = 0.28;
  }

  private markKillPickupContinueMoment(battle: BattleState, strength: number): void {
    if (strength < 0.22 || battle.monitorKillPickupContinueCooldownSec > 0) {
      return;
    }

    battle.killPickupContinueMoments += 1;
    battle.monitorKillPickupContinueCooldownSec = 0.46;
  }

  private updatePressurePhase(battle: BattleState): void {
    const template = BATTLE_TEMPLATES[battle.templateId];
    const phases = template.eliteRule?.pressurePhases;
    if (!battle.eliteAlive || !phases || phases.length === 0) {
      return;
    }

    const eliteEnemy = battle.enemies.find((enemy) => enemy.elite);
    if (!eliteEnemy) {
      return;
    }

    const currentPhase = this.getActivePressurePhase(battle);
    if (currentPhase && battle.pressurePhaseElapsedSec < (currentPhase.minResidenceSec ?? 0)) {
      return;
    }

    const nextIndex = battle.pressurePhaseIndex + 1;
    if (nextIndex < 0 || nextIndex >= phases.length) {
      return;
    }

    const nextPhase = phases[nextIndex];
    const hpTriggered =
      nextPhase.triggerHpRatio !== undefined && eliteEnemy.hp / Math.max(1, eliteEnemy.maxHp) <= nextPhase.triggerHpRatio;
    const timeTriggered =
      nextPhase.triggerRemainingSec !== undefined && battle.remainingSec <= nextPhase.triggerRemainingSec;
    if (!hpTriggered && !timeTriggered) {
      return;
    }

    if (battle.encounterType === 'boss' && currentPhase) {
      this.recordBossPhaseMetrics(battle, currentPhase, battle.pressurePhaseElapsedSec);
    }

    battle.pressurePhaseIndex = nextIndex;
    battle.pressurePhaseLabel = nextPhase.label;
    battle.pressurePhaseElapsedSec = 0;
    battle.pressureTransitionSec = Math.max(battle.pressureTransitionSec, 1.15);

    if ((nextPhase.entryGuardSec ?? 0) > 0) {
      eliteEnemy.guardSec = Math.max(eliteEnemy.guardSec, nextPhase.entryGuardSec ?? 0);
      eliteEnemy.guardDamageMultiplier = Math.min(
        eliteEnemy.guardDamageMultiplier,
        nextPhase.entryGuardDamageMultiplier ?? eliteEnemy.guardDamageMultiplier,
      );
    }

    if ((template.eliteRule?.escortBatch ?? 0) > 0) {
      battle.eliteSupportCooldownSec = Math.min(
        battle.eliteSupportCooldownSec,
        Math.max(0.75, this.getEliteEscortRespawnSec(template, battle) * 0.55),
      );
    }

    this.spawnPhaseEscortBurst(battle, nextPhase.entryEscortBurst ?? 0);
    this.activatePressureSignature(battle, nextPhase);
    this.activatePressurePattern(battle, nextPhase);
    if (battle.encounterType === 'boss') {
      this.services.metrics.recordBossPhaseEntered(battle.templateId, nextPhase.id, nextPhase.label);
    }
    this.enqueueTip(`${battle.encounterType === 'boss' ? 'Boss 转段' : '精英转段'}：${nextPhase.label}`);
    this.enqueueAudio(battle.encounterType === 'boss' ? 'boss' : 'pressure');
  }

  private completeBattle(): void {
    const battle = this.state.battle;
    if (!battle) {
      return;
    }

    this.state.battleWins += 1;
    this.finalizeBossPressureMetrics(battle);
    this.services.metrics.recordBattleCompleted(
      battle.templateId,
      'win',
      BATTLE_TEMPLATES[battle.templateId].contentTier,
      this.getBattleMonitoringSummary(battle),
    );
    const completionExp = getBattleCompletionExperience(
      BATTLE_TEMPLATES[battle.templateId],
      this.getCurrentBattleIndex(),
      this.state.phase,
    );
    const template = BATTLE_TEMPLATES[battle.templateId];
    const earnedTimedReward =
      battle.encounterType !== 'boss' && template.winCondition.type !== 'survive' && battle.remainingSec > 0;
    this.enqueueTip(`${battle.label || BATTLE_TEMPLATES[battle.templateId].name}完成`);
    if (earnedTimedReward) {
      this.state.queuedLevelUps += 1;
      this.state.queuedRewardUpgrades += 1;
      this.enqueueTip('奖励倒计时达成：额外强化 +1');
    }
    if (battle.encounterType !== 'boss') {
      this.advanceAfterPendingUpgrades = true;
    }
    this.gainExperience(completionExp);

    // Boss 战结束：显示专属收尾画面
    if (battle.encounterType === 'boss') {
      this.state.status = 'bossEnding';
      this.state.bossEnding = {
        outcome: 'victory',
        label: '首领击破 / 任务完成',
        elapsedSec: 0,
        durationSec: 1.5, // 停留 1.5 秒
      };
      this.enqueueAudio('victory');
      return;
    }

    if (this.state.queuedLevelUps > 0) {
      this.openQueuedLevelUpPanel();
      return;
    }
    this.advanceAfterPendingUpgrades = false;

    // 普通战斗结束：添加过渡状态，避免瞬间进入关卡选择
    this.state.status = 'phaseTransition';
    this.state.phaseTransition = {
      label: `${battle.label || BATTLE_TEMPLATES[battle.templateId].name}完成`,
      elapsedSec: 0,
      durationSec: 1.2, // 停留 1.2 秒
    };
    this.enqueueAudio('victory');

    // 注意：不再直接调用 advanceRound()，过渡结束后由 tick() 处理
  }

  private advanceRound(): void {
    this.state.round += 1;
    if (this.state.round > this.state.totalRounds) {
      this.finishRun('victory', 'victory');
      return;
    }

    const focusRoute = this.getDominantRoute();
    const lastTraversedNode = this.state.traversedNodes[this.state.traversedNodes.length - 1] ?? null;
    const nextNodes = buildNodeOptions(this.state.round, focusRoute, {
      lastNodeType: lastTraversedNode?.type ?? this.state.currentNode?.type ?? null,
      battleWins: this.state.battleWins,
      hpRatio: this.state.stats.hp / Math.max(1, this.state.stats.maxHp),
    });

    this.state.phase = nextNodes[0]?.phase ?? this.state.phase;
    this.state.status = 'nodeChoice';
    this.state.nodeOptions = nextNodes;
    this.state.currentNode = null;
    this.state.currentEvent = null;
    this.state.upgradeChoices = [];
    this.state.upgradeSource = null;
    this.state.battle = null;
    this.enqueuePhaseAdvanceFeedback(nextNodes);
  }

  private finishRun(outcome: RunOutcome, endingKind: RunEndingKind): void {
    const routeId = this.getResultRoute();
    const buildStage = this.getBuildStage();
    const buildLabel = getBuildStageLabel(buildStage);
    const buildSummary = this.getBuildSummary(routeId, buildStage);
    const endingLabel = getEndingLabel(endingKind);
    const finalNodeTitle = this.state.currentNode?.title ?? getPhaseLabel(this.state.phase);
    const finalNodeType = this.state.currentNode?.type ?? null;
    const endingReason = this.getEndingReason(endingKind, finalNodeTitle);
    const summary = this.getResultSummary(outcome, routeId, buildStage);
    const routeTrace = this.buildRouteTrace();
    const replayPrompt = this.getReplayPrompt(outcome, routeId, buildStage, endingKind);
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
      finalNodeType,
      runDurationSec,
      nodesCleared,
      battleWins: this.state.battleWins,
      levelReached: this.state.level,
      routeTrace,
      replayPrompt,
      selectedUpgrades: this.state.selectedUpgrades
        .map((id) => UPGRADE_ARCHETYPES.find((u) => u.id === id))
        .filter((u): u is UpgradeDefinition => u !== undefined),
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
      finalNodeType,
      battleWins: this.state.battleWins,
      nodesCleared,
    });
    this.enqueueAudio(outcome === 'victory' ? 'victory' : 'defeat');
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

  private buildRouteTrace(): NodeRecord[] {
    const routeTrace = [...this.state.traversedNodes];

    if (this.state.currentNode) {
      const lastNode = routeTrace[routeTrace.length - 1];
      if (!lastNode || lastNode.id !== this.state.currentNode.id) {
        routeTrace.push({
          id: this.state.currentNode.id,
          type: this.state.currentNode.type,
          title: this.state.currentNode.title,
        });
      }
    }

    return routeTrace.slice(-6);
  }

  private getAnomalyVisitCount(): number {
    const visited = this.state.traversedNodes.filter((node) => node.type === 'anomaly').length;
    return visited + (this.state.currentNode?.type === 'anomaly' ? 1 : 0);
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

  private getReplayPrompt(
    outcome: RunOutcome,
    routeId: RouteId | null,
    buildStage: RouteBuildStage,
    endingKind: RunEndingKind,
  ): string {
    const replayProfile = this.getReplayProfile(routeId);
    if (!routeId) {
      return '再来一局优先把前段节奏立住，主路线会更容易自然站稳。';
    }

    const routeName = ROUTE_NAME_MAP[routeId];
    if (outcome === 'victory') {
      if (buildStage === 'matured') {
        if (replayProfile.bossEchoHits === 0 && replayProfile.rarePayoffHits === 0) {
          return `${routeName}路线这一局已经跑通，下局试着去撞一拍首领残响或尾段稀有收束，结尾会更像另一种 run。`;
        }
        if (replayProfile.hybridHits + replayProfile.redirectHits >= 2) {
          return `${routeName}路线这一局是带着偏航味道跑通的，下局反过来压纯收尾，会更像另一种打法。`;
        }
        if (replayProfile.hybridHits === 0 && replayProfile.redirectHits === 0) {
          return `${routeName}路线这一局已经跑通，下局可以故意留一段混搭或改线窗口，看它怎么把尾段带偏。`;
        }
        return `${routeName}路线这一局已经跑通，再开一局可以换另一种尾段读法，看看这条线怎么收。`;
      }
      if (replayProfile.rarePayoffHits === 0) {
        return `${routeName}路线已经站住了，下局试着撞一张尾段高收益牌，会更容易把结尾拉开。`;
      }
      if (replayProfile.bossEchoHits > 0 && replayProfile.rarePayoffHits > 0) {
        return `${routeName}路线已经站住了，这局还吃到了首领残响和尾段高收益；下局换一条收尾线，会更像另一种 run。`;
      }
      if (replayProfile.anomalyVisits === 0 || replayProfile.hybridHits === 0) {
        return `${routeName}路线已经站住了，下局多去撞低频异常和混搭窗口，会更容易读到另一种尾段。`;
      }
      return `${routeName}路线已经站住了，再来一局可以继续把它压到完整成型。`;
    }

    if (endingKind === 'timeOut') {
      if (replayProfile.rarePayoffHits === 0) {
        return `${routeName}路线已经起势，再来一局多去找尾段高收益牌，通常会更容易把最后一段撑厚。`;
      }
      if (replayProfile.bossEchoHits === 0) {
        return `${routeName}路线已经起势，再来一局试着提前吃到首领残响式预读，最后一段会更好接。`;
      }
      return `${routeName}路线已经起势，再来一局重点补最后一段输出和转场决策。`;
    }
    if (buildStage === 'matured' || buildStage === 'committed') {
      if (replayProfile.hybridHits + replayProfile.redirectHits >= 2) {
        return `${routeName}路线已经起势，但这局偏航偏得有点深；下局早点补锚点，收尾会更稳。`;
      }
      if (replayProfile.rarePayoffHits === 0 || replayProfile.routeRareHits === 0) {
        return `${routeName}路线已经起势，再来一局把尾段高收益和路线收尾补上，会更容易完整落地。`;
      }
      if (replayProfile.anomalyVisits === 0) {
        return `${routeName}路线已经起势，再来一局把异常窗口也接上，会更容易看到另一种结尾。`;
      }
      return `${routeName}路线已经起势，再来一局重点把最后一段耐久和收束补齐。`;
    }
    return `${routeName}倾向已经出现，再来一局把前中段节奏接稳，会更容易看到完整收尾。`;
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

  private getSelectedUpgradeArchetypes(): UpgradeArchetype[] {
    const pickedIds = new Set(this.state.selectedUpgrades);
    return UPGRADE_ARCHETYPES.filter((archetype) => pickedIds.has(archetype.id));
  }

  private hasAnyUpgradeTag(tags: string[] | undefined, expected: string[]): boolean {
    return expected.some((tag) => tags?.includes(tag));
  }

  private isRarePayoffEvent(record: PickedEventRecord): boolean {
    return Boolean(
      record.contentTier === 'rare' &&
        (record.isLatePayoff || record.anomalyClass === 'bossEcho' || record.anomalyClass === 'hybrid'),
    );
  }

  private getReplayProfile(routeId: RouteId | null): {
    anomalyVisits: number;
    hybridHits: number;
    redirectHits: number;
    latePayoffHits: number;
    rarePayoffHits: number;
    bossEchoHits: number;
    routeRareHits: number;
  } {
    const pickedUpgrades = this.getSelectedUpgradeArchetypes();
    const pickedEvents = this.state.eventHistory;

    const hybridHits =
      pickedUpgrades.filter((archetype) => this.hasAnyUpgradeTag(archetype.tags, ['hybrid'])).length +
      pickedEvents.filter((record) => record.isHybridPick || record.anomalyClass === 'hybrid').length;
    const redirectHits =
      pickedUpgrades.filter((archetype) => this.hasAnyUpgradeTag(archetype.tags, ['redirect'])).length +
      pickedEvents.filter((record) => record.isRedirectPick).length;
    const latePayoffHits =
      pickedUpgrades.filter((archetype) => this.isLatePayoffTagged(archetype.tags, archetype.contentTier)).length +
      pickedEvents.filter((record) => record.isLatePayoff).length;
    const rarePayoffHits =
      pickedUpgrades.filter(
        (archetype) =>
          archetype.contentTier === 'rare' && this.hasAnyUpgradeTag(archetype.tags, ['payoff', 'finisher', 'hybrid']),
      ).length + pickedEvents.filter((record) => this.isRarePayoffEvent(record)).length;
    const bossEchoHits = pickedEvents.filter((record) => record.anomalyClass === 'bossEcho').length;
    const routeRareHits =
      routeId === null
        ? 0
        : pickedUpgrades.filter((archetype) => archetype.routeId === routeId && archetype.contentTier === 'rare').length;

    return {
      anomalyVisits: this.getAnomalyVisitCount(),
      hybridHits,
      redirectHits,
      latePayoffHits,
      rarePayoffHits,
      bossEchoHits,
      routeRareHits,
    };
  }

  private isHybridTagged(tags: string[] | undefined): boolean {
    return Boolean(tags?.some((tag) => tag === 'hybrid' || tag === 'redirect'));
  }

  private isRedirectUpgradePick(
    upgrade: UpgradeDefinition,
    previousDominantRoute: RouteId | null,
  ): boolean {
    return Boolean(
      previousDominantRoute &&
        upgrade.routeId &&
        upgrade.tags?.includes('redirect') &&
        upgrade.routeId !== previousDominantRoute,
    );
  }

  private getRedirectUpgradeOfferIds(choices: UpgradeDefinition[]): string[] {
    const dominantRoute = this.getDominantRoute();
    if (!dominantRoute) {
      return [];
    }

    return choices
      .filter(
        (choice) =>
          Boolean(choice.routeId) &&
          choice.tags?.includes('redirect') &&
          choice.routeId !== dominantRoute,
      )
      .map((choice) => choice.sourceId);
  }

  private getRedirectEventOfferIds(eventDef: EventDefinition | null): string[] {
    if (!eventDef) {
      return [];
    }

    const dominantRoute = this.getDominantRoute();
    if (!dominantRoute) {
      return [];
    }

    return eventDef.options
      .filter(
        (option): option is EventOption & { routeId: RouteId } =>
          Boolean(option.routeId) && option.routeId !== 'dominant' && option.routeId !== dominantRoute,
      )
      .map((option) => option.id);
  }

  private recordRedirectUpgradeOffers(choices: UpgradeDefinition[]): void {
    const optionIds = this.getRedirectUpgradeOfferIds(choices);
    if (optionIds.length === 0) {
      return;
    }

    this.services.metrics.recordRedirectOffer({
      phase: this.state.phase,
      source: 'upgrade',
      optionIds,
    });
  }

  private recordRedirectEventOffers(eventDef: EventDefinition | null): void {
    const optionIds = this.getRedirectEventOfferIds(eventDef);
    if (optionIds.length === 0) {
      return;
    }

    this.services.metrics.recordRedirectOffer({
      phase: this.state.phase,
      source: 'event',
      optionIds,
    });
  }

  private isLatePhase(phase: RunState['phase'] = this.state.phase): boolean {
    return phase === 'late' || phase === 'finalPrep' || phase === 'finalBattle';
  }

  private isLatePayoffTagged(tags: string[] | undefined, contentTier?: ContentTier): boolean {
    if (!this.isLatePhase()) {
      return false;
    }
    return contentTier === 'rare' || Boolean(tags?.some((tag) => tag === 'payoff' || tag === 'finisher'));
  }

  private isLatePayoffEvent(eventDef: EventDefinition): boolean {
    return this.isLatePhase() && eventDef.contentTier === 'rare';
  }

  private applyModifiers(modifiers: Partial<PlayerStats>): void {
    const maxHpGain = modifiers.maxHp ?? 0;
    this.state.stats.maxHp += maxHpGain;
    // 加生命上限时同时回复相同数值的血量
    if (maxHpGain > 0) {
      this.state.stats.hp = clamp(this.state.stats.hp + maxHpGain, 0, this.state.stats.maxHp);
    } else {
      this.state.stats.hp = clamp(this.state.stats.hp, 0, this.state.stats.maxHp);
    }
    this.state.stats.damage += modifiers.damage ?? 0;
    this.state.stats.fireRate += modifiers.fireRate ?? 0;
    this.state.stats.projectileSpeed += modifiers.projectileSpeed ?? 0;
    this.state.stats.critChance = clamp(this.state.stats.critChance + (modifiers.critChance ?? 0), 0, 0.85);
    this.state.stats.critMultiplier += modifiers.critMultiplier ?? 0;
    this.state.stats.pierce = clamp(this.state.stats.pierce + (modifiers.pierce ?? 0), 0, 3);
    this.state.stats.multishot = clamp(this.state.stats.multishot + (modifiers.multishot ?? 0), 1, 4);
    this.state.stats.moveSpeed += modifiers.moveSpeed ?? 0;
    this.state.stats.dashInterval = Math.max(1.8, this.state.stats.dashInterval + (modifiers.dashInterval ?? 0));
    this.state.stats.dashPulseDamage += modifiers.dashPulseDamage ?? 0;
    this.state.stats.dashInvulnerability += modifiers.dashInvulnerability ?? 0;
    this.state.stats.regeneration += (modifiers.regeneration ?? 0) * 0.38;
  }

  private applyEffects(effects: ContentEffect[], meta?: RouteAdvanceMeta): void {
    const previousDominantRoute = this.getDominantRoute();
    const maturedRouteBefore = this.state.maturedRoute;
    let routeAdvanced = false;

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
        this.advanceRoute(routeId, meta);
        routeAdvanced = true;
      }
    }

    if (!routeAdvanced || !previousDominantRoute) {
      return;
    }

    const nextDominantRoute = this.getDominantRoute();
    if (
      nextDominantRoute &&
      nextDominantRoute !== previousDominantRoute &&
      !maturedRouteBefore
    ) {
      this.services.metrics.recordBranchSwitch(previousDominantRoute, nextDominantRoute, {
        phase: this.state.phase,
        pickId: meta?.pickId ?? 'route-effect',
      });
    }
  }

  private advanceRoute(routeId: RouteId, meta?: RouteAdvanceMeta): void {
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

    if (
      !this.state.committedRoute &&
      count >= ROUTE_COMMIT_THRESHOLD &&
      otherCounts.every((value) => count >= value + 1)
    ) {
      this.state.committedRoute = routeId;
      this.services.metrics.markRouteCommitted(routeId, {
        phase: this.state.phase,
        pickId: meta?.pickId ?? `route:${routeId}`,
      });
      this.enqueueTip(`${ROUTE_NAME_MAP[routeId]}路线开始站稳`);
    }

    if (
      !this.state.maturedRoute &&
      count >= ROUTE_MATURE_THRESHOLD &&
      otherCounts.every((value) => count >= value + 1)
    ) {
      this.state.maturedRoute = routeId;
      this.services.metrics.markRouteMatured(routeId);
      this.enqueueAudio('routeMatured');
      this.enqueueTip(ROUTES.find((route) => route.id === routeId)?.matureHint ?? '');
    }
  }

  private activateRoutePerkFromTags(tags?: string[]): void {
    if (!tags || tags.length === 0) return;

    const perkMap: Record<string, keyof NonNullable<typeof this.state.activeRoutePerks>> = {
      'pierce-seamkeep': 'pierceSeamkeep',
      'pierce-floodgate': 'pierceFloodgate',
      'pierce-riftbloom': 'pierceRiftbloom',
      'pierce-prism': 'piercePrism',
      'dash-brush': 'dashBrush',
      'dash-sidestep-bank': 'dashSidestepBank',
      'dash-zero-window': 'dashZeroWindow',
      'dash-afterimage': 'dashAfterimage',
      'crit-afterglow': 'critAfterglow',
      'crit-embershard': 'critEmbershard',
      'crit-crownfire': 'critCrownfire',
    };

    for (const tag of tags) {
      const perkKey = perkMap[tag];
      if (perkKey) {
        if (!this.state.activeRoutePerks) {
          this.state.activeRoutePerks = {};
        }
        this.state.activeRoutePerks[perkKey] = true;
      }
    }
  }

  private updatePlayerMovement(battle: BattleState, dt: number): void {
    const bufferedInput = this.getBufferedInputState();
    let moveX = 0;
    let moveY = 0;
    if (bufferedInput.left) {
      moveX -= 1;
    }
    if (bufferedInput.right) {
      moveX += 1;
    }
    if (bufferedInput.up) {
      moveY -= 1;
    }
    if (bufferedInput.down) {
      moveY += 1;
    }

    const hasInput = Math.abs(moveX) > 0 || Math.abs(moveY) > 0;
    const magnitude = hasInput ? Math.hypot(moveX, moveY) : 1;
    const normalizedX = hasInput ? moveX / magnitude : 0;
    const normalizedY = hasInput ? moveY / magnitude : 0;
    const moveSpeed = this.getPlayerMoveSpeed();
    const tempoMoveMultiplier = 1 + Math.min(0.12, battle.tempoPulseSec * 0.28);
    const pierceFlowRatio = this.getPierceFlowRatio(battle);
    const controlFactor = battle.playerImpactSec > 0 ? 0.52 : 1;
    const currentVelocitySpeed = Math.hypot(battle.playerVelocityX, battle.playerVelocityY);
    const currentVelocityDirX = currentVelocitySpeed > 0.01 ? battle.playerVelocityX / currentVelocitySpeed : 0;
    const currentVelocityDirY = currentVelocitySpeed > 0.01 ? battle.playerVelocityY / currentVelocitySpeed : 0;
    const directionDot =
      hasInput && currentVelocitySpeed > 14 ? currentVelocityDirX * normalizedX + currentVelocityDirY * normalizedY : 1;

    if (hasInput && currentVelocitySpeed <= moveSpeed * 0.18 && battle.playerMoveBoostSec <= 0.01) {
      battle.playerMoveBoostSec = 0.2;
      this.createCombatPulse(battle, {
        x: battle.playerX,
        y: battle.playerY,
        radius: 24,
        lifeSec: 0.11,
        color: 0x96ecff,
        secondaryColor: 0xffffff,
        fillAlpha: 0.04,
        strokeAlpha: 0.28,
        strokeWidth: 2,
        growthPerSec: 132,
        innerRadiusRatio: 0.72,
      });
    }

    if (hasInput && currentVelocitySpeed > moveSpeed * 0.16 && directionDot < -0.08) {
      battle.playerTurnBurstSec = Math.max(battle.playerTurnBurstSec, 0.16 + pierceFlowRatio * 0.03);
      battle.tempoPulseSec = Math.max(battle.tempoPulseSec, 0.09 + pierceFlowRatio * 0.03);
    }

    const moveBoostRatio = battle.playerMoveBoostSec > 0 ? Math.min(1, battle.playerMoveBoostSec / 0.2) : 0;
    const turnBurstRatio = battle.playerTurnBurstSec > 0 ? Math.min(1, battle.playerTurnBurstSec / 0.16) : 0;
    const targetSpeed =
      moveSpeed *
      controlFactor *
      tempoMoveMultiplier *
      (1 + moveBoostRatio * 0.15 + turnBurstRatio * 0.075 + pierceFlowRatio * 0.035 + (battle.dashDriveSec > 0 ? 0.09 : 0));
    const desiredVelocityX = normalizedX * targetSpeed;
    const desiredVelocityY = normalizedY * targetSpeed;
    const velocityBlend = hasInput
      ? Math.min(1, dt * (battle.dashDriveSec > 0 ? 19 : turnBurstRatio > 0.08 ? 17.5 : pierceFlowRatio > 0.1 ? 14.5 : 14))
      : Math.min(1, dt * 13.5);
    battle.playerVelocityX += (desiredVelocityX - battle.playerVelocityX) * velocityBlend;
    battle.playerVelocityY += (desiredVelocityY - battle.playerVelocityY) * velocityBlend;
    if (!hasInput) {
      const coastDamping = Math.max(0, 1 - dt * (battle.dashDriveSec > 0 ? 4.2 : 9.2));
      battle.playerVelocityX *= coastDamping;
      battle.playerVelocityY *= coastDamping;
    }
    if (Math.abs(battle.playerVelocityX) < 3) {
      battle.playerVelocityX = 0;
    }
    if (Math.abs(battle.playerVelocityY) < 3) {
      battle.playerVelocityY = 0;
    }

    const resolvedVelocitySpeed = Math.hypot(battle.playerVelocityX, battle.playerVelocityY);
    if (resolvedVelocitySpeed > 0.01) {
      battle.playerMoveDirX = battle.playerVelocityX / resolvedVelocitySpeed;
      battle.playerMoveDirY = battle.playerVelocityY / resolvedVelocitySpeed;
    } else {
      battle.playerMoveDirX = hasInput ? normalizedX : 0;
      battle.playerMoveDirY = hasInput ? normalizedY : 0;
    }

    const knockbackDamping = battle.playerImpactSec > 0 ? 7.5 : 11;
    battle.playerKnockbackVX *= Math.max(0, 1 - dt * knockbackDamping);
    battle.playerKnockbackVY *= Math.max(0, 1 - dt * knockbackDamping);
    if (Math.abs(battle.playerKnockbackVX) < 10) {
      battle.playerKnockbackVX = 0;
    }
    if (Math.abs(battle.playerKnockbackVY) < 10) {
      battle.playerKnockbackVY = 0;
    }

    const nextPlayerX = clamp(
      battle.playerX + battle.playerVelocityX * dt + battle.playerKnockbackVX * dt,
      24,
      ARENA_WIDTH - 24,
    );
    const nextPlayerY = clamp(
      battle.playerY + battle.playerVelocityY * dt + battle.playerKnockbackVY * dt,
      24,
      ARENA_HEIGHT - 24,
    );
    if ((nextPlayerX <= 24 && battle.playerVelocityX < 0) || (nextPlayerX >= ARENA_WIDTH - 24 && battle.playerVelocityX > 0)) {
      battle.playerVelocityX = 0;
    }
    if ((nextPlayerY <= 24 && battle.playerVelocityY < 0) || (nextPlayerY >= ARENA_HEIGHT - 24 && battle.playerVelocityY > 0)) {
      battle.playerVelocityY = 0;
    }
    battle.playerX = nextPlayerX;
    battle.playerY = nextPlayerY;

    battle.dashCooldownSec -= dt;
    if ((this.state.stats.dashPulseDamage <= 0 && this.state.routeCounts.dash <= 0) || battle.dashCooldownSec > 0) {
      return;
    }

    const dashStage = this.getRouteBuildStage('dash');
    const dashCharge = battle.dashCharge;
    const pulseRadius = this.getDashPulseRadius(dashCharge, dashStage);
    const pulseDamage = this.getDashPulseDamage(dashCharge, dashStage);
    let dashPulseHits = 0;

    battle.dashCooldownSec = this.getDashCooldownAfterPulse(dashStage);
    battle.invulnerableSec = this.state.stats.dashInvulnerability + (dashStage === 'matured' ? 0.12 : 0);
    battle.dashDriveSec = Math.max(
      battle.dashDriveSec,
      this.getDashDriveDuration(dashCharge),
    );
    this.createCombatPulse(battle, {
      x: battle.playerX,
      y: battle.playerY,
      radius: Math.max(34, pulseRadius * 0.52),
      lifeSec: 0.32,
      color: 0x8dffe3,
      secondaryColor: 0xf4fffd,
      fillAlpha: 0.12,
      strokeAlpha: 0.94,
      strokeWidth: 3,
      growthPerSec: 240,
      innerRadiusRatio: 0.58,
      spokeCount: 6 + Math.min(3, dashCharge),
      spokeLength: 22 + dashCharge * 3,
      angle: Math.atan2(battle.playerAimDirY, battle.playerAimDirX),
      spinRate: 9.2,
    });
    this.kickBattleShake(battle, 0.18, 0.42 + dashCharge * 0.06, 20);
    battle.tempoPulseSec = Math.max(battle.tempoPulseSec, 0.18);
    this.enqueueAudio('dash');

    // 流派构筑第三轮：开启回切反打窗口
    battle.dashCounterWindowSec = 1.2;

    // Dash路线独特被动：幽灵打击 - Dash后下次攻击穿透并造成额外伤害
    if (dashStage === 'committed' || dashStage === 'matured') {
      battle.dashGhostStrikeReady = true;
    }

    // Dash路线独特被动：动量 - 连续Dash叠加攻速和移速加成
    if (dashStage === 'committed' || dashStage === 'matured') {
      battle.dashMomentumStacks = Math.min(5, battle.dashMomentumStacks + 1);
      battle.dashMomentumDecaySec = 2.0; // 2秒内不Dash则衰减
    }

    for (const enemy of battle.enemies) {
      const distance = Math.hypot(enemy.x - battle.playerX, enemy.y - battle.playerY);
      if (distance <= pulseRadius) {
        enemy.hp -= pulseDamage;
        dashPulseHits += 1;
        // 记录Dash击杀类型
        enemy.lastHitWasCrit = false;
        enemy.lastHitWasPierce = false;
        // 流派构筑第三轮：脉冲层数积累与回切标记
        const oldStacks = enemy.dashPulseStacks ?? 0;
        enemy.dashMarkSec = 1.5;
        enemy.routeHitFlashSec = 0.16;
        enemy.routeHitKind = 'dash';

        // dash-brush: 更容易叠第一层标记（第一层直接给2层）
        const stackGain = (oldStacks === 0 && battle.dashBrushActive) ? 2 : 1;
        enemy.dashPulseStacks = Math.min(3, oldStacks + stackGain);

        // dash-sidestep-bank: 回切窗口期间层数收益提高（如果处于窗口期，额外+1层）
        if (battle.dashSidestepBankActive && battle.dashCounterWindowSec > 0) {
          enemy.dashPulseStacks = Math.min(3, enemy.dashPulseStacks + 1);
        }

        // 3层脉冲触发回切伤害
        if (enemy.dashPulseStacks >= 3) {
          // dash-zero-window: 窗口内命中被 dash 标记敌人获得额外小伤害
          let returnDamage = 6;
          if (battle.dashZeroWindowReady && enemy.dashMarkSec > 0) {
            returnDamage += 4; // 额外伤害
          }
          enemy.hp -= returnDamage;
          enemy.dashPulseStacks = 0;
          // 标记敌人可被窗口额外伤害
          enemy.dashMarkedForBonus = true;
          // 视觉反馈
          this.createCombatPulse(battle, {
            x: enemy.x,
            y: enemy.y,
            radius: enemy.radius + 20,
            lifeSec: 0.20,
            color: 0x7aff7a,
            secondaryColor: 0xc8ffc8,
            fillAlpha: 0.10,
            strokeAlpha: 0.82,
            strokeWidth: 2.5,
            growthPerSec: 200,
            innerRadiusRatio: 0.5,
          });
          this.enqueueAudio('dashHit');
        }

        // dash-afterimage: 回切触发后留下短暂残影脉冲
        if (battle.dashAfterimageReady && enemy.dashPulseStacks === 0) {
          // 残影脉冲造成小额伤害
          enemy.hp -= 3;
          enemy.routeHitFlashSec = 0.12;
          this.createCombatPulse(battle, {
            x: enemy.x,
            y: enemy.y,
            radius: enemy.radius + 15,
            lifeSec: 0.15,
            color: 0x5aff5a,
            secondaryColor: 0xa0ffa0,
            fillAlpha: 0.06,
            strokeAlpha: 0.6,
            strokeWidth: 1.5,
            growthPerSec: 150,
            innerRadiusRatio: 0.6,
          });
        }

        this.registerEnemyImpact(battle, enemy, battle.playerX, battle.playerY, {
          flashSec: 0.18,
          kick: 12,
          pulseRadius: enemy.radius + 10,
          pulseColor: 0x86ffd1,
          secondaryColor: 0xffffff,
        });
        if (this.state.routeCounts.dash > 0) {
          const angle = Math.atan2(enemy.y - battle.playerY, enemy.x - battle.playerX);
          const knockback = (dashStage === 'matured' ? 40 : dashStage === 'committed' ? 30 : 18) + dashCharge * 4;
          enemy.x += Math.cos(angle) * knockback;
          enemy.y += Math.sin(angle) * knockback;
        }
      }
    }
    if (dashPulseHits > 0) {
      this.enqueueAudio('dashPulse');
      this.enqueueTip(`穿梭触发：脉冲命中 ${dashPulseHits} 个敌人`);
    } else {
      this.enqueueTip('穿梭触发：获得短暂无伤窗口');
    }

    const dashHeal = this.getDashPulseHeal(dashCharge, dashStage);
    if (dashHeal > 0) {
      this.state.stats.hp = clamp(this.state.stats.hp + dashHeal, 0, this.state.stats.maxHp);
      battle.playerRecoverySec = Math.max(battle.playerRecoverySec, 0.26);
    }

    if (dashCharge >= 2 && !this.routeMomentShown.dash) {
      this.routeMomentShown.dash = true;
      this.enqueueTip('穿梭节奏开始接上了');
    }

    battle.dashCharge = 0;
  }

  private spawnEnemies(battle: BattleState, dt: number): void {
    const template = BATTLE_TEMPLATES[battle.templateId];
    if (this.debugConfig.freezeEnemySpawning) {
      return;
    }
    battle.enemySpawnTimerSec -= dt;
    battle.eliteSupportCooldownSec = Math.max(0, battle.eliteSupportCooldownSec - dt);
    const regularEnemyCap = this.getRegularEnemyCap(battle);
    const activeRegularEnemies = battle.enemies.filter((enemy) => !enemy.elite && enemy.hp > 0);
    const activeArchetypeCounts = this.countArchetypes(activeRegularEnemies);
    if (
      battle.encounterType === 'battle' &&
      !battle.eliteAlive &&
      regularEnemyCap !== null &&
      battle.elapsedSec >= 1.6
    ) {
      const lowPressureThreshold = Math.max(2, Math.floor(regularEnemyCap * 0.38));
      if (activeRegularEnemies.length <= lowPressureThreshold) {
        const refillWindow =
          this.getOrdinaryRefillWindow(
            template,
            activeRegularEnemies.length,
            regularEnemyCap,
            activeArchetypeCounts,
          ) - Math.min(0.06, battle.tempoPulseSec * 0.16);
        battle.enemySpawnTimerSec = Math.min(battle.enemySpawnTimerSec, Math.max(0.08, refillWindow));
      }
    }
    if (shouldSpawnElite(battle)) {
      const eliteRule = template.eliteRule;
      if (!eliteRule) {
        return;
      }
      const view = this.getBattleViewportBounds(battle);
      battle.eliteSpawned = true;
      battle.eliteAlive = true;
      const eliteHp = this.getRegularEnemyHp(template, this.getCurrentBattleIndex(), this.state.phase, battle.difficultyScale, eliteRule.hpMultiplier);
      battle.enemies.push({
        id: battle.nextEnemyId++,
        x: view.left + view.width * 0.5,
        y: view.top - 60,
        hp: eliteHp,
        maxHp: eliteHp,
        speed: this.getRegularEnemySpeed(template, this.getCurrentBattleIndex(), this.state.phase, battle.difficultyScale, eliteRule.speedMultiplier),
        radius: eliteRule.radius,
        elite: true,
        role: 'elite',
        archetype: 'brute',
        contactDamage: this.getContactDamage(template, this.getCurrentBattleIndex(), this.state.phase, battle.difficultyScale, eliteRule.damageMultiplier),
        guardSec: eliteRule.guardSec ?? 0,
        guardDamageMultiplier: eliteRule.guardDamageMultiplier ?? 1,
        grazeCooldownSec: 0,
        rangedCooldownSec: 0,
        recoverySec: 0,
        hitFlashSec: 0,
        spawnFlashSec: 0.46,
        pressurePulseSec: 0,
        tacticCooldownSec: 0,
        hitOffsetX: 0,
        hitOffsetY: 0,
        debugMoveVX: 0,
        debugMoveVY: 0,
        // 流派构筑第二轮：敌人状态标记
        critMarkSec: 0,
        pierceMarkSec: 0,
        dashMarkSec: 0,
        lastHitWasCrit: false,
        lastHitWasPierce: false,
        lastHitWasDash: false,
        // 流派构筑第三轮：层数积累初始化
        critMarkStacks: 0,
        pierceMarkStacks: 0,
        dashPulseStacks: 0,
        // 第四轮：裂纹扩散和回切窗口状态初始化
        pierceEchoDamageTaken: false,
        dashCounterWindowSec: 0,
        dashMarkedForBonus: false,
      });
      this.createCombatPulse(battle, {
        x: view.left + view.width * 0.5,
        y: view.top + 18,
        radius: 34,
        lifeSec: 0.42,
        color: 0xffc16f,
        secondaryColor: 0xfff1c1,
        fillAlpha: 0.16,
        strokeAlpha: 0.92,
        strokeWidth: 4,
        growthPerSec: 220,
        innerRadiusRatio: 0.62,
      });
      this.kickBattleShake(battle, 0.34, 0.8, 10);
      battle.tempoPulseSec = Math.max(battle.tempoPulseSec, 0.24);
      battle.eliteSupportCooldownSec = this.getEliteEscortRespawnSec(template, battle);
      const openingEscortBatch = this.getEliteEscortBatch(template, battle);
      if (openingEscortBatch > 0) {
        this.spawnEliteSupportEnemies(battle, openingEscortBatch);
      }
      this.enqueueTip(
        battle.encounterType === 'boss' ? 'Boss 已进场：击败金色血条首领即可通关' : '精英进入战场',
      );
      this.enqueueAudio(battle.encounterType === 'boss' ? 'boss' : 'eliteSpawn');
    }

    if (battle.eliteAlive && template.eliteRule && (template.eliteRule.escortBatch ?? 0) > 0) {
      const escortMax = this.getEliteEscortMax(template, battle);
      const currentEscorts = battle.enemies.filter((enemy) => !enemy.elite && enemy.role === 'escort' && enemy.hp > 0).length;
      if (currentEscorts < escortMax && battle.eliteSupportCooldownSec <= 0) {
        const batchSize = Math.min(this.getEliteEscortBatch(template, battle), escortMax - currentEscorts);
        this.spawnEliteSupportEnemies(battle, batchSize);
        battle.eliteSupportCooldownSec = this.getEliteEscortRespawnSec(template, battle);
      }
    }

    let spawnedThisTick = 0;
    const spawnCounts = { ...activeArchetypeCounts };
    while (battle.enemySpawnTimerSec <= 0) {
      battle.enemySpawnTimerSec += this.getEnemySpawnInterval(battle, template, battle.elapsedSec);
      if (regularEnemyCap !== null && battle.enemies.filter((enemy) => !enemy.elite).length >= regularEnemyCap) {
        break;
      }
      const burstCount = this.getAdaptiveSpawnBurstCount(template, battle, spawnCounts, regularEnemyCap);
      for (let burstIndex = 0; burstIndex < burstCount; burstIndex += 1) {
        const activeRegulars = battle.enemies.filter((enemy) => !enemy.elite).length;
        if (regularEnemyCap !== null && activeRegulars >= regularEnemyCap) {
          break;
        }

        const position = this.getSpawnPosition(battle, template, burstIndex);
        const archetypeOverride = this.getAdaptiveSpawnArchetype(template, spawnCounts, activeRegulars, burstIndex);
        const enemy = this.createArchetypedEnemy(battle, template, 'regular', position.x, position.y, {
          archetype: archetypeOverride,
        });
        battle.enemies.push(enemy);
        spawnCounts[enemy.archetype] += 1;
        spawnedThisTick += 1;
        this.createCombatPulse(battle, {
          x: position.x,
          y: position.y,
          radius: enemy.radius + 6,
          lifeSec: 0.2,
          color: template.accent,
          secondaryColor: 0xf8fbff,
          fillAlpha: 0.08,
          strokeAlpha: 0.42,
          strokeWidth: 2,
          growthPerSec: 144,
          innerRadiusRatio: 0.7,
        });
      }
    }
    if (spawnedThisTick >= 2) {
      battle.tempoPulseSec = Math.max(battle.tempoPulseSec, 0.12 + Math.min(0.12, spawnedThisTick * 0.03));
      if (spawnedThisTick >= 3) {
        this.kickBattleShake(battle, 0.08, 0.12 + Math.min(0.14, spawnedThisTick * 0.02), 13);
      }
    }
  }

  private getEliteEscortBatch(
    template: (typeof BATTLE_TEMPLATES)[keyof typeof BATTLE_TEMPLATES],
    battle: BattleState,
  ): number {
    const baseBatch = template.eliteRule?.escortBatch ?? 0;
    return Math.max(0, baseBatch + (this.getActivePressurePhase(battle)?.escortBatchBonus ?? 0));
  }

  private getEliteEscortMax(
    template: (typeof BATTLE_TEMPLATES)[keyof typeof BATTLE_TEMPLATES],
    battle: BattleState,
  ): number {
    const eliteRule = template.eliteRule;
    const baseMax = eliteRule?.escortMax ?? eliteRule?.escortBatch ?? 0;
    return Math.max(0, baseMax + (this.getActivePressurePhase(battle)?.escortMaxBonus ?? 0));
  }

  private getEliteEscortRespawnSec(
    template: (typeof BATTLE_TEMPLATES)[keyof typeof BATTLE_TEMPLATES],
    battle: BattleState,
  ): number {
    const baseRespawn = template.eliteRule?.escortRespawnSec ?? 5;
    const multiplier = this.getActivePressurePhase(battle)?.escortRespawnMultiplier ?? 1;
    return Math.max(0.75, baseRespawn * multiplier);
  }

  private spawnPhaseEscortBurst(battle: BattleState, requestedCount: number): void {
    if (requestedCount <= 0 || !battle.eliteAlive) {
      return;
    }

    const template = BATTLE_TEMPLATES[battle.templateId];
    if (!template.eliteRule || (template.eliteRule.escortBatch ?? 0) <= 0) {
      return;
    }

    const escortMax = this.getEliteEscortMax(template, battle);
    const currentEscorts = battle.enemies.filter((enemy) => !enemy.elite && enemy.role === 'escort' && enemy.hp > 0).length;
    const allowedCount = Math.min(requestedCount, Math.max(0, escortMax - currentEscorts));
    if (allowedCount <= 0) {
      return;
    }

    this.spawnEliteSupportEnemies(battle, allowedCount);
  }

  private spawnPatternEscortWave(
    battle: BattleState,
    requestedCount: number,
    mode: PressurePatternModeId,
    archetypeOverride?: EnemyArchetypeId,
  ): void {
    if (requestedCount <= 0 || !battle.eliteAlive) {
      return;
    }

    const template = BATTLE_TEMPLATES[battle.templateId];
    if (!template.eliteRule || (template.eliteRule.escortBatch ?? 0) <= 0) {
      return;
    }

    const escortMax = this.getEliteEscortMax(template, battle);
    const currentEscorts = battle.enemies.filter((enemy) => !enemy.elite && enemy.role === 'escort').length;
    const allowedCount = Math.min(requestedCount, Math.max(0, escortMax - currentEscorts));
    if (allowedCount <= 0) {
      return;
    }

    const battleIndex = this.getCurrentBattleIndex();
    const escortHp = Math.round(this.getRegularEnemyHp(template, battleIndex, this.state.phase, battle.difficultyScale) * 0.78);
    const escortSpeed = Math.round(this.getRegularEnemySpeed(template, battleIndex, this.state.phase, battle.difficultyScale, 1.1));
    const escortDamage = Math.max(6, Math.round(this.getContactDamage(template, battleIndex, this.state.phase, battle.difficultyScale, 0.88)));

    for (let index = 0; index < allowedCount; index += 1) {
      const position = this.getPatternEscortSpawnPosition(battle, mode, index);
      battle.enemies.push(
        this.createArchetypedEnemy(
          battle,
          template,
          'escort',
          position.x,
          position.y,
          {
            hp: escortHp,
            speed: escortSpeed,
            damage: escortDamage,
            radius: 12 + (index % 2),
            archetype: archetypeOverride,
          },
        ),
      );
    }

    if (battle.encounterType === 'boss' && battle.pressureSafeWindowSec > 0) {
      this.clearBossSafeWindowBlockers(battle);
    }
  }

  private getPatternEscortSpawnPosition(
    battle: BattleState,
    mode: PressurePatternModeId,
    index: number,
  ): { x: number; y: number } {
    const view = this.getBattleViewportBounds(battle);
    const margin = 44;
    const cursor = battle.spawnCursor++;
    const sideOffset = 46 + Math.floor(index / 2) * 34;
    const jitter = ((cursor % 3) - 1) * 12;

    if (mode === 'laneCrush') {
      const fromTop = index % 2 === 0;
      const x = clamp(
        battle.playerX + (index % 4 < 2 ? -sideOffset : sideOffset) + jitter,
        view.left + margin,
        view.right - margin,
      );
      return {
        x,
        y: fromTop ? view.top - 28 : view.bottom + 28,
      };
    }

    const fromLeft = index % 2 === 0;
    const y = clamp(
      battle.playerY + (index % 4 < 2 ? -sideOffset : sideOffset) + jitter,
      view.top + margin,
      view.bottom - margin,
    );
    return {
      x: fromLeft ? view.left - 28 : view.right + 28,
      y,
    };
  }

  private getContactDamage(
    template: (typeof BATTLE_TEMPLATES)[keyof typeof BATTLE_TEMPLATES],
    round: number,
    phase: RunState['phase'],
    difficultyScale: number,
    damageMultiplier = 1,
  ): number {
    return getEnemyContactDamage(template, round, phase, difficultyScale, damageMultiplier);
  }

  private countArchetypes(
    enemies: Array<Pick<BattleState['enemies'][number], 'archetype'>>,
  ): Record<EnemyArchetypeId, number> {
    const counts: Record<EnemyArchetypeId, number> = {
      standard: 0,
      brute: 0,
      skirmisher: 0,
      ranged: 0,
    };

    for (const enemy of enemies) {
      counts[enemy.archetype] += 1;
    }

    return counts;
  }

  private countActiveRegularEnemies(battle: BattleState): number {
    return battle.enemies.filter((enemy) => !enemy.elite && enemy.hp > 0).length;
  }

  private registerKillFlow(battle: BattleState, enemy: BattleState['enemies'][number]): number {
    if (battle.killFlowSec > 0) {
      battle.killFlowCount = Math.min(4, battle.killFlowCount + 1);
    } else {
      battle.killFlowCount = 1;
    }

    battle.killFlowSec = Math.max(
      battle.killFlowSec,
      enemy.elite ? 1.08 : 0.76 + Math.min(0.12, battle.killFlowCount * 0.03),
    );
    battle.playerMoveBoostSec = Math.max(
      battle.playerMoveBoostSec,
      enemy.elite ? 0.26 : 0.13 + Math.min(0.16, battle.killFlowCount * 0.034),
    );
    battle.tempoPulseSec = Math.max(
      battle.tempoPulseSec,
      enemy.elite ? 0.36 : 0.17 + Math.min(0.2, battle.killFlowCount * 0.054),
    );

    // Kill Streak System
    if (battle.killStreakDecaySec > 0) {
      battle.killStreakCount += 1;
    } else {
      battle.killStreakCount = 1;
    }

    // Reset decay timer (3 seconds window)
    battle.killStreakDecaySec = 3.0;

    // Calculate multiplier: +5% per kill, max +50% at 10 kills
    battle.killStreakMultiplier = 1.0 + Math.min(0.5, battle.killStreakCount * 0.05);

    return battle.killFlowCount;
  }

  private getPickupFlowWindowSec(chainCount: number): number {
    if (chainCount >= 4) {
      return 0.88;
    }
    if (chainCount === 3) {
      return 0.8;
    }
    if (chainCount === 2) {
      return 0.72;
    }
    return 0.62;
  }

  private getPickupFlowRatio(battle: BattleState): number {
    if (battle.pickupFlowSec <= 0 || battle.pickupFlowCount <= 0) {
      return 0;
    }

    return Math.min(1, battle.pickupFlowSec / this.getPickupFlowWindowSec(battle.pickupFlowCount));
  }

  private getKillFlowRatio(battle: BattleState): number {
    if (battle.killFlowSec <= 0 || battle.killFlowCount <= 0) {
      return 0;
    }

    return Math.min(
      1,
      battle.killFlowSec /
        (battle.killFlowCount >= 3 ? 1 : battle.killFlowCount >= 2 ? 0.86 : 0.72),
    );
  }

  private registerPierceFlow(
    battle: BattleState,
    options: {
      laneScore?: number;
      hitCount?: number;
      echoCount?: number;
      eliteCrackRatio?: number;
      pickupCarry?: number;
    } = {},
  ): number {
    if (battle.pierceFlowSec > 0) {
      battle.pierceFlowCount = Math.min(5, battle.pierceFlowCount + 1);
    } else {
      battle.pierceFlowCount = 1;
    }

    const laneScore = options.laneScore ?? 0;
    const hitCount = options.hitCount ?? 1;
    const echoCount = options.echoCount ?? 0;
    const eliteCrackRatio = options.eliteCrackRatio ?? 0;
    const pickupCarry = options.pickupCarry ?? 0;
    const flowWeight =
      battle.pierceFlowCount * 0.04 +
      Math.min(0.14, Math.max(0, laneScore - 1) * 0.05) +
      Math.min(0.1, Math.max(0, hitCount - 1) * 0.035) +
      Math.min(0.1, echoCount * 0.04) +
      Math.min(0.12, eliteCrackRatio * 0.16) +
      Math.min(0.08, pickupCarry * 0.012);

    battle.pierceFlowSec = Math.max(battle.pierceFlowSec, 0.46 + flowWeight);
    battle.playerMoveBoostSec = Math.max(battle.playerMoveBoostSec, 0.1 + Math.min(0.12, flowWeight * 0.65));
    battle.playerTurnBurstSec = Math.max(battle.playerTurnBurstSec, 0.055 + Math.min(0.08, flowWeight * 0.48));
    battle.tempoPulseSec = Math.max(battle.tempoPulseSec, 0.16 + Math.min(0.18, flowWeight * 0.72));
    return battle.pierceFlowCount;
  }

  private getPierceFlowRatio(battle: BattleState): number {
    if (battle.pierceFlowSec <= 0 || battle.pierceFlowCount <= 0) {
      return 0;
    }

    return Math.min(1, battle.pierceFlowSec / (0.46 + Math.min(0.28, battle.pierceFlowCount * 0.06)));
  }

  private getPickupLeadRatio(battle: BattleState): number {
    if (battle.pickupLeadEnemyId === null || battle.pickupLeadSec <= 0) {
      return 0;
    }

    return Math.min(1, battle.pickupLeadSec / 0.36);
  }

  private getOrdinaryBattleSurgeRatio(battle: BattleState): number {
    return Math.min(1, this.getPickupFlowRatio(battle) * 0.74 + this.getKillFlowRatio(battle) * 0.56);
  }

  private isPickupLeadEnemy(
    battle: BattleState,
    enemy: BattleState['enemies'][number],
  ): boolean {
    return battle.pickupLeadEnemyId === enemy.id && battle.pickupLeadSec > 0.02;
  }

  private registerPickupFlow(battle: BattleState, orbValue: number): number {
    if (battle.pickupFlowSec > 0) {
      battle.pickupFlowCount = Math.min(5, battle.pickupFlowCount + 1);
    } else {
      battle.pickupFlowCount = 1;
    }

    const chainCount = battle.pickupFlowCount;
    const windowSec = this.getPickupFlowWindowSec(chainCount);
    const pickupIntensity = Math.min(1, orbValue * 0.05 + chainCount * 0.16);
    battle.pickupFlowSec = Math.max(
      battle.pickupFlowSec,
      windowSec + Math.min(0.12, pickupIntensity * 0.08),
    );
    battle.playerMoveBoostSec = Math.max(
      battle.playerMoveBoostSec,
      0.1 + Math.min(0.14, chainCount * 0.028 + pickupIntensity * 0.08),
    );
    battle.playerTurnBurstSec = Math.max(
      battle.playerTurnBurstSec,
      0.06 + Math.min(0.08, chainCount * 0.018 + pickupIntensity * 0.05),
    );
    battle.tempoPulseSec = Math.max(
      battle.tempoPulseSec,
      0.14 + Math.min(0.14, chainCount * 0.028 + pickupIntensity * 0.08),
    );
    return chainCount;
  }

  private registerPlayerThreatDirection(battle: BattleState, sourceX: number, sourceY: number, flashSec: number): void {
    battle.playerDamageAngle = Math.atan2(sourceY - battle.playerY, sourceX - battle.playerX);
    battle.playerDamageFlashSec = Math.max(battle.playerDamageFlashSec, flashSec);
  }

  private feedBattleFlow(
    battle: BattleState,
    source: 'kill' | 'pickup',
    intensity: number,
  ): void {
    if (battle.encounterType !== 'battle' || battle.eliteAlive) {
      return;
    }

    const regularEnemyCap = this.getRegularEnemyCap(battle);
    if (regularEnemyCap === null) {
      return;
    }

    const activeRegularCount = this.countActiveRegularEnemies(battle);
    const missingCount = Math.max(0, regularEnemyCap - activeRegularCount);
    if (missingCount <= 0) {
      return;
    }

    const template = BATTLE_TEMPLATES[battle.templateId];
    const pattern = template.spawnRule?.pattern ?? 'surround';
    const flowRatio =
      battle.killFlowSec > 0
        ? Math.min(1, battle.killFlowSec / (battle.killFlowCount >= 3 ? 1 : battle.killFlowCount >= 2 ? 0.86 : 0.72))
        : 0;
    let nudge = source === 'kill' ? 0.05 : 0.026;
    nudge += Math.min(source === 'kill' ? 0.055 : 0.032, intensity * (source === 'kill' ? 0.008 : 0.0028));
    if (activeRegularCount <= Math.max(2, Math.floor(regularEnemyCap * 0.36))) {
      nudge += 0.024;
    }
    if (missingCount >= 3) {
      nudge += 0.018;
    }
    if (battle.killFlowCount >= 2) {
      nudge += 0.008 + Math.min(0.018, battle.killFlowCount * 0.004 + flowRatio * 0.012);
    }
    if (source === 'pickup' && flowRatio > 0) {
      nudge += 0.006 + flowRatio * 0.01;
    }
    if (pattern === 'pincers') {
      nudge += 0.008;
    } else if (pattern === 'lanes') {
      nudge += 0.012;
    }

    battle.enemySpawnTimerSec = Math.max(0.06, battle.enemySpawnTimerSec - nudge);
  }

  private getPickupFollowThroughTarget(
    battle: BattleState,
  ): BattleState['enemies'][number] | null {
    let bestTarget: BattleState['enemies'][number] | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const enemy of battle.enemies) {
      if (enemy.elite || enemy.hp <= 0) {
        continue;
      }

      const distance = Math.hypot(enemy.x - battle.playerX, enemy.y - battle.playerY);
      if (distance > 420) {
        continue;
      }

      const distanceScore = 1 - distance / 420;
      const behaviorScore =
        enemy.archetype === 'ranged'
          ? 0.12
          : enemy.archetype === 'skirmisher'
            ? 0.1
            : enemy.archetype === 'standard'
              ? 0.08
              : 0.04;
      const pressureScore = enemy.pressurePulseSec > 0.04 ? 0.08 : 0;
      const recoveryPenalty = enemy.recoverySec > 0.08 ? 0.12 : 0;
      const score = distanceScore + behaviorScore + pressureScore - recoveryPenalty;
      if (score > bestScore) {
        bestScore = score;
        bestTarget = enemy;
      }
    }

    return bestTarget;
  }

  private triggerPickupFollowThrough(
    battle: BattleState,
    orbValue: number,
    chainCount: number,
  ): void {
    if (battle.encounterType !== 'battle' || battle.eliteAlive) {
      battle.pickupLeadEnemyId = null;
      battle.pickupLeadSec = 0;
      return;
    }

    const target = this.getPickupFollowThroughTarget(battle);
    if (!target) {
      battle.pickupLeadEnemyId = null;
      battle.pickupLeadSec = 0;
      return;
    }

    const pickupFlowRatio = this.getPickupFlowRatio(battle);
    const killFlowRatio = this.getKillFlowRatio(battle);
    const chainRatio = Math.min(1, chainCount / 4);
    const pickupIntensity = Math.min(1, orbValue * 0.04 + chainRatio * 0.58 + pickupFlowRatio * 0.44);
    const continueFiringRatio =
      battle.bullets.length > 0
        ? Math.min(1, battle.bullets.length / 3)
        : battle.fireCooldownSec < 0.18
          ? 1 - battle.fireCooldownSec / 0.18
          : 0;
    this.markKillPickupContinueMoment(
      battle,
      killFlowRatio * 0.44 + pickupFlowRatio * 0.34 + chainRatio * 0.2 + continueFiringRatio * 0.36,
    );
    battle.pickupLeadEnemyId = target.id;
    battle.pickupLeadSec = Math.max(
      battle.pickupLeadSec,
      0.24 + Math.min(0.28, chainRatio * 0.18 + pickupFlowRatio * 0.14),
    );
    target.spawnFlashSec = Math.max(target.spawnFlashSec, 0.08 + pickupIntensity * 0.08);
    target.hitFlashSec = Math.max(target.hitFlashSec, 0.05 + pickupFlowRatio * 0.06);

    this.createCombatPulse(battle, {
      x: target.x,
      y: target.y,
      radius: target.radius + 10 + pickupFlowRatio * 10,
      lifeSec: 0.1 + pickupFlowRatio * 0.06,
      color: 0x9df7c5,
      secondaryColor: 0xffffff,
      fillAlpha: 0.03,
      strokeAlpha: 0.24 + pickupFlowRatio * 0.12,
      strokeWidth: 1.8,
      growthPerSec: 116,
      innerRadiusRatio: 0.72,
      spokeCount: target.archetype === 'ranged' ? 5 : 4,
      spokeLength: 10 + pickupFlowRatio * 6,
      angle: Math.atan2(battle.playerY - target.y, battle.playerX - target.x),
      spinRate: target.archetype === 'skirmisher' ? 5.8 : 4.8,
    });

    if (chainCount >= 2) {
      this.triggerRegularPressureBeat(
        battle,
        target,
        0.08 + pickupFlowRatio * 0.08,
        target.archetype === 'ranged' ? 1.02 : 0.92,
        { rangedLeadSec: 0.24 },
      );
    } else {
      target.pressurePulseSec = Math.max(target.pressurePulseSec, 0.06 + pickupFlowRatio * 0.04);
    }

    this.primeRegularPressureLead(
      battle,
      target,
      0.42 + pickupIntensity * (target.archetype === 'brute' ? 0.16 : 0.22),
    );
  }

  private isSkirmisherHeavyTemplate(template: (typeof BATTLE_TEMPLATES)[keyof typeof BATTLE_TEMPLATES]): boolean {
    return (template.regularArchetypes?.skirmisher ?? 0) >= 1.9;
  }

  private isBruteHeavyTemplate(template: (typeof BATTLE_TEMPLATES)[keyof typeof BATTLE_TEMPLATES]): boolean {
    return (template.regularArchetypes?.brute ?? 0) >= 1.8;
  }

  private isRangedHeavyTemplate(template: (typeof BATTLE_TEMPLATES)[keyof typeof BATTLE_TEMPLATES]): boolean {
    return (template.regularArchetypes?.ranged ?? 0) >= 1.45;
  }

  private getPlayerLaneTargetCoordinate(
    battle: BattleState,
    axis: 'horizontal' | 'vertical',
    laneOffset = 0,
  ): number {
    const laneCount = 3;
    const view = this.getBattleViewportBounds(battle);
    const viewStart = axis === 'vertical' ? view.left : view.top;
    const viewSpan = axis === 'vertical' ? view.width : view.height;
    const coordinate = axis === 'vertical' ? battle.playerX : battle.playerY;
    const laneProgress = clamp((coordinate - viewStart) / Math.max(1, viewSpan), 0.12, 0.88);
    const baseLane = Math.max(0, Math.min(laneCount - 1, Math.round(laneProgress * (laneCount + 1)) - 1));
    const laneIndex = Math.max(0, Math.min(laneCount - 1, baseLane + laneOffset));
    return viewStart + ((laneIndex + 1) / (laneCount + 1)) * viewSpan;
  }

  private getOrdinaryRefillWindow(
    template: (typeof BATTLE_TEMPLATES)[keyof typeof BATTLE_TEMPLATES],
    activeRegularCount: number,
    regularEnemyCap: number,
    archetypeCounts: Record<EnemyArchetypeId, number>,
  ): number {
    const pattern = template.spawnRule?.pattern ?? 'surround';
    const isRangedHeavy = this.isRangedHeavyTemplate(template);
    const isBruteHeavy = this.isBruteHeavyTemplate(template);
    const isSkirmisherHeavy = this.isSkirmisherHeavyTemplate(template);

    if (pattern === 'pincers' || isSkirmisherHeavy) {
      return activeRegularCount === 0 ? 0.08 : activeRegularCount === 1 ? 0.14 : 0.2;
    }

    if (pattern === 'lanes' && isRangedHeavy) {
      if (archetypeCounts.ranged === 0) {
        return activeRegularCount <= 1 ? 0.1 : 0.16;
      }
      return activeRegularCount <= Math.max(2, Math.floor(regularEnemyCap * 0.32)) ? 0.18 : 0.24;
    }

    if (pattern === 'lanes' && isBruteHeavy) {
      if (archetypeCounts.brute === 0) {
        return activeRegularCount <= 1 ? 0.12 : 0.18;
      }
      return activeRegularCount <= Math.max(2, Math.floor(regularEnemyCap * 0.34)) ? 0.22 : 0.28;
    }

    return activeRegularCount === 0 ? 0.12 : activeRegularCount === 1 ? 0.2 : 0.28;
  }

  private getAdaptiveSpawnBurstCount(
    template: (typeof BATTLE_TEMPLATES)[keyof typeof BATTLE_TEMPLATES],
    battle: BattleState,
    archetypeCounts: Record<EnemyArchetypeId, number>,
    regularEnemyCap: number | null,
  ): number {
    let burstCount = this.getSpawnBurstCount(template);
    if (battle.encounterType !== 'battle' || battle.eliteAlive || regularEnemyCap === null) {
      return burstCount;
    }

    const activeRegularCount = Object.values(archetypeCounts).reduce((sum, value) => sum + value, 0);
    if (regularEnemyCap - activeRegularCount <= burstCount) {
      return burstCount;
    }

    const pattern = template.spawnRule?.pattern ?? 'surround';
    const laneBias = template.spawnRule?.laneBias ?? 'horizontal';
    const isRangedHeavy = this.isRangedHeavyTemplate(template);
    const isBruteHeavy = this.isBruteHeavyTemplate(template);
    const isSkirmisherHeavy = this.isSkirmisherHeavyTemplate(template);
    const lowPressureCount = Math.max(2, Math.floor(regularEnemyCap * 0.34));
    const desiredSkirmisherFloor = pattern === 'pincers' || isSkirmisherHeavy ? (activeRegularCount >= 4 ? 2 : 1) : 0;
    const desiredRangedFloor =
      pattern === 'lanes' && laneBias === 'vertical' && isRangedHeavy ? (activeRegularCount >= 5 ? 2 : 1) : 0;
    const desiredBruteFloor =
      pattern === 'lanes' && laneBias === 'horizontal' && isBruteHeavy ? (activeRegularCount >= 4 ? 2 : 1) : 0;

    if (
      desiredSkirmisherFloor > 0 &&
      archetypeCounts.skirmisher < desiredSkirmisherFloor &&
      activeRegularCount <= lowPressureCount + 1
    ) {
      burstCount += 1;
    } else if (
      desiredRangedFloor > 0 &&
      archetypeCounts.ranged < desiredRangedFloor &&
      activeRegularCount <= lowPressureCount + 2
    ) {
      burstCount += 1;
    } else if (
      desiredBruteFloor > 0 &&
      archetypeCounts.brute < desiredBruteFloor &&
      activeRegularCount <= lowPressureCount + 1
    ) {
      burstCount += 1;
    }

    return burstCount;
  }

  private getAdaptiveSpawnArchetype(
    template: (typeof BATTLE_TEMPLATES)[keyof typeof BATTLE_TEMPLATES],
    archetypeCounts: Record<EnemyArchetypeId, number>,
    activeRegularCount: number,
    burstIndex: number,
  ): EnemyArchetypeId | undefined {
    const pattern = template.spawnRule?.pattern ?? 'surround';
    const laneBias = template.spawnRule?.laneBias ?? 'horizontal';
    const isRangedHeavy = this.isRangedHeavyTemplate(template);
    const isBruteHeavy = this.isBruteHeavyTemplate(template);
    const isSkirmisherHeavy = this.isSkirmisherHeavyTemplate(template);
    const desiredSkirmisherFloor = pattern === 'pincers' || isSkirmisherHeavy ? (activeRegularCount >= 4 ? 2 : 1) : 0;
    const desiredRangedFloor =
      pattern === 'lanes' && laneBias === 'vertical' && isRangedHeavy ? (activeRegularCount >= 5 ? 2 : 1) : 0;
    const desiredBruteFloor =
      pattern === 'lanes' && laneBias === 'horizontal' && isBruteHeavy ? (activeRegularCount >= 4 ? 2 : 1) : 0;

    if (
      desiredSkirmisherFloor > 0 &&
      archetypeCounts.skirmisher < desiredSkirmisherFloor
    ) {
      return burstIndex % 2 === 0 || archetypeCounts.skirmisher === 0 ? 'skirmisher' : undefined;
    }

    if (desiredRangedFloor > 0 && archetypeCounts.ranged < desiredRangedFloor) {
      return 'ranged';
    }

    if (desiredBruteFloor > 0 && archetypeCounts.brute < desiredBruteFloor) {
      return 'brute';
    }

    return undefined;
  }

  private getSpawnBurstCount(template: (typeof BATTLE_TEMPLATES)[keyof typeof BATTLE_TEMPLATES]): number {
    return getSpawnBurstCount(template);
  }

  private getSpawnPosition(
    battle: BattleState,
    template: (typeof BATTLE_TEMPLATES)[keyof typeof BATTLE_TEMPLATES],
    burstIndex: number,
  ): { x: number; y: number } {
    const view = this.getBattleViewportBounds(battle);
    const pattern = template.spawnRule?.pattern ?? 'surround';
    const laneBias = template.spawnRule?.laneBias ?? 'horizontal';
    const cursor = battle.spawnCursor++;
    const margin = 36;

    if (pattern === 'pincers') {
      const fromLeft = (cursor + burstIndex) % 2 === 0;
      const y =
        view.top + margin + (((cursor * 73) + burstIndex * 41) % Math.max(1, Math.round(view.height - margin * 2)));
      return {
        x: fromLeft ? view.left - 28 : view.right + 28,
        y,
      };
    }

    if (pattern === 'lanes') {
      const laneCount = 3;
      const lane = (cursor + burstIndex) % laneCount;
      const sideIndex = Math.floor((cursor + burstIndex) / laneCount) % 2;
      const jitter = (((cursor * 19) % 5) - 2) * 10;

      if (laneBias === 'vertical') {
        return {
          x: clamp(
            view.left + ((lane + 1) / (laneCount + 1)) * view.width + jitter,
            view.left + margin,
            view.right - margin,
          ),
          y: sideIndex === 0 ? view.top - 28 : view.bottom + 28,
        };
      }

      return {
        x: sideIndex === 0 ? view.left - 28 : view.right + 28,
        y: clamp(
          view.top + ((lane + 1) / (laneCount + 1)) * view.height + jitter,
          view.top + margin,
          view.bottom - margin,
        ),
      };
    }

    let side = (cursor + burstIndex) % 4;
    const t = (((cursor * 53) + burstIndex * 17) % 100) / 100;

    if (pattern === 'surround') {
      const playerNormalizedX = battle.playerX / ARENA_WIDTH;
      const playerNormalizedY = battle.playerY / ARENA_HEIGHT;

      const topWeight = Math.max(0.2, playerNormalizedY);
      const bottomWeight = Math.max(0.2, 1 - playerNormalizedY);
      const leftWeight = Math.max(0.2, playerNormalizedX);
      const rightWeight = Math.max(0.2, 1 - playerNormalizedX);

      const totalWeight = topWeight + rightWeight + bottomWeight + leftWeight;
      const normalizedWeights = [
        topWeight / totalWeight,
        rightWeight / totalWeight,
        bottomWeight / totalWeight,
        leftWeight / totalWeight,
      ];

      const randomValue = (((cursor * 73) + burstIndex * 29) % 100) / 100;
      let cumulativeWeight = 0;
      for (let i = 0; i < 4; i += 1) {
        cumulativeWeight += normalizedWeights[i];
        if (randomValue < cumulativeWeight) {
          side = i;
          break;
        }
      }
    }

    if (side === 0) {
      return {
        x: view.left + margin + t * (view.width - margin * 2),
        y: view.top - 28,
      };
    }
    if (side === 1) {
      return {
        x: view.right + 28,
        y: view.top + margin + t * (view.height - margin * 2),
      };
    }
    if (side === 2) {
      return {
        x: view.left + margin + t * (view.width - margin * 2),
        y: view.bottom + 28,
      };
    }
    return {
      x: view.left - 28,
      y: view.top + margin + t * (view.height - margin * 2),
    };
  }

  private createArchetypedEnemy(
    battle: BattleState,
    template: (typeof BATTLE_TEMPLATES)[keyof typeof BATTLE_TEMPLATES],
    role: 'regular' | 'escort',
    x: number,
    y: number,
    overrides?: {
      hp?: number;
      speed?: number;
      damage?: number;
      radius?: number;
      archetype?: EnemyArchetypeId;
    },
  ): BattleState['enemies'][number] {
    const baseHp =
      overrides?.hp ??
      this.getRegularEnemyHp(template, this.getCurrentBattleIndex(), this.state.phase, battle.difficultyScale);
    const baseSpeed =
      overrides?.speed ??
      this.getRegularEnemySpeed(template, this.getCurrentBattleIndex(), this.state.phase, battle.difficultyScale);
    const baseDamage =
      overrides?.damage ??
      this.getContactDamage(template, this.getCurrentBattleIndex(), this.state.phase, battle.difficultyScale);
    const archetype =
      overrides?.archetype ??
      pickEnemyArchetype(role === 'escort' ? template.escortArchetypes : template.regularArchetypes, role);
    const archetypeDef = getEnemyArchetype(archetype);
    const hp = Math.max(1, Math.round(baseHp * archetypeDef.hpMultiplier));
    const speed = Math.max(24, Math.round(baseSpeed * archetypeDef.speedMultiplier));
    const contactDamage = Math.max(1, Math.round(baseDamage * archetypeDef.contactDamageMultiplier));
    const radius = Math.max(8, Math.round((overrides?.radius ?? 12) * archetypeDef.radiusMultiplier));

    return {
      id: battle.nextEnemyId++,
      x,
      y,
      hp,
      maxHp: hp,
      speed,
      radius,
      elite: false,
      role,
      archetype,
      contactDamage,
      guardSec: 0,
      guardDamageMultiplier: 1,
      grazeCooldownSec: 0,
      rangedCooldownSec: archetypeDef.shotIntervalSec ? 0.45 + Math.random() * this.getRangedShotIntervalSec(archetypeDef, battle) : 0,
      recoverySec: 0,
      hitFlashSec: 0,
      spawnFlashSec: role === 'escort' ? 0.28 : 0.22,
      pressurePulseSec: 0,
      tacticCooldownSec: 0,
      hitOffsetX: 0,
      hitOffsetY: 0,
      debugMoveVX: 0,
      debugMoveVY: 0,
      // 流派构筑第二轮：敌人状态标记
      critMarkSec: 0,
      pierceMarkSec: 0,
      dashMarkSec: 0,
      lastHitWasCrit: false,
      lastHitWasPierce: false,
      lastHitWasDash: false,
      // 流派构筑第三轮：层数积累初始化
      critMarkStacks: 0,
      pierceMarkStacks: 0,
      dashPulseStacks: 0,
      // 第四轮：裂纹扩散和回切窗口状态初始化
      pierceEchoDamageTaken: false,
      dashCounterWindowSec: 0,
      dashMarkedForBonus: false,
    };
  }

  private spawnEliteSupportEnemies(battle: BattleState, count: number): void {
    if (count <= 0) {
      return;
    }

    const template = BATTLE_TEMPLATES[battle.templateId];
    const eliteEnemy = this.getEliteEnemy(battle);
    const activeBehavior = this.getActiveEliteBehavior(battle, template);
    const battleIndex = this.getCurrentBattleIndex();
    const escortHp = Math.round(this.getRegularEnemyHp(template, battleIndex, this.state.phase, battle.difficultyScale) * 0.82);
    const escortSpeed = Math.round(this.getRegularEnemySpeed(template, battleIndex, this.state.phase, battle.difficultyScale, 1.06));
    const escortDamage = Math.max(6, Math.round(this.getContactDamage(template, battleIndex, this.state.phase, battle.difficultyScale, 0.92)));
    const screenAngle = eliteEnemy
      ? Math.atan2(eliteEnemy.y - battle.playerY, eliteEnemy.x - battle.playerX)
      : -Math.PI / 2;

    for (let index = 0; index < count; index += 1) {
      const spread = count === 1 ? 0 : ((index / Math.max(1, count - 1)) - 0.5) * 0.95;
      const distance =
        activeBehavior === 'screened'
          ? 42 + index * 8
          : activeBehavior === 'summoner'
            ? 62 + index * 11
            : activeBehavior === 'kiting'
              ? 48 + index * 9
              : 46 + index * 8;
      const frontBias =
        activeBehavior === 'screened'
          ? 1.12
          : activeBehavior === 'summoner'
            ? 0.42
            : activeBehavior === 'kiting'
              ? 0.58
              : 0.94;
      const lateralSpread =
        activeBehavior === 'screened'
          ? 72
          : activeBehavior === 'summoner'
            ? 84
            : activeBehavior === 'kiting'
              ? 62
              : 52;
      const anchorX = eliteEnemy?.x ?? CENTER_X;
      const anchorY = eliteEnemy?.y ?? -30;
      const offsetX = Math.cos(screenAngle) * distance;
      const offsetY = Math.sin(screenAngle) * distance;
      const strafeX = -Math.sin(screenAngle) * spread * lateralSpread;
      const strafeY = Math.cos(screenAngle) * spread * lateralSpread;

      const escort = this.createArchetypedEnemy(
        battle,
        template,
        'escort',
        anchorX - offsetX * frontBias + strafeX,
        anchorY - offsetY * frontBias + strafeY,
        {
          hp: escortHp,
          speed: escortSpeed,
          damage: escortDamage,
          radius: 11 + (index % 2),
        },
      );
      escort.spawnFlashSec = Math.max(
        escort.spawnFlashSec,
        activeBehavior === 'screened' ? 0.4 : activeBehavior === 'summoner' ? 0.34 : 0.3,
      );
      if (activeBehavior === 'screened' || activeBehavior === 'summoner') {
        escort.pressurePulseSec = Math.max(escort.pressurePulseSec, activeBehavior === 'screened' ? 0.24 : 0.2);
      }
      if (
        escort.archetype === 'ranged' &&
        (activeBehavior === 'screened' || activeBehavior === 'summoner' || activeBehavior === 'kiting')
      ) {
        escort.rangedCooldownSec = 0.22 + index * 0.08;
      }
      battle.enemies.push(escort);
    }
  }

  private updateShooting(battle: BattleState, dt: number): void {
    battle.fireCooldownSec -= dt;
    if (battle.fireCooldownSec > 0) {
      return;
    }

    const focusRoute = this.getLiveCombatFocusRoute(battle);
    const target = this.getNearestEnemy(battle);
    const critStage = this.getRouteBuildStage('crit');
    const dashStage = this.getRouteBuildStage('dash');
    const ordinarySurgeRatio = this.getOrdinaryBattleSurgeRatio(battle);
    const pickupLeadRatio = this.getPickupLeadRatio(battle);
    const pierceFlowRatio = this.getPierceFlowRatio(battle);
    const effectiveFireRate = this.getEffectiveFireRate(battle);
    battle.fireCooldownSec = 1 / effectiveFireRate;
    const fallbackAngle =
      Math.abs(battle.playerMoveDirX) > 0 || Math.abs(battle.playerMoveDirY) > 0
        ? Math.atan2(battle.playerMoveDirY, battle.playerMoveDirX)
        : -Math.PI / 2;
    const baseAngle = target
      ? Math.atan2(target.y - battle.playerY, target.x - battle.playerX)
      : fallbackAngle;
    const targetDistance = target ? Math.hypot(target.x - battle.playerX, target.y - battle.playerY) : Number.POSITIVE_INFINITY;
    const targetHpRatio = target ? target.hp / Math.max(1, target.maxHp) : 1;
    const eliteCrackRatio = target?.elite ? this.getEliteCrackWindowRatio(battle) : 0;
    const targetIsPickupLead = target ? this.isPickupLeadEnemy(battle, target) : false;
    const moveMagnitude = Math.hypot(battle.playerMoveDirX, battle.playerMoveDirY);
    const targetAlignment =
      target && moveMagnitude > 0.05
        ? (((target.x - battle.playerX) / Math.max(1, targetDistance)) * battle.playerMoveDirX) +
          (((target.y - battle.playerY) / Math.max(1, targetDistance)) * battle.playerMoveDirY)
        : 0;
    const pierceLaneScore = focusRoute === 'pierce' && target ? this.getPierceLaneScore(battle, target) : 0;
    battle.playerAimDirX = Math.cos(baseAngle);
    battle.playerAimDirY = Math.sin(baseAngle);
    if (this.debugConfig.freezePlayerAutoFire) {
      battle.fireCooldownSec = 0;
      return;
    }
    let shotCount = Math.max(1, this.state.stats.multishot);
    if (battle.critOverdriveSec > 0 && this.state.committedRoute === 'crit') {
      shotCount += 1;
    }
    if (battle.dashDriveSec > 0 && this.state.maturedRoute === 'dash') {
      shotCount += 1;
    }
    let spreadStep = 0.18;
    let projectileSpeed = this.getProjectileSpeed();
    let bulletLifeSec = 1.8;
    let muzzleColor = 0xf8fbff;
    const killFlowRatio =
      battle.killFlowSec > 0
        ? Math.min(1, battle.killFlowSec / (battle.killFlowCount >= 3 ? 1 : battle.killFlowCount >= 2 ? 0.86 : 0.72))
        : 0;
    const killFlowBoost = killFlowRatio > 0 ? Math.min(1.8, battle.killFlowCount * 0.32 + killFlowRatio * 0.8) : 0;
    if (focusRoute === 'crit') {
      spreadStep = shotCount > 1 ? (battle.critOverdriveSec > 0 ? 0.11 : 0.15) : 0;
      projectileSpeed *= battle.critOverdriveSec > 0 ? 1.08 : 1.03;
      bulletLifeSec = battle.critOverdriveSec > 0 ? 1.95 : 1.82;
      muzzleColor = 0xffd47b;
      if (target && critStage !== 'unformed' && (target.elite || targetHpRatio <= 0.42)) {
        projectileSpeed *= battle.critOverdriveSec > 0 ? 1.08 : 1.05;
        bulletLifeSec += 0.08;
        battle.fireCooldownSec = Math.max(0.04, battle.fireCooldownSec - (critStage === 'matured' ? 0.022 : 0.012));
        battle.tempoPulseSec = Math.max(battle.tempoPulseSec, 0.14);
      }
      if (target?.elite && eliteCrackRatio > 0.08) {
        projectileSpeed *= 1 + eliteCrackRatio * 0.08;
        bulletLifeSec += 0.1 + eliteCrackRatio * 0.12;
        battle.fireCooldownSec = Math.max(0.038, battle.fireCooldownSec - (critStage === 'matured' ? 0.028 : 0.018));
        battle.playerTurnBurstSec = Math.max(battle.playerTurnBurstSec, 0.1 + eliteCrackRatio * 0.08);
        battle.tempoPulseSec = Math.max(battle.tempoPulseSec, 0.2 + eliteCrackRatio * 0.08);
      }
    } else if (focusRoute === 'pierce') {
      spreadStep = shotCount > 1 ? 0.11 : 0.04;
      projectileSpeed *= 1.08 + pierceFlowRatio * 0.035;
      bulletLifeSec = 2.06 + pierceFlowRatio * 0.08;
      muzzleColor = 0x8fdcff;
      if (pierceLaneScore >= 1.25) {
        projectileSpeed *= 1.05;
        bulletLifeSec += 0.12;
        this.registerPierceFlow(battle, { laneScore: pierceLaneScore });
      }
      if (target?.elite && eliteCrackRatio > 0.08) {
        spreadStep = shotCount > 1 ? Math.max(0.05, spreadStep - (0.016 + eliteCrackRatio * 0.022)) : 0.02;
        projectileSpeed *= 1 + eliteCrackRatio * 0.1;
        bulletLifeSec += 0.12 + eliteCrackRatio * 0.14;
        battle.playerMoveBoostSec = Math.max(battle.playerMoveBoostSec, 0.08 + eliteCrackRatio * 0.12);
        battle.tempoPulseSec = Math.max(battle.tempoPulseSec, 0.2 + eliteCrackRatio * 0.08);
        this.registerPierceFlow(battle, { laneScore: pierceLaneScore, eliteCrackRatio });
      }
    } else if (focusRoute === 'dash') {
      if (battle.dashDriveSec > 0 && shotCount < 2) {
        shotCount = 2;
      }
      spreadStep = shotCount > 1 ? (battle.dashDriveSec > 0 ? 0.24 : 0.2) : 0;
      projectileSpeed *= battle.dashDriveSec > 0 ? 1.12 : 1.05;
      bulletLifeSec = battle.dashDriveSec > 0 ? 1.46 : 1.64;
      muzzleColor = 0x90ffe0;
      if (targetAlignment > 0.72 && targetDistance <= 170) {
        spreadStep = shotCount > 1 ? Math.max(0.14, spreadStep - (battle.dashDriveSec > 0 ? 0.06 : 0.04)) : 0;
        projectileSpeed *= battle.dashDriveSec > 0 ? 1.06 : 1.03;
        if (dashStage === 'committed' || dashStage === 'matured') {
          battle.fireCooldownSec = Math.max(0.038, battle.fireCooldownSec - (battle.dashDriveSec > 0 ? 0.024 : 0.012));
        }
      }
    }
    if (killFlowBoost > 0) {
      projectileSpeed *= 1 + Math.min(0.04, killFlowBoost * 0.012);
      bulletLifeSec += Math.min(0.08, killFlowBoost * 0.03);
    }
    if (targetIsPickupLead && target && !target.elite) {
      projectileSpeed *= 1 + ordinarySurgeRatio * 0.04 + pickupLeadRatio * 0.05;
      bulletLifeSec += 0.05 + ordinarySurgeRatio * 0.04 + pickupLeadRatio * 0.04;
      battle.fireCooldownSec = Math.max(
        0.035,
        battle.fireCooldownSec - (0.006 + ordinarySurgeRatio * 0.008 + pickupLeadRatio * 0.01),
      );
      battle.playerMoveBoostSec = Math.max(
        battle.playerMoveBoostSec,
        0.08 + ordinarySurgeRatio * 0.08 + pickupLeadRatio * 0.06,
      );
      battle.tempoPulseSec = Math.max(
        battle.tempoPulseSec,
        0.16 + ordinarySurgeRatio * 0.08 + pickupLeadRatio * 0.08,
      );
    }
    if (eliteCrackRatio > 0.08) {
      battle.playerShotFlashSec = Math.max(battle.playerShotFlashSec, 0.09 + eliteCrackRatio * 0.02);
    }
    const spreadCenter = (shotCount - 1) / 2;
    const shotRecoilBase =
      (focusRoute === 'pierce'
        ? 5.8
        : focusRoute === 'dash'
          ? (battle.dashDriveSec > 0 ? 6.6 : 5.2)
          : battle.critOverdriveSec > 0
            ? 6.8
            : 5.6) +
      killFlowBoost * 0.7 +
      eliteCrackRatio * (focusRoute === 'crit' ? 1.4 : focusRoute === 'pierce' ? 1.1 : 0.7) +
      (targetIsPickupLead ? 0.9 + ordinarySurgeRatio * 1.2 + pickupLeadRatio * 1 : 0);
    battle.playerShotFlashSec = Math.max(battle.playerShotFlashSec, 0.08 + killFlowBoost * 0.01);
    battle.playerShotRecoilSec = Math.max(battle.playerShotRecoilSec, 0.11);
    battle.playerShotRecoilStrength = Math.max(
      battle.playerShotRecoilStrength * 0.55,
      shotRecoilBase + Math.min(2.8, (shotCount - 1) * 0.9),
    );
    this.createCombatPulse(battle, {
      x: battle.playerX + battle.playerAimDirX * 18,
      y: battle.playerY + battle.playerAimDirY * 18,
      radius: 10 + Math.min(6, shotCount * 1.2) + killFlowBoost * 1.2,
      lifeSec: 0.08 + killFlowRatio * 0.02,
      color: muzzleColor,
      secondaryColor: 0xffffff,
      fillAlpha: 0.12,
      strokeAlpha: 0.34 + killFlowRatio * 0.08,
      strokeWidth: 2,
      growthPerSec: 220 + killFlowBoost * 14,
      innerRadiusRatio: 0.54,
      spokeCount: Math.min(6, 3 + shotCount),
      spokeLength: 16 + killFlowBoost * 3,
      angle: baseAngle,
      spinRate: focusRoute === 'dash' ? 7.6 : focusRoute === 'pierce' ? 5.8 : 6.4,
    });
    this.kickBattleShake(battle, 0.05 + killFlowBoost * 0.008, focusRoute === 'dash' ? 0.18 + killFlowRatio * 0.03 : 0.12 + killFlowRatio * 0.02, 11);
    this.enqueueAudio('shoot');

    // Dash路线独特被动：动量加成
    let baseDamage = this.state.stats.damage;
    if ((dashStage === 'committed' || dashStage === 'matured') && battle.dashMomentumStacks > 0) {
      baseDamage *= 1 + battle.dashMomentumStacks * 0.08;
    }

    for (let index = 0; index < shotCount; index += 1) {
      const offset = (index - spreadCenter) * spreadStep;
      const angle = baseAngle + offset;
      battle.bullets.push({
        id: battle.nextBulletId++,
        x: battle.playerX,
        y: battle.playerY,
        vx: Math.cos(angle) * projectileSpeed,
        vy: Math.sin(angle) * projectileSpeed,
        damage: baseDamage,
        lifeSec: bulletLifeSec,
        pierceRemaining: this.state.stats.pierce,
        canEcho: this.state.routeCounts.pierce > 0,
        hitCount: 0,
        routeFocus: focusRoute ?? undefined,
      });
    }

    // Dash路线独特被动：幽灵打击（额外发射一颗子弹）
    if ((dashStage === 'committed' || dashStage === 'matured') && battle.dashGhostStrikeReady) {
      battle.dashGhostStrikeReady = false;
      const ghostAngle = baseAngle + (Math.random() - 0.5) * 0.3;
      battle.bullets.push({
        id: battle.nextBulletId++,
        x: battle.playerX,
        y: battle.playerY,
        vx: Math.cos(ghostAngle) * projectileSpeed * 1.15,
        vy: Math.sin(ghostAngle) * projectileSpeed * 1.15,
        damage: baseDamage * 0.7,
        lifeSec: bulletLifeSec,
        pierceRemaining: this.state.stats.pierce,
        canEcho: this.state.routeCounts.pierce > 0,
        hitCount: 0,
        routeFocus: 'dash',
      });
    }
  }

  private updateBullets(battle: BattleState, dt: number): void {
    const critStage = this.getRouteBuildStage('crit');
    const pierceStage = this.getRouteBuildStage('pierce');
    const dashStage = this.getRouteBuildStage('dash');
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
        let damage = critical ? bullet.damage * this.state.stats.critMultiplier : bullet.damage;

        // Crit路线独特被动：破绽累积 + 终结打击 + 爆发连锁
        const critStage = this.getRouteBuildStage('crit');
        if (critStage === 'committed' || critStage === 'matured') {
          if (!critical) {
            // 非暴击命中：累积破绽层数（最多5层）
            battle.critComboStacks = Math.min(5, battle.critComboStacks + 1);
            battle.critComboDecaySec = 2.0; // 2秒内无命中则重置
            if (battle.critComboStacks >= 5) {
              battle.critFinisherReady = true;
            }
          } else {
            // 暴击命中
            if (battle.critFinisherReady) {
              // 终结打击：5层时暴击伤害+150%
              damage *= 2.5; // 原伤害 * 2.5 = +150%
              battle.critFinisherReady = false;
              battle.critComboStacks = 0;
              battle.critComboDecaySec = 0;
              battle.critBurstChainCount = 0; // 重置爆发连锁计数
              battle.critBurstChainSec = 2.0; // 开启2秒爆发连锁窗口
            } else if (battle.critBurstChainSec > 0 && battle.critBurstChainCount < 3) {
              // 爆发连锁：终结打击后2秒内每次暴击额外+30%伤害（最多3次）
              damage *= 1.3;
              battle.critBurstChainCount += 1;
            }
            // 暴击也重置衰减计时器
            battle.critComboDecaySec = 2.0;
          }
        }
        if (bullet.routeFocus === 'pierce' || bullet.hitCount > 0) {
          damage *= Math.max(0.38, 1 - bullet.hitCount * 0.24);
        }
        const recoveryRatio = this.getEnemyRecoveryRatio(enemy);
        const eliteCrackRatio = enemy.elite ? this.getEliteCrackWindowRatio(battle) : 0;
        const ordinarySurgeRatio = this.getOrdinaryBattleSurgeRatio(battle);
        const pickupLeadRatio = this.isPickupLeadEnemy(battle, enemy) ? this.getPickupLeadRatio(battle) : 0;
        if (recoveryRatio > 0) {
          const punishBonus =
            bullet.routeFocus === 'crit' ? 0.22 : bullet.routeFocus === 'pierce' ? 0.16 : bullet.routeFocus === 'dash' ? 0.14 : 0.12;
          damage *= 1 + punishBonus * recoveryRatio;
        }
        if (enemy.elite && eliteCrackRatio > 0.08) {
          if (bullet.routeFocus === 'crit') {
            damage *= 1 + 0.08 + eliteCrackRatio * 0.14;
          } else if (bullet.routeFocus === 'pierce') {
            const laneScore = this.getPierceLaneScore(battle, enemy);
            damage *= 1 + Math.min(0.18, 0.06 + eliteCrackRatio * 0.08 + laneScore * 0.018);
          } else {
            damage *= 1 + eliteCrackRatio * 0.06;
          }
        }
        if (!enemy.elite && pickupLeadRatio > 0.08) {
          damage *= 1 + 0.04 + ordinarySurgeRatio * 0.06 + pickupLeadRatio * 0.08;
        }
        if (enemy.elite && enemy.guardSec > 0) {
          damage *= enemy.guardDamageMultiplier;
        }

        // dash-zero-window: 回切窗口内命中被 dash 标记敌人获得额外伤害
        if (battle.dashZeroWindowReady && battle.dashCounterWindowSec > 0 && enemy.dashMarkSec > 0) {
          damage *= 1.25; // 25% 额外伤害
          enemy.routeHitFlashSec = 0.18;
        }

        enemy.hp -= damage;
        bullet.hitCount += 1;

        // 记录击杀类型用于路线特色击杀奖励
        enemy.lastHitWasCrit = critical;
        enemy.lastHitWasPierce = bullet.hitCount > 1 || bullet.routeFocus === 'pierce';

        // Pierce路线独特被动
        const pierceStage = this.getRouteBuildStage('pierce');
        if (pierceStage === 'committed' || pierceStage === 'matured') {
          if (bullet.hitCount > 1) {
            // 穿透印记：穿透命中标记敌人
            battle.pierceFractureMark.add(enemy.id);

            // 连锁累积：穿透命中累积层数
            battle.pierceChainStacks = Math.min(3, battle.pierceChainStacks + 1);
            battle.pierceChainDecaySec = 2.0;

            // 连锁爆发：3层时额外伤害
            if (battle.pierceChainStacks >= 3) {
              damage *= 1.4;
              enemy.hp -= damage * 0.4; // 额外40%伤害
              battle.pierceChainStacks = 0;
              battle.pierceChainDecaySec = 0;
              // 创建连锁爆发视觉效果
              this.createCombatPulse(battle, {
                x: enemy.x,
                y: enemy.y,
                radius: 40,
                lifeSec: 0.3,
                color: 0x00ffcc,
                secondaryColor: 0xaaffff,
                fillAlpha: 0.6,
                strokeAlpha: 0.8,
                strokeWidth: 2,
                growthPerSec: 100,
                innerRadiusRatio: 0.5,
              });
            }
          }
        }

        const impactCue: AudioCue =
          critical ? 'crit' : bullet.routeFocus === 'pierce' ? 'pierceHit' : bullet.routeFocus === 'dash' ? 'dashHit' : 'hit';
        this.enqueueAudio(impactCue);
        this.registerEnemyImpact(battle, enemy, bullet.x, bullet.y, {
          flashSec: critical ? 0.22 : 0.14,
          kick: critical ? 11 : 6,
          pulseRadius: enemy.radius + (critical ? 12 : 6),
          pulseColor: critical ? 0xffcf74 : 0xff7d86,
          secondaryColor: critical ? 0xfff8d4 : 0xffffff,
        });
        this.kickBattleShake(battle, critical ? 0.14 : 0.08, critical ? 0.34 : 0.14, critical ? 30 : 25);
        battle.playerShotFlashSec = Math.max(battle.playerShotFlashSec, critical ? 0.095 : 0.072);
        battle.playerShotRecoilSec = Math.max(battle.playerShotRecoilSec, critical ? 0.11 : 0.09);
        battle.playerShotRecoilStrength = Math.max(battle.playerShotRecoilStrength, critical ? 7.2 : 5.6);
        if (!enemy.elite && pickupLeadRatio > 0.08) {
          battle.pickupLeadSec = Math.max(
            battle.pickupLeadSec,
            0.14 + ordinarySurgeRatio * 0.08 + pickupLeadRatio * 0.08,
          );
          battle.pickupFlowSec = Math.max(
            battle.pickupFlowSec,
            0.24 + ordinarySurgeRatio * 0.1 + pickupLeadRatio * 0.08,
          );
          battle.playerMoveBoostSec = Math.max(
            battle.playerMoveBoostSec,
            0.1 + ordinarySurgeRatio * 0.1 + pickupLeadRatio * 0.08,
          );
          battle.tempoPulseSec = Math.max(
            battle.tempoPulseSec,
            0.18 + ordinarySurgeRatio * 0.1 + pickupLeadRatio * 0.08,
          );
          battle.fireCooldownSec = Math.max(
            0.035,
            battle.fireCooldownSec - (0.006 + ordinarySurgeRatio * 0.008 + pickupLeadRatio * 0.008),
          );
          enemy.spawnFlashSec = Math.max(enemy.spawnFlashSec, 0.08 + pickupLeadRatio * 0.08);
          enemy.pressurePulseSec = Math.max(
            enemy.pressurePulseSec,
            0.08 + ordinarySurgeRatio * 0.06 + pickupLeadRatio * 0.06,
          );
          if (enemy.hp > 0) {
            this.pushEnemyRecovery(
              enemy,
              enemy.archetype === 'brute'
                ? 0.12 + pickupLeadRatio * 0.04
                : enemy.archetype === 'ranged'
                  ? 0.14 + pickupLeadRatio * 0.04
                  : 0.08 + pickupLeadRatio * 0.04,
            );
          }
          this.createCombatPulse(battle, {
            x: enemy.x,
            y: enemy.y,
            radius: enemy.radius + 14 + pickupLeadRatio * 8,
            lifeSec: 0.1 + pickupLeadRatio * 0.04,
            color: 0x9df7c5,
            secondaryColor: 0xffffff,
            fillAlpha: 0.04,
            strokeAlpha: 0.26 + ordinarySurgeRatio * 0.12 + pickupLeadRatio * 0.12,
            strokeWidth: 1.8,
            growthPerSec: 170,
            innerRadiusRatio: 0.7,
          });
        }
        if (enemy.elite && eliteCrackRatio > 0.08) {
          battle.tempoPulseSec = Math.max(battle.tempoPulseSec, 0.22 + eliteCrackRatio * 0.08);
          battle.playerShotFlashSec = Math.max(battle.playerShotFlashSec, 0.07 + eliteCrackRatio * 0.03);
          if (bullet.routeFocus === 'crit' || bullet.routeFocus === 'pierce') {
            this.createCombatPulse(battle, {
              x: enemy.x,
              y: enemy.y,
              radius: enemy.radius + 20 + eliteCrackRatio * 10,
              lifeSec: 0.12,
              color: bullet.routeFocus === 'crit' ? 0xffdfa0 : 0xa4e4ff,
              secondaryColor: 0xffffff,
              fillAlpha: 0.05,
              strokeAlpha: 0.48,
              strokeWidth: 2,
              growthPerSec: 196,
              innerRadiusRatio: 0.68,
            });
          }
        }
        this.applyEliteBreachHitFollowThrough(
          battle,
          enemy,
          bullet.routeFocus,
          critical,
          recoveryRatio,
          critStage,
          pierceStage,
          dashStage,
        );
        if (critical) {
          battle.critOverdriveSec = Math.min(4.2, battle.critOverdriveSec + this.getCritOverdriveDurationGain());
          battle.critChain += 1;
          battle.tempoPulseSec = Math.max(battle.tempoPulseSec, 0.18);
          // 流派构筑第三轮：暴击破绽承接机制
          const hadCritMark = enemy.critMarkSec > 0;
          const oldStacks = enemy.critMarkStacks ?? 0;

          // crit-afterglow: 破绽持续时间延长（基础2.4秒，激活后3.2秒）
          const baseMarkDuration = 2.4;
          const markDuration = battle.critAfterglowActive ? 3.2 : baseMarkDuration;
          enemy.critMarkSec = markDuration;
          enemy.routeHitFlashSec = 0.18;
          enemy.routeHitKind = 'crit';

          // crit-crownfire: 破绽爆发后短时收益窗口（如果处于窗口期，暴击伤害提升）
          if (battle.critCrownfireReady && battle.critBurstBonusSec > 0) {
            const crownfireBonus = battle.critBurstBonusRatio;
            enemy.hp -= bullet.damage * crownfireBonus;
            battle.critBurstBonusSec = 0;
            battle.critBurstBonusRatio = 0;
          }

          if (hadCritMark) {
            // 已带破绽：层数+1，给予小收益
            enemy.critMarkStacks = Math.min(3, oldStacks + 1);
            const chainBonus = 1 + (enemy.critMarkStacks * 0.08);
            enemy.hp -= bullet.damage * (chainBonus - 1);
          } else {
            // 新破绽：初始化1层
            enemy.critMarkStacks = 1;
          }

          // 3层破绽触发爆发
          if (enemy.critMarkStacks >= 3) {
            const bossMultiplier = enemy.elite ? 0.45 : 1.0;
            const ruptureDamage = 8 * bossMultiplier;
            enemy.hp -= ruptureDamage;
            enemy.critMarkStacks = 0;
            enemy.critMarkBurstReady = true;

            // crit-embershard: 破绽爆发时产生小范围爆点（对精英/Boss降倍率）
            if (battle.critEmbershardActive) {
              const emberRadius = 80;
              const emberBaseDamage = 6;
              const emberDamage = enemy.elite ? emberBaseDamage * 0.35 : emberBaseDamage;
              // 对范围内其他敌人造成伤害
              for (const nearby of battle.enemies) {
                if (nearby.id === enemy.id || nearby.hp <= 0) {
                  continue;
                }
                const dx = nearby.x - enemy.x;
                const dy = nearby.y - enemy.y;
                const distance = Math.hypot(dx, dy);
                if (distance <= emberRadius + nearby.radius) {
                  nearby.hp -= emberDamage;
                  nearby.routeHitFlashSec = 0.14;
                  nearby.routeHitKind = 'crit';
                }
              }
              // 爆点视觉反馈
              this.createCombatPulse(battle, {
                x: enemy.x,
                y: enemy.y,
                radius: enemy.radius + 50,
                lifeSec: 0.28,
                color: 0xff8c42,
                secondaryColor: 0xffd4a3,
                fillAlpha: 0.10,
                strokeAlpha: 0.75,
                strokeWidth: 2.8,
                growthPerSec: 200,
                innerRadiusRatio: 0.45,
              });
            }

            // crit-crownfire: 破绽爆发后短时间提高下一次暴击收益
            if (battle.critCrownfireReady) {
              battle.critBurstBonusSec = 2.5; // 2.5秒窗口
              battle.critBurstBonusRatio = 0.35; // 35%额外伤害
            }

            // 视觉和音效反馈
            this.createCombatPulse(battle, {
              x: enemy.x,
              y: enemy.y,
              radius: enemy.radius + 24,
              lifeSec: 0.22,
              color: 0xff6b2c,
              secondaryColor: 0xffaa5e,
              fillAlpha: 0.12,
              strokeAlpha: 0.88,
              strokeWidth: 3,
              growthPerSec: 220,
              innerRadiusRatio: 0.55,
            });
            this.enqueueAudio('critSplash');
          }

          // 原承接收益（低层兼容）
          if (hadCritMark && battle.critChain >= 2) {
            const bonusDamage = bullet.damage * 0.10;
            enemy.hp -= bonusDamage;
          }
          if (critStage === 'committed' || critStage === 'matured') {
            const cadenceRefund = critStage === 'matured' ? 0.05 : 0.032;
            battle.fireCooldownSec = Math.max(0.035, battle.fireCooldownSec - cadenceRefund);
            if (enemy.elite || enemy.hp <= enemy.maxHp * 0.36) {
              this.createCombatPulse(battle, {
                x: enemy.x,
                y: enemy.y,
                radius: enemy.radius + 16,
                lifeSec: 0.16,
                color: 0xffd36e,
                secondaryColor: 0xfff4c7,
                fillAlpha: 0.08,
                strokeAlpha: 0.76,
                strokeWidth: 2,
                growthPerSec: 176,
                innerRadiusRatio: 0.66,
              });
              battle.tempoPulseSec = Math.max(battle.tempoPulseSec, 0.24);
            }
          }
          this.enqueueTip('暴击命中');
          if (recoveryRatio > 0.25 && (critStage === 'committed' || critStage === 'matured')) {
            battle.fireCooldownSec = Math.max(0.035, battle.fireCooldownSec - 0.012);
            this.createCombatPulse(battle, {
              x: enemy.x,
              y: enemy.y,
              radius: enemy.radius + 20,
              lifeSec: 0.14,
              color: 0xffe39c,
              secondaryColor: 0xfff9df,
              fillAlpha: 0.06,
              strokeAlpha: 0.62,
              strokeWidth: 2,
              growthPerSec: 170,
              innerRadiusRatio: 0.68,
            });
          }
          if (battle.critChain >= 2 && !this.routeMomentShown.crit) {
            this.routeMomentShown.crit = true;
            this.enqueueTip('暴击节奏开始升温');
          }
        } else if (battle.critChain > 0) {
          battle.critChain = Math.max(0, battle.critChain - 1);
        }

        if (bullet.routeFocus === 'pierce') {
          const laneScore = this.getPierceLaneScore(battle, enemy);
          // 流派构筑第三轮：穿透裂纹承接机制
          const wasMarked = enemy.pierceMarkSec > 0;
          const oldStacks = enemy.pierceMarkStacks ?? 0;

          enemy.pierceMarkSec = 1.8;
          enemy.routeHitFlashSec = 0.16;
          enemy.routeHitKind = 'pierce';
          enemy.pierceChainHits = Math.max(enemy.pierceChainHits ?? 0, bullet.hitCount + 1);

          if (wasMarked && bullet.hitCount >= 1) {
            // 再次贯穿裂纹敌人：层数+1，获得清线收益
            enemy.pierceMarkStacks = Math.min(3, oldStacks + 1);
            const chainBonus = enemy.elite ? 1.08 : 1.16;
            bullet.damage *= chainBonus;

            // 3层裂纹触发裂纹扩散
            if (enemy.pierceMarkStacks >= 3) {
              this.triggerPierceCrack(battle, enemy, bullet);
              enemy.pierceMarkStacks = 0;
            }
          } else if (!wasMarked) {
            // 新裂纹：初始化1层
            enemy.pierceMarkStacks = 1;
          }

          // 原穿透流程
          if (laneScore >= 1.2 || bullet.hitCount >= 2) {
            const pierceChain = this.registerPierceFlow(battle, {
              laneScore,
              hitCount: bullet.hitCount,
              eliteCrackRatio,
            });
            const refund = Math.min(0.028, 0.01 + laneScore * 0.005 + Math.max(0, bullet.hitCount - 1) * 0.004);
            battle.fireCooldownSec = Math.max(0.035, battle.fireCooldownSec - refund);
            battle.tempoPulseSec = Math.max(battle.tempoPulseSec, 0.2 + Math.min(0.08, pierceChain * 0.014));
            battle.playerShotFlashSec = Math.max(battle.playerShotFlashSec, 0.08 + Math.min(0.04, pierceChain * 0.008));
            this.createCombatPulse(battle, {
              x: enemy.x,
              y: enemy.y,
              radius: enemy.radius + 16 + Math.min(10, laneScore * 3),
              lifeSec: 0.14,
              color: 0x8fdbff,
              secondaryColor: 0xf6fcff,
              fillAlpha: 0.05,
              strokeAlpha: 0.52,
              strokeWidth: 2,
              growthPerSec: 182,
              innerRadiusRatio: 0.66,
              spokeCount: Math.min(5, 2 + pierceChain),
              spokeLength: 10 + Math.min(12, laneScore * 3),
              angle: Math.atan2(bullet.vy, bullet.vx),
              spinRate: 5.2,
            });
          }
        }

        // 流派构筑第三轮：回切反打窗口命中收益
        if (battle.dashCounterWindowSec > 0 && enemy.dashMarkSec > 0) {
          const counterBonus = 1.12;
          enemy.hp -= bullet.damage * (counterBonus - 1);
          enemy.routeHitFlashSec = 0.14;
          enemy.routeHitKind = 'dash';
          this.createCombatPulse(battle, {
            x: enemy.x,
            y: enemy.y,
            radius: enemy.radius + 14,
            lifeSec: 0.12,
            color: 0x7aff7a,
            secondaryColor: 0xc8ffc8,
            fillAlpha: 0.08,
            strokeAlpha: 0.72,
            strokeWidth: 2,
            growthPerSec: 180,
            innerRadiusRatio: 0.6,
          });
        }

        this.applyDashDriveHitFollowThrough(
          battle,
          enemy,
          bullet.routeFocus,
          critical,
          recoveryRatio,
          eliteCrackRatio,
          dashStage,
        );
        if (enemy.elite && eliteCrackRatio > 0.08) {
          this.markEliteCrackFollowThroughMoment(
            battle,
            eliteCrackRatio * 0.68 + recoveryRatio * 0.22 + (critical ? 0.1 : 0),
          );
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

  private applyDashDriveHitFollowThrough(
    battle: BattleState,
    enemy: BattleState['enemies'][number],
    bulletRouteFocus: BattleState['bullets'][number]['routeFocus'],
    critical: boolean,
    recoveryRatio: number,
    eliteCrackRatio: number,
    dashStage: RouteBuildStage,
  ): void {
    if (bulletRouteFocus !== 'dash' || dashStage === 'unformed' || battle.dashDriveSec <= 0) {
      return;
    }

    const distanceToEnemy = Math.max(1, Math.hypot(enemy.x - battle.playerX, enemy.y - battle.playerY));
    const closeRatio = Phaser.Math.Clamp(1 - Math.max(0, distanceToEnemy - enemy.radius - 28) / 132, 0, 1);
    const driveRatio = Phaser.Math.Clamp(
      battle.dashDriveSec / (dashStage === 'matured' ? 1.18 : dashStage === 'committed' ? 0.94 : 0.72),
      0,
      1,
    );
    const cadenceRefund = Math.min(
      0.042,
      (dashStage === 'matured' ? 0.012 : 0.008) +
        closeRatio * 0.014 +
        driveRatio * 0.008 +
        Math.max(0, recoveryRatio - 0.12) * 0.026 +
        (enemy.elite ? eliteCrackRatio * 0.014 : 0) +
        (critical ? 0.004 : 0),
    );
    battle.fireCooldownSec = Math.max(0.035, battle.fireCooldownSec - cadenceRefund);
    battle.playerMoveBoostSec = Math.max(
      battle.playerMoveBoostSec,
      0.12 + closeRatio * 0.1 + driveRatio * 0.05 + (enemy.elite ? 0.03 : 0),
    );
    battle.playerTurnBurstSec = Math.max(
      battle.playerTurnBurstSec,
      0.1 + closeRatio * 0.08 + driveRatio * 0.04 + (enemy.elite ? 0.02 : 0),
    );
    battle.playerRecoverySec = Math.max(
      battle.playerRecoverySec,
      0.08 + closeRatio * 0.06 + Math.max(0, recoveryRatio - 0.1) * 0.12,
    );
    battle.tempoPulseSec = Math.max(
      battle.tempoPulseSec,
      0.22 + closeRatio * 0.08 + driveRatio * 0.06 + (enemy.elite ? eliteCrackRatio * 0.04 : 0),
    );
    battle.playerShotFlashSec = Math.max(
      battle.playerShotFlashSec,
      0.078 + closeRatio * 0.018 + (enemy.elite ? eliteCrackRatio * 0.014 : 0),
    );
    battle.dashDriveSec = Math.min(
      dashStage === 'matured' ? 1.72 : 1.52,
      battle.dashDriveSec + (enemy.elite ? 0.1 : 0.06) + closeRatio * 0.04 + eliteCrackRatio * 0.04,
    );
    const payoffStrength =
      closeRatio * 0.44 +
      driveRatio * 0.24 +
      Math.max(0, recoveryRatio - 0.1) * 0.78 +
      eliteCrackRatio * 0.36 +
      (enemy.elite ? 0.18 : 0) +
      (critical ? 0.08 : 0);
    this.markLateDashWindowMoment(battle, payoffStrength);
    this.markDashCounterMoment(
      battle,
      Math.max(
        payoffStrength,
        Math.max(0, recoveryRatio - 0.12) * 0.92 + eliteCrackRatio * 0.42 + (enemy.elite ? 0.12 : 0),
      ),
    );
    if (enemy.elite && eliteCrackRatio > 0.08) {
      this.markEliteCrackFollowThroughMoment(
        battle,
        eliteCrackRatio * 0.72 + closeRatio * 0.28 + (critical ? 0.08 : 0),
      );
    }

    if (closeRatio > 0.12 || enemy.elite) {
      const angle = Math.atan2(enemy.y - battle.playerY, enemy.x - battle.playerX);
      this.createCombatPulse(battle, {
        x: enemy.x,
        y: enemy.y,
        radius: enemy.radius + 14 + closeRatio * 10 + (enemy.elite ? eliteCrackRatio * 8 : 0),
        lifeSec: 0.1 + closeRatio * 0.03,
        color: 0x8ef7d5,
        secondaryColor: 0xffffff,
        fillAlpha: 0.04,
        strokeAlpha: 0.34 + closeRatio * 0.16 + (enemy.elite ? eliteCrackRatio * 0.08 : 0),
        strokeWidth: 1.8,
        growthPerSec: 176 + closeRatio * 18,
        innerRadiusRatio: 0.72,
        spokeCount: enemy.elite ? 4 : 3,
        spokeLength: 12 + closeRatio * 10 + (enemy.elite ? eliteCrackRatio * 6 : 0),
        angle,
        spinRate: 6.4,
      });
    }
  }

  private updateEnemies(battle: BattleState, dt: number): void {
    const survivors = [];
    const template = BATTLE_TEMPLATES[battle.templateId];
    for (const enemy of battle.enemies) {
      const previousX = enemy.x;
      const previousY = enemy.y;
      const hadPressurePulse = enemy.pressurePulseSec > 0;
      enemy.guardSec = Math.max(0, enemy.guardSec - dt);
      if (enemy.elite && enemy.guardSec <= 0) {
        enemy.guardDamageMultiplier = template.eliteRule?.guardDamageMultiplier ?? 1;
      }
      enemy.grazeCooldownSec = Math.max(0, enemy.grazeCooldownSec - dt);
      enemy.recoverySec = Math.max(0, enemy.recoverySec - dt);
      enemy.hitFlashSec = Math.max(0, enemy.hitFlashSec - dt);
      enemy.spawnFlashSec = Math.max(0, enemy.spawnFlashSec - dt);
      enemy.pressurePulseSec = Math.max(0, enemy.pressurePulseSec - dt);
      enemy.tacticCooldownSec = Math.max(0, enemy.tacticCooldownSec - dt);
      // 流派构筑第二轮：敌人状态标记递减
      enemy.critMarkSec = Math.max(0, enemy.critMarkSec - dt);
      enemy.pierceMarkSec = Math.max(0, enemy.pierceMarkSec - dt);
      enemy.dashMarkSec = Math.max(0, enemy.dashMarkSec - dt);
      // 流派构筑第三轮：命中特效递减
      enemy.routeHitFlashSec = Math.max(0, (enemy.routeHitFlashSec ?? 0) - dt);
      enemy.hitOffsetX *= Math.max(0, 1 - dt * 14);
      enemy.hitOffsetY *= Math.max(0, 1 - dt * 14);
      if (enemy.hp <= 0) {
        battle.kills += 1;
        this.handleEnemyDefeated(battle, enemy);
        if (enemy.elite) {
          battle.eliteAlive = false;
        }
        continue;
      }

      if (enemy.elite && template.eliteRule) {
        this.updateEliteEnemy(enemy, battle, template, dt);
      } else {
        if (!enemy.elite && enemy.role === 'escort' && battle.eliteAlive && battle.eliteCrackWindowSec > 0) {
          this.stabilizeEliteCrackEscort(battle, enemy);
        }
        this.updateArchetypeEnemy(enemy, battle, dt);
      }

      if (enemy.elite && hadPressurePulse && enemy.pressurePulseSec <= 0) {
        this.resolveElitePressurePulse(enemy, battle, template);
      }

      if (this.debugConfig.freezeEnemyMovement) {
        enemy.x = previousX;
        enemy.y = previousY;
        enemy.hitOffsetX = 0;
        enemy.hitOffsetY = 0;
      }

      enemy.debugMoveVX = dt > 0 ? (enemy.x - previousX) / dt : 0;
      enemy.debugMoveVY = dt > 0 ? (enemy.y - previousY) / dt : 0;

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
        this.createCombatPulse(battle, {
          x: enemy.x,
          y: enemy.y,
          radius: enemy.radius + 8,
          lifeSec: 0.14,
          color: 0x77ffd9,
          secondaryColor: 0xf2fffb,
          fillAlpha: 0.05,
          strokeAlpha: 0.42,
          strokeWidth: 2,
          growthPerSec: 128,
          innerRadiusRatio: 0.76,
        });
        if (dashStage === 'committed' || dashStage === 'matured') {
          battle.dashDriveSec = Math.max(battle.dashDriveSec, 0.7);
          battle.dashCooldownSec = Math.max(0.75, battle.dashCooldownSec - 0.35);
          this.state.stats.hp = clamp(this.state.stats.hp + 0.22, 0, this.state.stats.maxHp);
          battle.playerRecoverySec = Math.max(battle.playerRecoverySec, 0.12);
        }
      }

      if (distance <= enemy.radius + PLAYER_COLLISION_RADIUS) {
        if (battle.invulnerableSec <= 0 && !this.debugConfig.invulnerablePlayer) {
          if (
            battle.encounterType === 'boss' &&
            this.isPointInsidePressureSafeWindow(battle, battle.playerX, battle.playerY, 12)
          ) {
            battle.invulnerableSec = Math.max(battle.invulnerableSec, 0.12);
            const bounceAngle = Math.atan2(enemy.y - battle.playerY, enemy.x - battle.playerX);
            enemy.x = clamp(enemy.x + Math.cos(bounceAngle) * 34, -48, ARENA_WIDTH + 48);
            enemy.y = clamp(enemy.y + Math.sin(bounceAngle) * 34, -48, ARENA_HEIGHT + 48);
            enemy.hitFlashSec = Math.max(enemy.hitFlashSec, 0.12);
            continue;
          }
          let damage = enemy.contactDamage;
          damage *= this.getDashDamageMultiplier(dashStage, battle.dashDriveSec);
          this.state.stats.hp = clamp(this.state.stats.hp - damage, 0, this.state.stats.maxHp);
          battle.invulnerableSec = 0.35;
          battle.playerImpactSec = Math.max(battle.playerImpactSec, 0.34);
          this.queueImpactFreeze(battle, enemy.elite ? 0.09 : 0.068, enemy.elite ? 0.1 : 0.15);
          this.pushPlayerKnockback(battle, enemy.x, enemy.y, enemy.elite ? 240 : 190);
          this.kickBattleShake(battle, 0.22, enemy.elite ? 0.76 : 0.48, 9);
          this.registerPlayerThreatDirection(battle, enemy.x, enemy.y, 0.34);
          this.createCombatPulse(battle, {
            x: battle.playerX,
            y: battle.playerY,
            radius: enemy.radius + 18,
            lifeSec: 0.22,
            color: 0xff6f66,
            secondaryColor: 0xffd8d2,
            fillAlpha: 0.12,
            strokeAlpha: 0.9,
            strokeWidth: 3,
            growthPerSec: 210,
            innerRadiusRatio: 0.62,
            spokeCount: enemy.elite ? 6 : 4,
            spokeLength: enemy.elite ? 26 : 20,
            angle: Math.atan2(battle.playerY - enemy.y, battle.playerX - enemy.x),
            spinRate: enemy.elite ? 6.8 : 5.2,
          });
          this.enqueueAudio('hurt');
          if (this.finishBattleOnPlayerDefeat(battle)) {
            battle.enemies = survivors;
            return;
          }
        }
        const bounceAngle = Math.atan2(enemy.y - battle.playerY, enemy.x - battle.playerX);
        const bounceDistance = enemy.elite ? 14 : 22;
        enemy.x = clamp(enemy.x + Math.cos(bounceAngle) * bounceDistance, -48, ARENA_WIDTH + 48);
        enemy.y = clamp(enemy.y + Math.sin(bounceAngle) * bounceDistance, -48, ARENA_HEIGHT + 48);
        enemy.hitOffsetX = Math.cos(bounceAngle) * (enemy.elite ? 8 : 11);
        enemy.hitOffsetY = Math.sin(bounceAngle) * (enemy.elite ? 8 : 11);
        enemy.hitFlashSec = Math.max(enemy.hitFlashSec, 0.1);
        this.pushEnemyRecovery(enemy, this.getEnemyRecoveryOnCollisionSec(enemy));
        this.createCombatPulse(battle, {
          x: enemy.x,
          y: enemy.y,
          radius: enemy.radius + 12,
          lifeSec: 0.14,
          color: 0xbef6ff,
          secondaryColor: 0xffffff,
          fillAlpha: 0.04,
          strokeAlpha: 0.42,
          strokeWidth: 2,
          growthPerSec: 140,
          innerRadiusRatio: 0.72,
        });
        if (this.debugConfig.freezeEnemyMovement) {
          enemy.x = previousX;
          enemy.y = previousY;
          enemy.hitOffsetX = 0;
          enemy.hitOffsetY = 0;
        }
        enemy.debugMoveVX = dt > 0 ? (enemy.x - previousX) / dt : 0;
        enemy.debugMoveVY = dt > 0 ? (enemy.y - previousY) / dt : 0;
        survivors.push(enemy);
        continue;
      }

      survivors.push(enemy);
    }
    battle.enemies = survivors;
  }

  private updateArchetypeEnemy(enemy: BattleState['enemies'][number], battle: BattleState, dt: number): void {
    // 护卫使用专门的护卫AI
    if (enemy.role === 'escort') {
      this.updateEscortEnemy(enemy, battle, dt);
      return;
    }

    switch (enemy.archetype) {
      case 'standard':
        this.updateStandardEnemy(enemy, battle, dt);
        return;
      case 'brute':
        this.updateBruteEnemy(enemy, battle, dt);
        return;
      case 'skirmisher':
        this.updateSkirmisherEnemy(enemy, battle, dt);
        return;
      case 'ranged':
        this.updateRangedEnemy(enemy, battle, dt);
        return;
      default:
        this.updateStandardEnemy(enemy, battle, dt);
        return;
    }
  }

  private updateStandardEnemy(enemy: BattleState['enemies'][number], battle: BattleState, dt: number): void {
    const template = BATTLE_TEMPLATES[battle.templateId];
    const dx = battle.playerX - enemy.x;
    const dy = battle.playerY - enemy.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const dirX = dx / distance;
    const dirY = dy / distance;
    const strafeX = -dirY;
    const strafeY = dirX;
    const recoveryRatio = this.getEnemyRecoveryRatio(enemy);
    const pattern = template.spawnRule?.pattern ?? 'surround';
    const laneBias = template.spawnRule?.laneBias ?? 'horizontal';
    const weave = Math.sin(battle.elapsedSec * 1.4 + enemy.id * 0.33);
    const frontlineAnchor = this.findNearestAlly(
      battle,
      enemy,
      (candidate) => candidate.elite || candidate.archetype === 'brute',
    );
    const rangedAnchor = this.findNearestAlly(
      battle,
      enemy,
      (candidate) => !candidate.elite && candidate.archetype === 'ranged',
    );
    const ordinarySurgeRatio = this.getOrdinaryBattleSurgeRatio(battle);
    const pickupFlowRatio = this.getPickupFlowRatio(battle);
    const pickupLeadRatio = this.isPickupLeadEnemy(battle, enemy) ? this.getPickupLeadRatio(battle) : 0;
    const packCount = this.countNearbyAllies(
      battle,
      enemy,
      92,
      (candidate) => !candidate.elite && (candidate.archetype === 'standard' || candidate.archetype === 'brute'),
    );
    const openingRatio = Math.min(1, enemy.spawnFlashSec / 0.22);
    const pushWeight = distance > 150 ? 1.02 : distance > 90 ? 0.9 : 0.78;
    let moveX = dirX * pushWeight + strafeX * weave * 0.08;
    let moveY = dirY * pushWeight + strafeY * weave * 0.08;

    if (pattern === 'pincers') {
      const clampTargetY = battle.playerY + ((enemy.id % 3) - 1) * 20;
      const clampBias = clamp((clampTargetY - enemy.y) / 92, -1, 1);
      moveX = dirX * (distance > 150 ? 0.96 : distance > 92 ? 0.88 : 0.8);
      moveY = dirY * 0.42 + clampBias * 0.62 + strafeY * weave * 0.08;
    } else if (pattern === 'lanes') {
      if (laneBias === 'vertical') {
        const laneTarget = this.getPlayerLaneTargetCoordinate(
          battle,
          'vertical',
          enemy.x < battle.playerX ? -1 : 1,
        );
        const laneAlign = clamp((laneTarget - enemy.x) / 84, -1, 1);
        moveX = laneAlign * 0.76 + dirX * 0.32 + strafeX * weave * 0.04;
        moveY = dirY * (distance > 114 ? 0.94 : 0.72);
      } else {
        const laneTarget = this.getPlayerLaneTargetCoordinate(
          battle,
          'horizontal',
          enemy.y < battle.playerY ? -1 : 1,
        );
        const laneAlign = clamp((laneTarget - enemy.y) / 84, -1, 1);
        moveX = dirX * (distance > 114 ? 0.94 : 0.72);
        moveY = laneAlign * 0.76 + dirY * 0.32 + strafeY * weave * 0.04;
      }
    }

    if (frontlineAnchor) {
      const anchorDistance = Math.max(1, Math.hypot(frontlineAnchor.x - enemy.x, frontlineAnchor.y - enemy.y));
      if (anchorDistance <= 156) {
        const anchorPlayerDx = battle.playerX - frontlineAnchor.x;
        const anchorPlayerDy = battle.playerY - frontlineAnchor.y;
        const anchorPlayerDistance = Math.max(1, Math.hypot(anchorPlayerDx, anchorPlayerDy));
        const anchorDirX = anchorPlayerDx / anchorPlayerDistance;
        const anchorDirY = anchorPlayerDy / anchorPlayerDistance;
        const anchorOrthoX = -anchorDirY;
        const anchorOrthoY = anchorDirX;
        const shoulderSign = enemy.id % 2 === 0 ? -1 : 1;
        const slotX =
          frontlineAnchor.x +
          anchorDirX * (frontlineAnchor.radius + enemy.radius + 10) +
          anchorOrthoX * shoulderSign * (frontlineAnchor.radius * 0.42 + 8);
        const slotY =
          frontlineAnchor.y +
          anchorDirY * (frontlineAnchor.radius + enemy.radius + 10) +
          anchorOrthoY * shoulderSign * (frontlineAnchor.radius * 0.42 + 8);
        const slotDx = slotX - enemy.x;
        const slotDy = slotY - enemy.y;
        const slotDistance = Math.max(1, Math.hypot(slotDx, slotDy));
        moveX += (slotDx / slotDistance) * 0.62;
        moveY += (slotDy / slotDistance) * 0.62;
        if (
          distance <= 140 &&
          recoveryRatio <= 0.05 &&
          (openingRatio > 0.18 || packCount >= 2) &&
          this.triggerRegularPressureBeat(battle, enemy, 0.18, 1.3)
        ) {
          const syncedCount = this.syncRegularPressurePack(battle, enemy, {
            radius: 88,
            limit: packCount >= 2 ? 2 : 1,
            durationSec: 0.11,
            cooldownSec: 0.86,
            predicate: (candidate) => candidate.archetype === 'standard' || candidate.archetype === 'brute',
          });
          if (syncedCount > 0) {
            this.enqueueRegularRelayAudio('standard');
          }
        }
      }
    } else if (rangedAnchor) {
      const anchorDistance = Math.max(1, Math.hypot(rangedAnchor.x - enemy.x, rangedAnchor.y - enemy.y));
      if (anchorDistance <= 144) {
        moveX += ((rangedAnchor.x - enemy.x) / anchorDistance) * 0.34;
        moveY += ((rangedAnchor.y - enemy.y) / anchorDistance) * 0.34;
      }
    }
    if (openingRatio > 0) {
      moveX += dirX * (0.08 + openingRatio * (frontlineAnchor ? 0.24 : 0.18));
      moveY += dirY * (0.08 + openingRatio * (frontlineAnchor ? 0.24 : 0.18));
      if (!frontlineAnchor && packCount > 0) {
        moveX += strafeX * weave * 0.04;
        moveY += strafeY * weave * 0.04;
      }
    }
    if (ordinarySurgeRatio > 0.12) {
      const surgePush = 0.06 + ordinarySurgeRatio * (pickupLeadRatio > 0.08 ? 0.26 : 0.16);
      moveX += dirX * surgePush;
      moveY += dirY * surgePush;
      if (packCount > 0) {
        moveX += strafeX * weave * (0.02 + ordinarySurgeRatio * 0.04);
        moveY += strafeY * weave * (0.02 + ordinarySurgeRatio * 0.04);
      }
    }

    if (enemy.pressurePulseSec > 0) {
      const pressureRatio = Math.min(1, enemy.pressurePulseSec / this.getEnemyPressureWindowSec(enemy));
      moveX += dirX * (0.16 + pressureRatio * 0.3 + Math.min(0.12, packCount * 0.03));
      moveY += dirY * (0.16 + pressureRatio * 0.3 + Math.min(0.12, packCount * 0.03));
    }

    if (recoveryRatio > 0) {
      const peelSign = enemy.id % 2 === 0 ? -1 : 1;
      moveX += strafeX * peelSign * (0.16 + recoveryRatio * 0.3);
      moveY += strafeY * peelSign * (0.16 + recoveryRatio * 0.3);
      moveX -= dirX * (0.08 + recoveryRatio * 0.18);
      moveY -= dirY * (0.08 + recoveryRatio * 0.18);
    }
    if (
      ordinarySurgeRatio > 0.18 &&
      recoveryRatio <= 0.06 &&
      distance <= 142 &&
      (pickupLeadRatio > 0.08 || packCount >= 1 || pickupFlowRatio > 0.22) &&
      this.triggerRegularPressureBeat(
        battle,
        enemy,
        0.12 + ordinarySurgeRatio * 0.08,
        0.92 - Math.min(0.12, ordinarySurgeRatio * 0.14),
      )
    ) {
      const syncedCount = this.syncRegularPressurePack(battle, enemy, {
        radius: 86 + ordinarySurgeRatio * 18,
        limit: pickupLeadRatio > 0.08 || packCount >= 2 ? 2 : 1,
        durationSec: 0.1 + ordinarySurgeRatio * 0.04,
        cooldownSec: 0.78 + Math.max(0, 0.08 - ordinarySurgeRatio * 0.04),
        predicate: (candidate) => candidate.archetype === 'standard' || candidate.archetype === 'brute',
      });
      if (syncedCount > 0) {
        this.primeRegularPressureLead(battle, enemy, 0.76 + ordinarySurgeRatio * 0.36);
      }
    }

    const magnitude = Math.max(1, Math.hypot(moveX, moveY));
    const speedMultiplier =
      1 +
      openingRatio * (frontlineAnchor ? 0.14 : 0.08) +
      Math.min(0.06, packCount * 0.02) +
      ordinarySurgeRatio * (pickupLeadRatio > 0.08 ? 0.12 : 0.06) -
      recoveryRatio * 0.48;

    enemy.x = clamp(enemy.x + (moveX / magnitude) * enemy.speed * speedMultiplier * dt, -36, ARENA_WIDTH + 36);
    enemy.y = clamp(enemy.y + (moveY / magnitude) * enemy.speed * speedMultiplier * dt, -36, ARENA_HEIGHT + 36);
  }

  private updateBruteEnemy(enemy: BattleState['enemies'][number], battle: BattleState, dt: number): void {
    const template = BATTLE_TEMPLATES[battle.templateId];
    const dx = battle.playerX - enemy.x;
    const dy = battle.playerY - enemy.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const dirX = dx / distance;
    const dirY = dy / distance;
    const strafeX = -dirY;
    const strafeY = dirX;
    const recoveryRatio = this.getEnemyRecoveryRatio(enemy);
    const pattern = template.spawnRule?.pattern ?? 'surround';
    const laneBias = template.spawnRule?.laneBias ?? 'horizontal';
    const lanePulse = 0.5 + Math.sin(battle.elapsedSec * 1.28 + enemy.id * 0.29) * 0.5;
    const supportCount = this.countNearbyAllies(
      battle,
      enemy,
      124,
      (candidate) => candidate.elite || candidate.archetype === 'standard',
    );
    const ordinarySurgeRatio = this.getOrdinaryBattleSurgeRatio(battle);
    const pickupLeadRatio = this.isPickupLeadEnemy(battle, enemy) ? this.getPickupLeadRatio(battle) : 0;
    const alignBias =
      pattern === 'lanes'
        ? laneBias === 'horizontal'
          ? clamp((battle.playerY - enemy.y) / 96, -1, 1)
          : clamp((battle.playerX - enemy.x) / 96, -1, 1)
        : 0;
    const driveWindow = Math.sin(battle.elapsedSec * 0.92 + enemy.id * 0.41);
    const openingRatio = Math.min(1, enemy.spawnFlashSec / 0.22);
    let moveX = dirX * 0.84;
    let moveY = dirY * 0.84;

    if (pattern === 'lanes' && laneBias === 'horizontal') {
      const laneTarget = this.getPlayerLaneTargetCoordinate(battle, 'horizontal');
      const laneAlign = clamp((laneTarget - enemy.y) / 72, -1, 1);
      if (distance > 176) {
        moveX = dirX * 0.82;
        moveY = laneAlign * 0.88;
      } else if (distance > 92) {
        moveX = dirX * (0.92 + lanePulse * 0.44);
        moveY = laneAlign * 0.74 + strafeY * 0.08;
      } else {
        moveX = dirX * (1.14 + lanePulse * 0.3);
        moveY = laneAlign * 0.26;
      }
    } else if (pattern === 'lanes' && laneBias === 'vertical') {
      const laneTarget = this.getPlayerLaneTargetCoordinate(battle, 'vertical');
      const laneAlign = clamp((laneTarget - enemy.x) / 76, -1, 1);
      if (distance > 176) {
        moveX = laneAlign * 0.54 + dirX * 0.54;
        moveY = dirY * 0.82;
      } else if (distance > 92) {
        moveX = laneAlign * 0.46 + dirX * 0.72;
        moveY = dirY * (0.96 + lanePulse * 0.22);
      } else {
        moveX = dirX * 0.9;
        moveY = dirY * 1.02;
      }
    } else if (pattern === 'pincers') {
      const clampTargetY = battle.playerY + Math.sin(enemy.id * 0.83) * 26;
      const clampBias = clamp((clampTargetY - enemy.y) / 96, -1, 1);
      if (distance > 176) {
        moveX = dirX * 0.92;
        moveY = dirY * 0.26 + clampBias * 0.42;
      } else if (distance > 88) {
        moveX = dirX * (0.98 + Math.max(0, driveWindow) * 0.34);
        moveY = dirY * 0.24 + clampBias * 0.28;
      } else {
        moveX = dirX * 1.28;
        moveY = dirY * 0.38;
      }
    } else if (distance > 176) {
      moveX += strafeX * alignBias * 0.24;
      moveY += strafeY * alignBias * 0.24;
    } else if (distance > 88) {
      moveX += dirX * (0.26 + Math.max(0, driveWindow) * 0.42);
      moveY += dirY * (0.26 + Math.max(0, driveWindow) * 0.42);
      moveX += strafeX * alignBias * 0.12;
      moveY += strafeY * alignBias * 0.12;
    } else {
      moveX += dirX * 0.6;
      moveY += dirY * 0.6;
    }
    if (openingRatio > 0) {
      moveX += dirX * (0.14 + openingRatio * 0.32);
      moveY += dirY * (0.14 + openingRatio * 0.32);
    }
    if (ordinarySurgeRatio > 0.12) {
      const shove = 0.08 + ordinarySurgeRatio * (pickupLeadRatio > 0.08 ? 0.32 : 0.22);
      moveX += dirX * shove;
      moveY += dirY * shove;
    }

    if (recoveryRatio > 0) {
      const shoulderSign =
        pattern === 'lanes'
          ? laneBias === 'horizontal'
            ? battle.playerY >= enemy.y
              ? 1
              : -1
            : battle.playerX >= enemy.x
              ? 1
              : -1
          : enemy.id % 2 === 0
            ? -1
            : 1;
      moveX += strafeX * shoulderSign * (0.08 + recoveryRatio * 0.18);
      moveY += strafeY * shoulderSign * (0.08 + recoveryRatio * 0.18);
      moveX -= dirX * (0.2 + recoveryRatio * 0.36);
      moveY -= dirY * (0.2 + recoveryRatio * 0.36);
    }

    if (
      supportCount > 0 &&
      recoveryRatio <= 0.08 &&
      distance <= 132 &&
      driveWindow > (-0.1 - ordinarySurgeRatio * 0.18) &&
      this.triggerRegularPressureBeat(battle, enemy, openingRatio > 0.24 ? 0.26 : 0.22, 1.66)
    ) {
      const syncedCount = this.syncRegularPressurePack(battle, enemy, {
        radius: 96,
        limit: 1,
        durationSec: 0.12,
        cooldownSec: 0.92,
        predicate: (candidate) => candidate.archetype === 'standard',
      });
      if (syncedCount > 0) {
        this.enqueueRegularRelayAudio('brute');
      }
    } else if (
      openingRatio > 0.22 &&
      recoveryRatio <= 0.06 &&
      distance <= 156 &&
      driveWindow > -0.24
    ) {
      this.triggerRegularPressureBeat(battle, enemy, 0.24, 1.58);
    }
    if (
      ordinarySurgeRatio > 0.18 &&
      recoveryRatio <= 0.08 &&
      distance <= 156 &&
      (pickupLeadRatio > 0.08 || supportCount > 0) &&
      this.triggerRegularPressureBeat(
        battle,
        enemy,
        0.14 + ordinarySurgeRatio * 0.08,
        1.02 + Math.max(0, 0.1 - ordinarySurgeRatio * 0.12),
      )
    ) {
      this.syncRegularPressurePack(battle, enemy, {
        radius: 98 + ordinarySurgeRatio * 18,
        limit: supportCount >= 2 || pickupLeadRatio > 0.08 ? 2 : 1,
        durationSec: 0.1 + ordinarySurgeRatio * 0.04,
        cooldownSec: 0.84,
        predicate: (candidate) => candidate.archetype === 'standard',
      });
      this.primeRegularPressureLead(battle, enemy, 0.84 + ordinarySurgeRatio * 0.28);
    }

    if (enemy.pressurePulseSec > 0) {
      const pressureRatio = Math.min(1, enemy.pressurePulseSec / this.getEnemyPressureWindowSec(enemy));
      moveX += dirX * (0.24 + pressureRatio * 0.44 + openingRatio * 0.12);
      moveY += dirY * (0.24 + pressureRatio * 0.44 + openingRatio * 0.12);
    }

    const magnitude = Math.max(1, Math.hypot(moveX, moveY));
    const speedMultiplier =
      (distance <= 132 ? 1.16 : distance <= 188 ? 1.08 : 0.94) +
      (pattern === 'lanes' && laneBias === 'horizontal' ? lanePulse * 0.08 : 0) -
      recoveryRatio * 0.56 +
      openingRatio * 0.14 +
      ordinarySurgeRatio * (pickupLeadRatio > 0.08 ? 0.12 : 0.06);
    enemy.x = clamp(enemy.x + (moveX / magnitude) * enemy.speed * speedMultiplier * dt, -44, ARENA_WIDTH + 44);
    enemy.y = clamp(enemy.y + (moveY / magnitude) * enemy.speed * speedMultiplier * dt, -44, ARENA_HEIGHT + 44);
  }

  private updateSkirmisherEnemy(enemy: BattleState['enemies'][number], battle: BattleState, dt: number): void {
    const template = BATTLE_TEMPLATES[battle.templateId];
    const pattern = template.spawnRule?.pattern ?? 'surround';
    const pincerHeavy = pattern === 'pincers' || this.isSkirmisherHeavyTemplate(template);
    const recoveryRatio = this.getEnemyRecoveryRatio(enemy);
    const moveMagnitude = Math.hypot(battle.playerMoveDirX, battle.playerMoveDirY);
    const flankAnchor = this.findNearestAlly(
      battle,
      enemy,
      (candidate) => candidate.elite || candidate.archetype === 'ranged',
    );
    const ordinarySurgeRatio = this.getOrdinaryBattleSurgeRatio(battle);
    const pickupLeadRatio = this.isPickupLeadEnemy(battle, enemy) ? this.getPickupLeadRatio(battle) : 0;
    const leadX = battle.playerX + (moveMagnitude > 0.08 ? battle.playerMoveDirX * 54 : 0);
    const leadY = battle.playerY + (moveMagnitude > 0.08 ? battle.playerMoveDirY * 54 : 0);
    const sideSign = flankAnchor ? (flankAnchor.x < battle.playerX ? -1 : 1) : enemy.x < battle.playerX ? -1 : 1;
    const flankDirX = moveMagnitude > 0.08 ? -battle.playerMoveDirY : 0;
    const flankDirY = moveMagnitude > 0.08 ? battle.playerMoveDirX : 1;
    const surgeLeadDistance = ordinarySurgeRatio > 0.12 ? 18 + ordinarySurgeRatio * 26 : 0;
    let targetX = pincerHeavy ? leadX + flankDirX * 36 * sideSign + sideSign * 24 : leadX;
    let targetY = pincerHeavy ? leadY + flankDirY * 42 * sideSign : leadY;
    if (ordinarySurgeRatio > 0.12) {
      targetX += battle.playerMoveDirX * surgeLeadDistance + flankDirX * sideSign * (8 + ordinarySurgeRatio * 18);
      targetY += battle.playerMoveDirY * surgeLeadDistance + flankDirY * sideSign * (10 + ordinarySurgeRatio * 18);
    }
    if (flankAnchor) {
      const anchorPlayerDx = battle.playerX - flankAnchor.x;
      const anchorPlayerDy = battle.playerY - flankAnchor.y;
      const anchorPlayerDistance = Math.max(1, Math.hypot(anchorPlayerDx, anchorPlayerDy));
      if (anchorPlayerDistance <= 220) {
        const anchorOrthoX = -anchorPlayerDy / anchorPlayerDistance;
        const anchorOrthoY = anchorPlayerDx / anchorPlayerDistance;
        targetX =
          leadX +
          anchorOrthoX * 54 * sideSign -
          (anchorPlayerDx / anchorPlayerDistance) * 18;
        targetY =
          leadY +
          anchorOrthoY * 54 * sideSign -
          (anchorPlayerDy / anchorPlayerDistance) * 18;
      }
    }
    const dx = targetX - enemy.x;
    const dy = targetY - enemy.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const dirX = dx / distance;
    const dirY = dy / distance;
    const strafeX = -dirY;
    const strafeY = dirX;
    const strafeStrength = getEnemyArchetype(enemy.archetype).strafeStrength ?? 0.3;
    const openingRatio = Math.min(1, enemy.spawnFlashSec / 0.22);
    const strafeDirection = pincerHeavy
      ? sideSign * (0.72 + Math.sin(battle.elapsedSec * 2.6 + enemy.id * 0.54) * 0.28)
      : Math.sin(battle.elapsedSec * 2.25 + enemy.id * 0.6);
    const collapsePulse = 0.5 + Math.sin(battle.elapsedSec * 2.9 + enemy.id * 0.47) * 0.5;
    let moveX = 0;
    let moveY = 0;

    if (distance > 170) {
      moveX += dirX * (pincerHeavy ? 1.08 : 1.02) + strafeX * strafeDirection * (strafeStrength + 0.12);
      moveY += dirY * (pincerHeavy ? 1.08 : 1.02) + strafeY * strafeDirection * (strafeStrength + 0.12);
    } else if (distance > 92) {
      moveX +=
        dirX * (pincerHeavy ? 0.5 + collapsePulse * 0.24 : 0.64) +
        strafeX * strafeDirection * (strafeStrength + (pincerHeavy ? 0.28 : 0.18));
      moveY +=
        dirY * (pincerHeavy ? 0.5 + collapsePulse * 0.24 : 0.64) +
        strafeY * strafeDirection * (strafeStrength + (pincerHeavy ? 0.28 : 0.18));
    } else {
      moveX +=
        strafeX * strafeDirection * (strafeStrength + (pincerHeavy ? 0.3 : 0.24)) +
        dirX * (pincerHeavy ? collapsePulse * 0.28 - 0.06 : -0.24);
      moveY +=
        strafeY * strafeDirection * (strafeStrength + (pincerHeavy ? 0.3 : 0.24)) +
        dirY * (pincerHeavy ? collapsePulse * 0.28 - 0.06 : -0.24);
    }
    if (openingRatio > 0) {
      moveX += strafeX * strafeDirection * (0.14 + openingRatio * 0.24);
      moveY += strafeY * strafeDirection * (0.14 + openingRatio * 0.24);
      if (moveMagnitude > 0.08) {
        moveX += dirX * (0.04 + openingRatio * 0.12);
        moveY += dirY * (0.04 + openingRatio * 0.12);
      }
    }
    if (ordinarySurgeRatio > 0.12) {
      moveX += strafeX * strafeDirection * (0.08 + ordinarySurgeRatio * (pickupLeadRatio > 0.08 ? 0.26 : 0.18));
      moveY += strafeY * strafeDirection * (0.08 + ordinarySurgeRatio * (pickupLeadRatio > 0.08 ? 0.26 : 0.18));
      moveX += dirX * (pickupLeadRatio > 0.08 ? 0.04 + ordinarySurgeRatio * 0.1 : ordinarySurgeRatio * 0.04);
      moveY += dirY * (pickupLeadRatio > 0.08 ? 0.04 + ordinarySurgeRatio * 0.1 : ordinarySurgeRatio * 0.04);
    }
    if (
      (flankAnchor || pickupLeadRatio > 0.08) &&
      recoveryRatio <= 0.05 &&
      distance <= 126 &&
      (Math.abs(strafeDirection) >= 0.58 || openingRatio > 0.24 || ordinarySurgeRatio > 0.2) &&
      this.triggerRegularPressureBeat(battle, enemy, openingRatio > 0.18 ? 0.2 : 0.18, 1.32)
    ) {
      const syncedCount = this.syncRegularPressurePack(battle, enemy, {
        radius: pincerHeavy ? 118 : 98,
        limit: pincerHeavy ? 2 : 1,
        durationSec: 0.14,
        cooldownSec: 0.84,
        predicate: (candidate) =>
          candidate.archetype === 'skirmisher' ||
          (candidate.archetype === 'standard' && Math.hypot(candidate.x - battle.playerX, candidate.y - battle.playerY) <= 168),
      });
      if (flankAnchor?.role === 'regular' && !flankAnchor.elite) {
        flankAnchor.spawnFlashSec = Math.max(flankAnchor.spawnFlashSec, 0.12);
        flankAnchor.pressurePulseSec = Math.max(flankAnchor.pressurePulseSec, 0.12);
      }
      if (syncedCount > 0) {
        this.enqueueRegularRelayAudio('skirmisher');
      }
    }
    if (
      ordinarySurgeRatio > 0.2 &&
      recoveryRatio <= 0.06 &&
      distance <= 138 &&
      pickupLeadRatio > 0.08 &&
      this.triggerRegularPressureBeat(
        battle,
        enemy,
        0.12 + ordinarySurgeRatio * 0.08,
        0.88 + Math.max(0, 0.08 - ordinarySurgeRatio * 0.04),
      )
    ) {
      this.primeRegularPressureLead(battle, enemy, 0.72 + ordinarySurgeRatio * 0.26);
    }
    if (enemy.pressurePulseSec > 0) {
      const pressureRatio = Math.min(1, enemy.pressurePulseSec / this.getEnemyPressureWindowSec(enemy));
      moveX += strafeX * strafeDirection * (0.18 + pressureRatio * 0.22 + openingRatio * 0.06);
      moveY += strafeY * strafeDirection * (0.18 + pressureRatio * 0.22 + openingRatio * 0.06);
      moveX += dirX * (0.06 + pressureRatio * 0.12);
      moveY += dirY * (0.06 + pressureRatio * 0.12);
    }
    if (recoveryRatio > 0) {
      const peelSign = enemy.x < battle.playerX ? -1 : 1;
      moveX += strafeX * peelSign * (0.18 + recoveryRatio * 0.32);
      moveY += strafeY * peelSign * (0.18 + recoveryRatio * 0.32);
      moveX -= dirX * (0.14 + recoveryRatio * 0.26);
      moveY -= dirY * (0.14 + recoveryRatio * 0.26);
    }
    const magnitude = Math.max(1, Math.hypot(moveX, moveY));
    const speedMultiplier =
      1 +
      openingRatio * (pincerHeavy ? 0.14 : 0.08) +
      ordinarySurgeRatio * (pickupLeadRatio > 0.08 ? 0.14 : 0.08) -
      recoveryRatio * 0.5;

    enemy.x = clamp(enemy.x + (moveX / magnitude) * enemy.speed * speedMultiplier * dt, -36, ARENA_WIDTH + 36);
    enemy.y = clamp(enemy.y + (moveY / magnitude) * enemy.speed * speedMultiplier * dt, -36, ARENA_HEIGHT + 36);
  }

  private updateRangedEnemy(enemy: BattleState['enemies'][number], battle: BattleState, dt: number): void {
    const template = BATTLE_TEMPLATES[battle.templateId];
    const archetype = getEnemyArchetype(enemy.archetype);
    const pressurePhase = this.getActivePressurePhase(battle);
    const pattern = template.spawnRule?.pattern ?? 'surround';
    const laneBias = template.spawnRule?.laneBias ?? 'horizontal';
    const rangedHeavy = this.isRangedHeavyTemplate(template);
    const screenAnchor = this.findNearestAlly(
      battle,
      enemy,
      (candidate) => candidate.elite || candidate.archetype === 'brute',
    );
    const screenAnchorDistance = screenAnchor ? Math.hypot(screenAnchor.x - enemy.x, screenAnchor.y - enemy.y) : Number.POSITIVE_INFINITY;
    const screenedByAnchor = Boolean(screenAnchor && screenAnchorDistance <= 176);
    const preferredDistance = (archetype.preferredDistance ?? 205) + (pattern === 'lanes' ? 12 : 0);
    const strafeStrength = archetype.strafeStrength ?? 0.22;
    const dx = battle.playerX - enemy.x;
    const dy = battle.playerY - enemy.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const dirX = dx / distance;
    const dirY = dy / distance;
    const strafeX = -dirY;
    const strafeY = dirX;
    const recoveryRatio = this.getEnemyRecoveryRatio(enemy);
    const openingRatio = Math.min(1, enemy.spawnFlashSec / 0.22);
    const ordinarySurgeRatio = this.getOrdinaryBattleSurgeRatio(battle);
    const pickupLeadRatio = this.isPickupLeadEnemy(battle, enemy) ? this.getPickupLeadRatio(battle) : 0;
    const strafeDirection = Math.sin(battle.elapsedSec * 1.6 + enemy.id * 0.41);
    let moveX = strafeX * strafeDirection * strafeStrength;
    let moveY = strafeY * strafeDirection * strafeStrength;

    if (distance < preferredDistance * 0.82) {
      moveX -= dirX * 1.12;
      moveY -= dirY * 1.12;
    } else if (distance > preferredDistance * 1.18) {
      moveX += dirX * 0.74;
      moveY += dirY * 0.74;
    } else {
      moveX += dirX * 0.12;
      moveY += dirY * 0.12;
    }

    if (pattern === 'lanes') {
      if (laneBias === 'vertical') {
        const laneTarget = this.getPlayerLaneTargetCoordinate(
          battle,
          'vertical',
          rangedHeavy ? (enemy.x < battle.playerX ? -1 : 1) : 0,
        );
        moveX += clamp((laneTarget - enemy.x) / 88, -0.74, 0.74);
        moveY += dirY * (rangedHeavy ? 0.18 : 0.08);
      } else {
        const laneTarget = this.getPlayerLaneTargetCoordinate(
          battle,
          'horizontal',
          rangedHeavy ? (enemy.y < battle.playerY ? -1 : 1) : 0,
        );
        moveY += clamp((laneTarget - enemy.y) / 88, -0.74, 0.74);
        moveX += dirX * (rangedHeavy ? 0.18 : 0.08);
      }
    }

    if (screenAnchor && screenedByAnchor) {
      const anchorDistance = Math.max(1, screenAnchorDistance);
      if (anchorDistance <= 176) {
        const anchorPlayerDx = battle.playerX - screenAnchor.x;
        const anchorPlayerDy = battle.playerY - screenAnchor.y;
        const anchorPlayerDistance = Math.max(1, Math.hypot(anchorPlayerDx, anchorPlayerDy));
        const anchorDirX = anchorPlayerDx / anchorPlayerDistance;
        const anchorDirY = anchorPlayerDy / anchorPlayerDistance;
        const anchorOrthoX = -anchorDirY;
        const anchorOrthoY = anchorDirX;
        const backSign = enemy.id % 2 === 0 ? -1 : 1;
        const slotX =
          screenAnchor.x -
          anchorDirX * (screenAnchor.radius + enemy.radius + 18) +
          anchorOrthoX * backSign * 18;
        const slotY =
          screenAnchor.y -
          anchorDirY * (screenAnchor.radius + enemy.radius + 18) +
          anchorOrthoY * backSign * 18;
        const slotDx = slotX - enemy.x;
        const slotDy = slotY - enemy.y;
        const slotDistance = Math.max(1, Math.hypot(slotDx, slotDy));
        moveX += (slotDx / slotDistance) * 0.54;
        moveY += (slotDy / slotDistance) * 0.54;
        if (openingRatio > 0) {
          moveX += (slotDx / slotDistance) * (0.16 + openingRatio * 0.18);
          moveY += (slotDy / slotDistance) * (0.16 + openingRatio * 0.18);
        }
      }
    }
    if (openingRatio > 0 && (screenedByAnchor || rangedHeavy)) {
      enemy.rangedCooldownSec = Math.min(enemy.rangedCooldownSec, 0.34 + (1 - openingRatio) * 0.16);
      moveX -= dirX * (0.04 + openingRatio * 0.08);
      moveY -= dirY * (0.04 + openingRatio * 0.08);
    }
    if (ordinarySurgeRatio > 0.12) {
      moveX += strafeX * strafeDirection * (0.06 + ordinarySurgeRatio * 0.14);
      moveY += strafeY * strafeDirection * (0.06 + ordinarySurgeRatio * 0.14);
      if (screenedByAnchor || rangedHeavy) {
        enemy.rangedCooldownSec = Math.min(
          enemy.rangedCooldownSec,
          0.28 + (1 - ordinarySurgeRatio) * 0.12,
        );
        moveX -= dirX * (0.04 + ordinarySurgeRatio * 0.08);
        moveY -= dirY * (0.04 + ordinarySurgeRatio * 0.08);
      }
      if (pickupLeadRatio > 0.08) {
        moveX -= dirX * (0.04 + pickupLeadRatio * 0.08);
        moveY -= dirY * (0.04 + pickupLeadRatio * 0.08);
      }
    }

    if (recoveryRatio > 0) {
      const laneResetSign =
        laneBias === 'vertical'
          ? enemy.x < battle.playerX
            ? -1
            : 1
          : enemy.y < battle.playerY
            ? -1
            : 1;
      if (laneBias === 'vertical') {
        moveX += laneResetSign * (0.18 + recoveryRatio * 0.34);
        moveY -= dirY * (0.22 + recoveryRatio * 0.34);
      } else {
        moveY += laneResetSign * (0.18 + recoveryRatio * 0.34);
        moveX -= dirX * (0.22 + recoveryRatio * 0.34);
      }
    }

    if (
      screenedByAnchor &&
      recoveryRatio <= 0.06 &&
      distance <= preferredDistance * 1.08 &&
      this.triggerRegularPressureBeat(battle, enemy, openingRatio > 0.16 ? 0.22 : 0.2, 1.34, {
        rangedLeadSec: 0.3,
      })
    ) {
      enemy.rangedCooldownSec = Math.min(enemy.rangedCooldownSec, screenedByAnchor ? 0.22 : 0.28);
      const syncedCount = this.syncRegularPressurePack(battle, enemy, {
        radius: 124,
        limit: screenedByAnchor ? 2 : 1,
        durationSec: 0.13,
        cooldownSec: 0.92,
        predicate: (candidate) => candidate.archetype === 'ranged' || candidate.archetype === 'skirmisher',
      });
      if (screenAnchor && !screenAnchor.elite && screenAnchor.role === 'regular') {
        screenAnchor.spawnFlashSec = Math.max(screenAnchor.spawnFlashSec, 0.14);
        screenAnchor.pressurePulseSec = Math.max(screenAnchor.pressurePulseSec, 0.14);
      }
      if (syncedCount > 0) {
        this.enqueueRegularRelayAudio('ranged');
      }
    }

    if (enemy.pressurePulseSec > 0) {
      const pressureRatio = Math.min(1, enemy.pressurePulseSec / this.getEnemyPressureWindowSec(enemy));
      moveX += strafeX * strafeDirection * (0.12 + pressureRatio * 0.22);
      moveY += strafeY * strafeDirection * (0.12 + pressureRatio * 0.22);
      moveX -= dirX * (0.08 + pressureRatio * 0.12);
      moveY -= dirY * (0.08 + pressureRatio * 0.12);
    }

    const magnitude = Math.max(1, Math.hypot(moveX, moveY));
    const speedMultiplier =
      1 +
      openingRatio * (screenedByAnchor ? 0.1 : 0.06) +
      ordinarySurgeRatio * (screenedByAnchor ? 0.08 : 0.04) -
      recoveryRatio * 0.58;
    enemy.x = clamp(enemy.x + (moveX / magnitude) * enemy.speed * speedMultiplier * dt, -42, ARENA_WIDTH + 42);
    enemy.y = clamp(enemy.y + (moveY / magnitude) * enemy.speed * speedMultiplier * dt, -42, ARENA_HEIGHT + 42);

    enemy.rangedCooldownSec = Math.max(0, enemy.rangedCooldownSec - dt);
    if (enemy.rangedCooldownSec > 0 || distance > preferredDistance * 1.45) {
      return;
    }

    const projectileSpeed =
      (archetype.projectileSpeed ?? 220) * (pressurePhase?.rangedProjectileSpeedMultiplier ?? 1);
    const projectileDamageMultiplier = archetype.projectileDamageMultiplier ?? 0.76;
    const baseAngle = Math.atan2(battle.playerY - enemy.y, battle.playerX - enemy.x);
    const shotsPerVolley = pattern === 'lanes' || rangedHeavy || screenedByAnchor ? 2 : 1;
    const spreadRad = shotsPerVolley > 1 ? (pattern === 'lanes' ? (rangedHeavy ? 0.15 : 0.12) : 0.09) : 0;
    const centerIndex = (shotsPerVolley - 1) / 2;

    for (let shotIndex = 0; shotIndex < shotsPerVolley; shotIndex += 1) {
      const angleOffset = shotsPerVolley === 1 ? 0 : (shotIndex - centerIndex) * spreadRad;
      this.spawnEnemyProjectile(
        battle,
        enemy.x,
        enemy.y,
        projectileSpeed,
        Math.max(1, Math.round(enemy.contactDamage * projectileDamageMultiplier)),
        archetype.projectileRadius ?? 5,
        baseAngle + angleOffset,
      );
    }

    if (shotsPerVolley > 1 || pattern === 'lanes') {
      enemy.pressurePulseSec = Math.max(enemy.pressurePulseSec, 0.2);
      this.createCombatPulse(battle, {
        x: enemy.x,
        y: enemy.y,
        radius: enemy.radius + 8,
        lifeSec: 0.14,
        color: 0xff7b86,
        secondaryColor: 0xffe3e6,
        fillAlpha: 0.04,
        strokeAlpha: 0.28,
        strokeWidth: 2,
        growthPerSec: 90,
        innerRadiusRatio: 0.74,
      });
    }

    enemy.rangedCooldownSec = this.getRangedShotIntervalSec(archetype, battle) + (shotsPerVolley > 1 ? 0.12 : 0);
    this.pushEnemyRecovery(enemy, shotsPerVolley > 1 || pattern === 'lanes' ? 0.42 : 0.32);
    this.enqueueAudio('enemyShot');
  }

  private getRangedShotIntervalSec(
    archetype: ReturnType<typeof getEnemyArchetype>,
    battle: BattleState,
  ): number {
    const multiplier = this.getActivePressurePhase(battle)?.rangedShotIntervalMultiplier ?? 1;
    return Math.max(0.65, (archetype.shotIntervalSec ?? 2.35) * multiplier);
  }

  private spawnEnemyProjectile(
    battle: BattleState,
    x: number,
    y: number,
    projectileSpeed: number,
    damage: number,
    radius: number,
    angleOverride?: number,
    options?: {
      respectsSafeWindow?: boolean;
    },
  ): void {
    const shotAngle = angleOverride ?? Math.atan2(battle.playerY - y, battle.playerX - x);
    battle.enemyProjectiles.push({
      id: battle.nextEnemyProjectileId++,
      x,
      y,
      vx: Math.cos(shotAngle) * projectileSpeed,
      vy: Math.sin(shotAngle) * projectileSpeed,
      damage,
      lifeSec: 3.2,
      radius,
      respectsSafeWindow: options?.respectsSafeWindow ?? false,
    });
    this.createCombatPulse(battle, {
      x,
      y,
      radius: radius + 6,
      lifeSec: 0.08,
      color: 0xff887d,
      secondaryColor: 0xfff1eb,
      fillAlpha: 0.04,
      strokeAlpha: 0.24,
      strokeWidth: 1.5,
      growthPerSec: 112,
      innerRadiusRatio: 0.7,
    });
  }

  private firePressureVolley(
    battle: BattleState,
    requestedShooterCount: number,
    options?: {
      spreadRad?: number;
      shotsPerShooter?: number;
      respectsSafeWindow?: boolean;
    },
  ): void {
    if (requestedShooterCount <= 0 || !battle.eliteAlive) {
      return;
    }

    const eliteEnemy = battle.enemies.find((enemy) => enemy.elite) ?? null;
    const rangedEnemies = battle.enemies
      .filter((enemy) => !enemy.elite && enemy.archetype === 'ranged')
      .sort((left, right) => {
        const leftDistance = Math.hypot(left.x - battle.playerX, left.y - battle.playerY);
        const rightDistance = Math.hypot(right.x - battle.playerX, right.y - battle.playerY);
        return leftDistance - rightDistance;
      });
    const shooters = eliteEnemy ? [eliteEnemy, ...rangedEnemies] : rangedEnemies;

    const spreadRad = options?.spreadRad ?? 0;
    const shotsPerShooter = Math.max(1, options?.shotsPerShooter ?? 1);

    for (const shooter of shooters.slice(0, requestedShooterCount)) {
      const archetype = getEnemyArchetype(shooter.archetype);
      const pressurePhase = this.getActivePressurePhase(battle);
      const projectileSpeed =
        (shooter.elite ? 244 : archetype.projectileSpeed ?? 220) * (pressurePhase?.rangedProjectileSpeedMultiplier ?? 1);
      const projectileDamageMultiplier = shooter.elite ? 0.88 : archetype.projectileDamageMultiplier ?? 0.76;
      const projectileRadius = shooter.elite ? Math.max(6, shooter.radius * 0.26) : archetype.projectileRadius ?? 5;
      const baseAngle = Math.atan2(battle.playerY - shooter.y, battle.playerX - shooter.x);
      const centerIndex = (shotsPerShooter - 1) / 2;
      for (let shotIndex = 0; shotIndex < shotsPerShooter; shotIndex += 1) {
        const angleOffset = shotsPerShooter === 1 ? 0 : (shotIndex - centerIndex) * spreadRad;
        this.spawnEnemyProjectile(
          battle,
          shooter.x,
          shooter.y,
          projectileSpeed,
          Math.max(1, Math.round(shooter.contactDamage * projectileDamageMultiplier)),
          projectileRadius,
          baseAngle + angleOffset,
          {
            respectsSafeWindow: options?.respectsSafeWindow ?? false,
          },
        );
      }
      if (!shooter.elite) {
        shooter.rangedCooldownSec = this.getRangedShotIntervalSec(archetype, battle);
      }
    }
    this.enqueueAudio('enemyShot');
  }

  private updateEnemyProjectiles(battle: BattleState, dt: number): void {
    const survivors = [];

    for (const projectile of battle.enemyProjectiles) {
      if (!this.debugConfig.freezeEnemyProjectiles) {
        projectile.x += projectile.vx * dt;
        projectile.y += projectile.vy * dt;
        projectile.lifeSec -= dt;
      }

      if (
        projectile.lifeSec <= 0 ||
        projectile.x < -48 ||
        projectile.x > ARENA_WIDTH + 48 ||
        projectile.y < -48 ||
        projectile.y > ARENA_HEIGHT + 48
      ) {
        continue;
      }

      if (
        battle.encounterType === 'boss' &&
        this.isPointInsidePressureSafeWindow(battle, projectile.x, projectile.y, projectile.radius + 18)
      ) {
        // 安全区内清理弹体，记录清弹数据
        battle.insideSafeProjectileClears += 1;
        continue;
      }

      if (projectile.respectsSafeWindow && this.isPointInsidePressureSafeWindow(battle, projectile.x, projectile.y, projectile.radius + 10)) {
        continue;
      }

      if (this.dampenEliteBreachProjectile(battle, projectile, dt)) {
        continue;
      }

      const distance = Math.hypot(projectile.x - battle.playerX, projectile.y - battle.playerY);
      if (!this.debugConfig.freezeEnemyProjectiles && distance <= projectile.radius + PLAYER_COLLISION_RADIUS) {
        if (battle.invulnerableSec <= 0 && !this.debugConfig.invulnerablePlayer) {
          this.state.stats.hp = clamp(this.state.stats.hp - projectile.damage, 0, this.state.stats.maxHp);
          battle.invulnerableSec = 0.32;
          battle.playerImpactSec = Math.max(battle.playerImpactSec, 0.3);
          this.queueImpactFreeze(battle, projectile.radius > 5 ? 0.082 : 0.062, projectile.radius > 5 ? 0.12 : 0.16);
          this.pushPlayerKnockback(battle, projectile.x, projectile.y, projectile.radius > 5 ? 220 : 170);
          this.kickBattleShake(battle, 0.2, projectile.radius > 5 ? 0.44 : 0.4, 9);
          this.registerPlayerThreatDirection(battle, projectile.x, projectile.y, 0.3);
          this.createCombatPulse(battle, {
            x: battle.playerX,
            y: battle.playerY,
            radius: projectile.radius + 16,
            lifeSec: 0.2,
            color: 0xff7b68,
            secondaryColor: 0xffddd7,
            fillAlpha: 0.1,
            strokeAlpha: 0.84,
            strokeWidth: 3,
            growthPerSec: 180,
            innerRadiusRatio: 0.62,
            spokeCount: projectile.radius > 5 ? 5 : 4,
            spokeLength: projectile.radius > 5 ? 24 : 18,
            angle: Math.atan2(battle.playerY - projectile.y, battle.playerX - projectile.x),
            spinRate: projectile.radius > 5 ? 6 : 4.8,
          });
          this.enqueueAudio('hurt');
          if (this.finishBattleOnPlayerDefeat(battle)) {
            battle.enemyProjectiles = survivors;
            return;
          }
        }
        continue;
      }

      if (
        !this.debugConfig.freezeEnemyProjectiles &&
        battle.playerNearMissCooldownSec <= 0 &&
        distance <= projectile.radius + PLAYER_COLLISION_RADIUS + 24
      ) {
        battle.playerNearMissSec = Math.max(battle.playerNearMissSec, 0.14);
        battle.playerNearMissAngle = Math.atan2(projectile.y - battle.playerY, projectile.x - battle.playerX);
        battle.playerNearMissCooldownSec = 0.09;
        this.kickBattleShake(battle, 0.05, 0.14, 11);
        this.createCombatPulse(battle, {
          x: battle.playerX,
          y: battle.playerY,
          radius: projectile.radius + 22,
          lifeSec: 0.12,
          color: 0xffb09a,
          secondaryColor: 0xfff3ef,
          fillAlpha: 0.03,
          strokeAlpha: 0.22,
          strokeWidth: 2,
          growthPerSec: 120,
          innerRadiusRatio: 0.8,
          spokeCount: 3,
          spokeLength: 18,
          angle: battle.playerNearMissAngle,
          spinRate: 7.2,
        });
        this.enqueueAudio('nearMiss');
      }

      survivors.push(projectile);
    }

    battle.enemyProjectiles = survivors;
  }

  private updateEliteEnemy(
    enemy: BattleState['enemies'][number],
    battle: BattleState,
    template: (typeof BATTLE_TEMPLATES)[keyof typeof BATTLE_TEMPLATES],
    dt: number,
  ): void {
    const eliteRule = template.eliteRule;
    if (!eliteRule) {
      return;
    }

    const pressurePhase = this.getActivePressurePhase(battle);
    const activeBehavior = this.getActiveEliteBehavior(battle, template);
    const cycle = this.getElitePressureCycle(activeBehavior);
    const escortCount = this.getActiveEscortCount(battle);
    const transitionMobilityRatio = clamp(battle.pressureTransitionSec / 1.15, 0, 1);
    const preferredDistance =
      (eliteRule.preferredDistance ?? 170) + (pressurePhase?.preferredDistanceDelta ?? 0);
    const strafeStrength =
      (eliteRule.strafeStrength ?? 0.2) +
      (pressurePhase?.strafeStrengthBonus ?? 0) +
      transitionMobilityRatio * (battle.encounterType === 'boss' ? 0.14 : 0.08);
    const movementSpeed =
      enemy.speed *
      (pressurePhase?.eliteSpeedMultiplier ?? 1) *
      (1 + transitionMobilityRatio * (battle.encounterType === 'boss' ? 0.12 : 0.06));
    const dx = battle.playerX - enemy.x;
    const dy = battle.playerY - enemy.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const dirX = dx / distance;
    const dirY = dy / distance;
    const strafeX = -dirY;
    const strafeY = dirX;
    const strafeDirection = Math.sin(battle.elapsedSec * 1.35 + enemy.id * 0.7);
    const pressureRatio = Math.min(1, enemy.pressurePulseSec / cycle.pulseSec);
    const recoveryRatio = this.getEnemyRecoveryRatio(enemy);
    const crackRatio = this.getEliteCrackWindowRatio(battle);
    let moveX = 0;
    let moveY = 0;

    const canTriggerPulse =
      crackRatio <= 0.08 &&
      enemy.pressurePulseSec <= 0 &&
      enemy.tacticCooldownSec <= 0 &&
      enemy.recoverySec <= 0.08 &&
      (
        (activeBehavior === 'frontline' && distance <= preferredDistance * 1.14) ||
        (activeBehavior === 'kiting' && distance <= preferredDistance * 1.08) ||
        (activeBehavior === 'screened' && escortCount > 0 && distance <= preferredDistance * 1.14) ||
        (activeBehavior === 'summoner' && (escortCount <= 1 || distance <= preferredDistance * 0.9))
      );
    if (canTriggerPulse) {
      this.startElitePressurePulse(enemy, battle, template, activeBehavior);
    }

    const applyKitingBaseline = (): void => {
      if (distance < preferredDistance * 0.88) {
        moveX -= dirX * 1.18;
        moveY -= dirY * 1.18;
      } else if (distance > preferredDistance * 1.14) {
        moveX += dirX * 0.74;
        moveY += dirY * 0.74;
      }
      moveX += strafeX * strafeDirection * strafeStrength;
      moveY += strafeY * strafeDirection * strafeStrength;
    };

    switch (activeBehavior) {
      case 'kiting':
        applyKitingBaseline();
        if (pressureRatio > 0) {
          moveX -= dirX * (0.12 + pressureRatio * 0.2);
          moveY -= dirY * (0.12 + pressureRatio * 0.2);
          moveX += strafeX * strafeDirection * (0.18 + pressureRatio * 0.26);
          moveY += strafeY * strafeDirection * (0.18 + pressureRatio * 0.26);
        }
        break;
      case 'screened':
      case 'summoner': {
        const escorts = battle.enemies.filter((candidate) => !candidate.elite && candidate.role === 'escort' && candidate.hp > 0);
        if (escorts.length > 0) {
          const escortCenter = escorts.reduce(
            (acc, escort) => ({
              x: acc.x + escort.x,
              y: acc.y + escort.y,
            }),
            { x: 0, y: 0 },
          );
          escortCenter.x /= escorts.length;
          escortCenter.y /= escorts.length;
          const screenDx = escortCenter.x - battle.playerX;
          const screenDy = escortCenter.y - battle.playerY;
          const screenDistance = Math.max(1, Math.hypot(screenDx, screenDy));
          const behindDistance = activeBehavior === 'summoner' ? 56 : 42;
          const targetX = escortCenter.x + (screenDx / screenDistance) * behindDistance;
          const targetY = escortCenter.y + (screenDy / screenDistance) * behindDistance;
          const targetDx = targetX - enemy.x;
          const targetDy = targetY - enemy.y;
          const targetDistance = Math.max(1, Math.hypot(targetDx, targetDy));

          moveX += (targetDx / targetDistance) * 0.92;
          moveY += (targetDy / targetDistance) * 0.92;
          moveX += strafeX * strafeDirection * (strafeStrength + 0.04);
          moveY += strafeY * strafeDirection * (strafeStrength + 0.04);

          if (distance < preferredDistance * 0.72) {
            moveX -= dirX * 0.55;
            moveY -= dirY * 0.55;
          }
          if (pressureRatio > 0) {
            const screenStrength = activeBehavior === 'summoner' ? 0.34 : 0.24;
            moveX -= dirX * (screenStrength + pressureRatio * 0.16);
            moveY -= dirY * (screenStrength + pressureRatio * 0.16);
            moveX += strafeX * strafeDirection * (0.18 + pressureRatio * 0.18);
            moveY += strafeY * strafeDirection * (0.18 + pressureRatio * 0.18);
          }
        } else {
          applyKitingBaseline();
          if (pressureRatio > 0) {
            moveX += strafeX * strafeDirection * (0.18 + pressureRatio * 0.14);
            moveY += strafeY * strafeDirection * (0.18 + pressureRatio * 0.14);
          }
        }
        break;
      }
      case 'frontline':
      default:
        if (distance > preferredDistance * 0.76) {
          moveX += dirX;
          moveY += dirY;
        } else {
          moveX += dirX * 0.28;
          moveY += dirY * 0.28;
        }
        moveX += strafeX * strafeDirection * Math.max(0.08, strafeStrength * 0.6);
        moveY += strafeY * strafeDirection * Math.max(0.08, strafeStrength * 0.6);
        if (pressureRatio > 0) {
          moveX += dirX * (0.4 + pressureRatio * 0.44);
          moveY += dirY * (0.4 + pressureRatio * 0.44);
        }
        break;
    }

    if (crackRatio > 0.08) {
      const chaseBlend = Math.min(0.68, 0.22 + crackRatio * 0.42);
      const chaseForward =
        distance > preferredDistance * 0.84
          ? activeBehavior === 'kiting'
            ? 0.18
            : activeBehavior === 'screened' || activeBehavior === 'summoner'
              ? 0.26
              : 0.34
          : distance < preferredDistance * 0.62
            ? activeBehavior === 'kiting'
              ? -0.14
              : -0.08
            : 0.1;
      const chaseStrafeScale = activeBehavior === 'kiting' ? 0.55 : activeBehavior === 'screened' || activeBehavior === 'summoner' ? 0.4 : 0.28;
      const chaseMoveX = dirX * chaseForward + strafeX * strafeDirection * Math.max(0.04, strafeStrength * chaseStrafeScale);
      const chaseMoveY = dirY * chaseForward + strafeY * strafeDirection * Math.max(0.04, strafeStrength * chaseStrafeScale);
      moveX = moveX * (1 - chaseBlend) + chaseMoveX * chaseBlend;
      moveY = moveY * (1 - chaseBlend) + chaseMoveY * chaseBlend;
    }

    if (recoveryRatio > 0) {
      moveX -= dirX * (0.14 + recoveryRatio * 0.24);
      moveY -= dirY * (0.14 + recoveryRatio * 0.24);
      moveX += strafeX * strafeDirection * (0.08 + recoveryRatio * 0.16);
      moveY += strafeY * strafeDirection * (0.08 + recoveryRatio * 0.16);
    }

    const bodyBlockDistance = battle.encounterType === 'boss' ? enemy.radius + 92 : enemy.radius + 62;
    const antiBodyBlockRatio = clamp((bodyBlockDistance - distance) / bodyBlockDistance, 0, 1);
    if (antiBodyBlockRatio > 0) {
      const awayStrength = battle.encounterType === 'boss'
        ? 2.15 + antiBodyBlockRatio * 2.1
        : 1.35 + antiBodyBlockRatio * 1.15;
      moveX -= dirX * awayStrength;
      moveY -= dirY * awayStrength;
      moveX += strafeX * strafeDirection * (0.2 + antiBodyBlockRatio * 0.35);
      moveY += strafeY * strafeDirection * (0.2 + antiBodyBlockRatio * 0.35);
      enemy.tacticCooldownSec = Math.max(enemy.tacticCooldownSec, battle.encounterType === 'boss' ? 0.18 : 0.1);
    }

    const moveMagnitude = Math.max(1, Math.hypot(moveX, moveY));
    const speedMultiplier =
      1 +
      pressureRatio * (activeBehavior === 'frontline' ? 0.18 : activeBehavior === 'kiting' ? 0.12 : 0.1) -
      recoveryRatio * 0.42 -
      crackRatio * 0.12;
    enemy.x = clamp(enemy.x + (moveX / moveMagnitude) * movementSpeed * speedMultiplier * dt, -48, ARENA_WIDTH + 48);
    enemy.y = clamp(enemy.y + (moveY / moveMagnitude) * movementSpeed * speedMultiplier * dt, -48, ARENA_HEIGHT + 48);
  }

  private updatePulses(battle: BattleState, dt: number): void {
    for (const pulse of battle.pulses) {
      pulse.lifeSec -= dt;
      pulse.radius += pulse.growthPerSec * dt;
      pulse.angle += pulse.spinRate * dt;
    }
    battle.pulses = battle.pulses.filter((pulse) => pulse.lifeSec > 0);
  }

  private updateExperienceOrbs(battle: BattleState, dt: number): void {
    const pickupRadius = this.getPickupRadius();
    const magnetRadius = this.getMagnetRadius();
    const flowRatio =
      battle.killFlowSec > 0
        ? Math.min(1, battle.killFlowSec / (battle.killFlowCount >= 3 ? 1 : battle.killFlowCount >= 2 ? 0.86 : 0.72))
        : 0;
    const pickupFlowRatio = this.getPickupFlowRatio(battle);
    const flowCarry = flowRatio > 0 ? battle.killFlowCount * 0.72 + flowRatio * 1.24 : 0;
    const pickupCarry = pickupFlowRatio > 0 ? battle.pickupFlowCount * 0.34 + pickupFlowRatio * 0.9 : 0;
    const effectiveMagnetRadius =
      magnetRadius +
      (flowRatio > 0 ? 38 + battle.killFlowCount * 12 : 0) +
      (pickupFlowRatio > 0 ? 24 + battle.pickupFlowCount * 9 : 0);
    const survivors = [];

    for (const orb of battle.experienceOrbs) {
      const distance = Math.hypot(orb.x - battle.playerX, orb.y - battle.playerY);
      if (distance <= pickupRadius) {
        this.gainExperience(orb.value * battle.killStreakMultiplier);
        const pickupChain = this.registerPickupFlow(battle, orb.value);
        const pickupChainRatio = this.getPickupFlowRatio(battle);
        const pickupChainCarry =
          battle.pickupFlowCount * 0.36 + pickupChainRatio * 0.96;
        battle.playerRecoverySec = Math.max(
          battle.playerRecoverySec,
          0.18 + Math.min(0.1, flowCarry * 0.026 + pickupChainCarry * 0.022),
        );
        battle.tempoPulseSec = Math.max(
          battle.tempoPulseSec,
          0.14 + Math.min(0.18, orb.value * 0.006 + flowCarry * 0.028 + pickupChainCarry * 0.026),
        );
        if (battle.killFlowSec > 0) {
          battle.killFlowSec = Math.max(
            battle.killFlowSec,
            0.34 + Math.min(0.28, orb.value * 0.01 + flowCarry * 0.042 + pickupChainCarry * 0.03),
          );
          battle.playerMoveBoostSec = Math.max(
            battle.playerMoveBoostSec,
            0.16 + Math.min(0.18, battle.killFlowCount * 0.032 + flowCarry * 0.02 + pickupChainCarry * 0.026),
          );
          battle.tempoPulseSec = Math.max(
            battle.tempoPulseSec,
            0.2 + Math.min(0.2, battle.killFlowCount * 0.04 + orb.value * 0.004 + flowCarry * 0.02 + pickupChainCarry * 0.02),
          );
        }
        battle.playerTurnBurstSec = Math.max(
          battle.playerTurnBurstSec,
          0.08 + Math.min(0.08, pickupChain * 0.016 + pickupChainCarry * 0.02),
        );
        if (this.getLiveCombatFocusRoute(battle) === 'pierce') {
          this.registerPierceFlow(battle, {
            pickupCarry: pickupChainCarry + flowCarry,
          });
          battle.fireCooldownSec = Math.max(
            0.035,
            battle.fireCooldownSec - Math.min(0.018, 0.004 + pickupChainCarry * 0.0018 + flowCarry * 0.0014),
          );
        }
        this.feedBattleFlow(battle, 'pickup', orb.value + flowCarry * 2.4 + pickupChainCarry * 2);
        if (this.state.status === 'battle') {
          battle.fireCooldownSec = Math.max(
            0.035,
            battle.fireCooldownSec -
              Math.min(0.036, 0.008 + orb.value * 0.0008 + flowCarry * 0.0026 + pickupChainCarry * 0.0022),
          );
        }
        this.triggerPickupFollowThrough(battle, orb.value, pickupChain);
        this.createCombatPulse(battle, {
          x: battle.playerX,
          y: battle.playerY,
          radius: 16 + Math.min(12, orb.value * 0.08),
          lifeSec: 0.18,
          color: 0x84ffb4,
          secondaryColor: 0xf7fffd,
          fillAlpha: 0.08,
          strokeAlpha: 0.72,
          strokeWidth: 2,
          growthPerSec: 150,
          innerRadiusRatio: 0.68,
          spokeCount: Math.min(6, 3 + pickupChain),
          spokeLength: 8 + pickupChain * 2,
          angle: Math.atan2(battle.playerAimDirY, battle.playerAimDirX),
          spinRate: 4.8 + pickupChainRatio * 2,
        });
        this.createCombatPulse(battle, {
          x: orb.x,
          y: orb.y,
          radius: 10 + Math.min(10, orb.value * 0.06),
          lifeSec: 0.12,
          color: 0xa8ffd0,
          secondaryColor: 0xffffff,
          fillAlpha: 0.06,
          strokeAlpha: 0.44,
          strokeWidth: 1.5,
          growthPerSec: 110,
          innerRadiusRatio: 0.72,
        });
        const chainVacuumRadius = effectiveMagnetRadius * (flowRatio > 0 ? 0.92 : 0.78);
        for (const linkedOrb of battle.experienceOrbs) {
          if (linkedOrb === orb) {
            continue;
          }
          const linkedDistance = Math.hypot(linkedOrb.x - battle.playerX, linkedOrb.y - battle.playerY);
          if (linkedDistance > chainVacuumRadius) {
            continue;
          }
          const linkedAngle = Math.atan2(battle.playerY - linkedOrb.y, battle.playerX - linkedOrb.x);
          const linkedSpeed = Math.max(
            240,
            300 + Math.max(0, chainVacuumRadius - linkedDistance) * 3 + flowCarry * 26 + pickupChainCarry * 18,
          );
          linkedOrb.velocityX = Math.cos(linkedAngle) * linkedSpeed;
          linkedOrb.velocityY = Math.sin(linkedAngle) * linkedSpeed;
        }
        this.enqueueAudio('pickup');
        continue;
      }

      if (distance <= effectiveMagnetRadius) {
        const angle = Math.atan2(battle.playerY - orb.y, battle.playerX - orb.x);
        const attraction =
          (235 +
            Math.max(0, effectiveMagnetRadius - distance) * 3.1 +
            Math.min(90, battle.tempoPulseSec * 420) +
            flowCarry * 32 +
            pickupCarry * 26) *
          (distance <= effectiveMagnetRadius * 0.42 ? 1.24 : 1);
        const pullBlend = Math.min(1, 0.25 + dt * (9.4 + flowCarry * 1 + pickupCarry * 0.82));
        const targetVX = Math.cos(angle) * attraction;
        const targetVY = Math.sin(angle) * attraction;
        orb.velocityX += (targetVX - orb.velocityX) * pullBlend;
        orb.velocityY += (targetVY - orb.velocityY) * pullBlend;
      } else {
        orb.velocityX *= 0.9;
        orb.velocityY *= 0.9;
      }

      orb.x += orb.velocityX * dt;
      orb.y += orb.velocityY * dt;
      survivors.push(orb);
    }

    battle.experienceOrbs = survivors;
  }

  private gainExperience(amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }

    this.state.experience += amount;
    let leveled = false;

    // Guard against infinite loops from NaN/Infinity values
    let guard = 0;
    while (this.state.experience >= this.state.experienceToNext && guard < 100) {
      if (!Number.isFinite(this.state.experience) || !Number.isFinite(this.state.experienceToNext)) {
        break;
      }
      this.state.experience -= this.state.experienceToNext;
      this.state.level += 1;
      this.state.experienceToNext = getExperienceToNextLevel(this.state.level);
      this.state.queuedLevelUps += 1;
      leveled = true;
      guard += 1;
    }

    if (leveled) {
      this.enqueueAudio('levelUpReady');
      this.enqueueTip(`等级提升 Lv.${this.state.level}`);
      if (this.state.status === 'battle') {
        this.state.upgradeFlashSec = Math.max(this.state.upgradeFlashSec, 0.4);
        this.state.levelUpPanelDelaySec = Math.max(this.state.levelUpPanelDelaySec, 0.55);
      } else {
        this.openQueuedLevelUpPanel();
      }
    }
  }

  private openQueuedLevelUpPanel(): void {
    if (this.state.queuedLevelUps <= 0 || this.state.status === 'result') {
      return;
    }
    this.state.levelUpPanelDelaySec = 0;
    this.state.status = 'upgradeChoice';
    this.state.upgradeSource = 'levelUp';
    this.state.currentUpgradeIsReward = this.state.queuedRewardUpgrades > 0;
    this.state.upgradeChoices = this.rollUpgradeChoices('levelUp');
    this.state.currentEvent = null;
    this.state.nodeOptions = [];
    if (this.state.upgradeChoices.length === 0) {
      this.state.queuedLevelUps = Math.max(0, this.state.queuedLevelUps - 1);
      if (this.state.currentUpgradeIsReward) {
        this.state.queuedRewardUpgrades = Math.max(0, this.state.queuedRewardUpgrades - 1);
      }
      this.state.currentUpgradeIsReward = false;
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
    this.services.metrics.recordUpgradeOfferSeen(this.state.upgradeChoices, {
      phase: this.state.phase,
      source: 'levelUp',
    });
    this.recordRedirectUpgradeOffers(this.state.upgradeChoices);
  }

  private enqueuePhaseAdvanceFeedback(nextNodes: NodeOption[]): void {
    const nextPhase = nextNodes[0]?.phase;
    if (!nextPhase) {
      return;
    }

    switch (nextPhase) {
      case 'mid':
        this.enqueueTip('进入中段：开始把当前路线站稳。');
        this.enqueueAudio('confirm');
        return;
      case 'late':
        this.enqueueTip('进入后段：准备把本局收尾节奏立住。');
        this.enqueueAudio('confirm');
        return;
      case 'finalPrep':
        this.enqueueTip('进入最终整备：补完这一手后将直面 Boss。');
        this.enqueueAudio('upgrade');
        return;
      case 'finalBattle':
        this.enqueueTip('最终 Boss 入口已锁定。');
        this.enqueueAudio('boss');
        return;
      default:
        return;
    }
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

  private createCombatPulse(
    battle: BattleState,
    config: {
      x: number;
      y: number;
      radius: number;
      lifeSec: number;
      color: number;
      secondaryColor?: number;
      fillAlpha?: number;
      strokeAlpha?: number;
      strokeWidth?: number;
      growthPerSec?: number;
      innerRadiusRatio?: number;
      spokeCount?: number;
      spokeLength?: number;
      angle?: number;
      spinRate?: number;
    },
  ): void {
    battle.pulses.push({
      id: battle.nextPulseId++,
      x: config.x,
      y: config.y,
      radius: config.radius,
      lifeSec: config.lifeSec,
      maxLifeSec: config.lifeSec,
      color: config.color,
      secondaryColor: config.secondaryColor ?? 0xffffff,
      fillAlpha: config.fillAlpha ?? 0,
      strokeAlpha: config.strokeAlpha ?? 0.8,
      strokeWidth: config.strokeWidth ?? 2,
      growthPerSec: config.growthPerSec ?? 120,
      innerRadiusRatio: config.innerRadiusRatio ?? 0.62,
      spokeCount: config.spokeCount ?? 0,
      spokeLength: config.spokeLength ?? 0,
      angle: config.angle ?? 0,
      spinRate: config.spinRate ?? 0,
    });
  }

  private kickBattleShake(battle: BattleState, durationSec: number, strength: number, frequency: number = 11): void {
    // 完全禁用震动效果，避免眩晕感
    // 保留方法签名以避免破坏现有调用
    return;
  }

  private queueImpactFreeze(battle: BattleState, durationSec: number, factor: number): void {
    const nextFactor = clamp(factor, 0.08, 0.9);
    if (battle.impactFreezeSec > 0) {
      battle.impactFreezeSec = Math.max(battle.impactFreezeSec, durationSec);
      battle.impactFreezeFactor = Math.min(battle.impactFreezeFactor, nextFactor);
      return;
    }

    battle.impactFreezeSec = durationSec;
    battle.impactFreezeFactor = nextFactor;
  }

  private pushPlayerKnockback(battle: BattleState, sourceX: number, sourceY: number, force: number): void {
    let dx = battle.playerX - sourceX;
    let dy = battle.playerY - sourceY;
    let distance = Math.hypot(dx, dy);

    if (distance < 0.001) {
      dx = battle.playerAimDirX !== 0 || battle.playerAimDirY !== 0 ? -battle.playerAimDirX : 0;
      dy = battle.playerAimDirX !== 0 || battle.playerAimDirY !== 0 ? -battle.playerAimDirY : -1;
      distance = Math.max(1, Math.hypot(dx, dy));
    }

    const dirX = dx / distance;
    const dirY = dy / distance;
    battle.playerKnockbackVX = clamp(battle.playerKnockbackVX + dirX * force, -340, 340);
    battle.playerKnockbackVY = clamp(battle.playerKnockbackVY + dirY * force, -340, 340);
  }

  private registerEnemyImpact(
    battle: BattleState,
    enemy: BattleState['enemies'][number],
    sourceX: number,
    sourceY: number,
    options?: {
      flashSec?: number;
      kick?: number;
      pulseRadius?: number;
      pulseColor?: number;
      secondaryColor?: number;
    },
  ): void {
    const dx = enemy.x - sourceX;
    const dy = enemy.y - sourceY;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const kick = options?.kick ?? 7;
    enemy.hitFlashSec = Math.max(enemy.hitFlashSec, options?.flashSec ?? 0.16);
    this.applyEnemyHitRecoil(enemy, dx / distance, dy / distance, kick);
    const impactAngle = Math.atan2(dy, dx);
    this.createCombatPulse(battle, {
      x: enemy.x,
      y: enemy.y,
      radius: options?.pulseRadius ?? enemy.radius + 6,
      lifeSec: 0.14,
      color: options?.pulseColor ?? 0xff8291,
      secondaryColor: options?.secondaryColor ?? 0xffffff,
      fillAlpha: 0.08,
      strokeAlpha: 0.68,
      strokeWidth: 2.2,
      growthPerSec: 158,
      innerRadiusRatio: 0.68,
      spokeCount: enemy.elite ? 5 : enemy.archetype === 'brute' ? 4 : 3,
      spokeLength: Math.max(10, (options?.pulseRadius ?? enemy.radius + 6) * 0.58 + kick * 0.4),
      angle: impactAngle,
      spinRate: enemy.elite ? 5.4 : 4.2,
    });
  }

  // 流派构筑第三轮：穿透裂纹扩散触发
  private triggerPierceCrack(
    battle: BattleState,
    enemy: BattleState['enemies'][number],
    bullet: BattleState['bullets'][number],
  ): void {
    // pierce-seamkeep: 裂纹持续时间延长（基础1.2秒，激活后1.8秒）
    const baseMarkDuration = 1.2;
    const markDuration = battle.pierceSeamkeepActive ? 1.8 : baseMarkDuration;

    // pierce-riftbloom/prism: 扩散范围增加（基础140，激活后180）
    const baseRange = 140;
    const range = battle.pierceRiftbloomActive ? 180 : baseRange;

    // pierce-floodgate: 追加小范围裂纹伤害
    const floodgateBonus = battle.pierceFloodgateReady ? 4 : 0;

    const crackDamage = enemy.elite ? 5 : 8;
    const bulletDirX = bullet.vx / Math.max(1, Math.hypot(bullet.vx, bullet.vy));
    const bulletDirY = bullet.vy / Math.max(1, Math.hypot(bullet.vx, bullet.vy));

    // 对同一直线附近敌人造成裂纹伤害
    for (const target of battle.enemies) {
      if (target.id === enemy.id || target.hp <= 0) {
        continue;
      }
      const dx = target.x - enemy.x;
      const dy = target.y - enemy.y;
      const along = dx * bulletDirX + dy * bulletDirY;
      const lateral = Math.abs(dx * bulletDirY - dy * bulletDirX);

      // 后方扇形区域内的敌人（范围受 riftbloom 影响）
      if (along >= 0 && along <= range && lateral <= target.radius + 50) {
        // 精英/Boss 伤害倍率限制
        const eliteDamageRatio = target.elite ? 0.35 : 1.0;
        const damage = (crackDamage + floodgateBonus) * eliteDamageRatio;
        target.hp -= damage;
        target.routeHitFlashSec = 0.14;
        target.routeHitKind = 'pierce';
        // seamkeep 延长裂纹标记持续时间
        target.pierceMarkSec = markDuration;
        // floodgate 标记：记录已受到追加伤害，避免重复触发
        if (battle.pierceFloodgateReady) {
          target.pierceEchoDamageTaken = true;
        }
      }
    }

    // 视觉反馈（riftbloom 增加脉冲范围）
    const pulseRadius = battle.pierceRiftbloomActive ? enemy.radius + 48 : enemy.radius + 36;
    this.createCombatPulse(battle, {
      x: enemy.x,
      y: enemy.y,
      radius: pulseRadius,
      lifeSec: 0.24,
      color: 0x5cb8ff,
      secondaryColor: 0xccebff,
      fillAlpha: 0.08,
      strokeAlpha: 0.72,
      strokeWidth: 2.5,
      growthPerSec: 240,
      innerRadiusRatio: 0.4,
      spokeCount: 6,
      spokeLength: 18,
      angle: Math.atan2(bulletDirY, bulletDirX),
      spinRate: 3.2,
    });

    this.enqueueAudio('pierceEcho');
  }

  private trySpawnPierceEchoShots(
    battle: BattleState,
    bullet: BattleState['bullets'][number],
    currentEnemy: BattleState['enemies'][number],
  ): void {
    if (!bullet.canEcho || this.state.routeCounts.pierce <= 0) {
      return;
    }

    const bulletSpeed = Math.max(1, Math.hypot(bullet.vx, bullet.vy));
    const dirX = bullet.vx / bulletSpeed;
    const dirY = bullet.vy / bulletSpeed;
    const nearbyTargets = battle.enemies
      .filter((enemy) => {
        if (enemy.id === currentEnemy.id || enemy.hp <= 0) {
          return false;
        }
        const dx = enemy.x - currentEnemy.x;
        const dy = enemy.y - currentEnemy.y;
        const along = dx * dirX + dy * dirY;
        const lateral = Math.abs(dx * dirY - dy * dirX);
        return along >= -18 && along <= 220 && lateral <= enemy.radius + 44;
      })
      .sort((left, right) => {
        const leftDx = left.x - currentEnemy.x;
        const leftDy = left.y - currentEnemy.y;
        const leftAlong = leftDx * dirX + leftDy * dirY;
        const leftLateral = Math.abs(leftDx * dirY - leftDy * dirX);
        const leftScore = leftAlong * 0.04 - leftLateral * 0.45 + (left.elite ? 8 : 0) + (left.archetype === 'ranged' ? 4 : 0);

        const rightDx = right.x - currentEnemy.x;
        const rightDy = right.y - currentEnemy.y;
        const rightAlong = rightDx * dirX + rightDy * dirY;
        const rightLateral = Math.abs(rightDx * dirY - rightDy * dirX);
        const rightScore =
          rightAlong * 0.04 - rightLateral * 0.45 + (right.elite ? 8 : 0) + (right.archetype === 'ranged' ? 4 : 0);

        return rightScore - leftScore;
      });

    if (nearbyTargets.length === 0) {
      return;
    }

    const echoTargets = nearbyTargets.slice(0, this.getPierceEchoCount());
    const echoFlowCount = this.registerPierceFlow(battle, {
      hitCount: bullet.hitCount,
      echoCount: echoTargets.length,
      laneScore: this.getPierceLaneScore(battle, currentEnemy),
    });
    this.createCombatPulse(battle, {
      x: currentEnemy.x,
      y: currentEnemy.y,
      radius: currentEnemy.radius + 10,
      lifeSec: 0.18,
      color: 0x88d4ff,
      secondaryColor: 0xf5fbff,
      fillAlpha: 0.08,
      strokeAlpha: 0.72,
      strokeWidth: 2,
      growthPerSec: 160,
      innerRadiusRatio: 0.66,
      spokeCount: Math.min(6, 2 + echoFlowCount),
      spokeLength: 12 + echoTargets.length * 3,
      angle: Math.atan2(bullet.vy, bullet.vx),
      spinRate: 5.6,
    });
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
        hitCount: 0,
        routeFocus: 'pierce',
      });
      this.createCombatPulse(battle, {
        x: target.x,
        y: target.y,
        radius: target.radius + 8,
        lifeSec: 0.12,
        color: 0x79c4ff,
        secondaryColor: 0xffffff,
        fillAlpha: 0.04,
        strokeAlpha: 0.34,
        strokeWidth: 1.5,
        growthPerSec: 120,
        innerRadiusRatio: 0.72,
      });
    }

    bullet.canEcho = false;
    battle.tempoPulseSec = Math.max(battle.tempoPulseSec, 0.16);
    this.enqueueAudio('pierceEcho');
    if (!this.routeMomentShown.pierce) {
      this.routeMomentShown.pierce = true;
      this.enqueueTip('穿透火力开始扇裂');
    }
  }

  private handleEnemyDefeated(battle: BattleState, enemy: BattleState['enemies'][number]): void {
    const critStage = this.getRouteBuildStage('crit');
    const pierceStage = this.getRouteBuildStage('pierce');
    const dashStage = this.getRouteBuildStage('dash');
    const moveMagnitude = Math.hypot(battle.playerMoveDirX, battle.playerMoveDirY);
    const pickupLeadRatio = this.isPickupLeadEnemy(battle, enemy) ? this.getPickupLeadRatio(battle) : 0;
    const ordinarySurgeRatio = this.getOrdinaryBattleSurgeRatio(battle);
    const critSplashRatio = this.getCritSplashRatio(battle);
    const flowChainCount = this.registerKillFlow(battle, enemy);
    const flowChainBonus = Math.max(0, flowChainCount - 1);
    if (!enemy.elite && pickupLeadRatio > 0.08) {
      battle.pickupFlowSec = Math.max(
        battle.pickupFlowSec,
        0.34 + ordinarySurgeRatio * 0.12 + pickupLeadRatio * 0.12,
      );
      battle.playerTurnBurstSec = Math.max(
        battle.playerTurnBurstSec,
        0.08 + ordinarySurgeRatio * 0.08 + pickupLeadRatio * 0.08,
      );
      battle.tempoPulseSec = Math.max(
        battle.tempoPulseSec,
        0.2 + ordinarySurgeRatio * 0.08 + pickupLeadRatio * 0.08,
      );
      battle.pickupLeadEnemyId = null;
      battle.pickupLeadSec = 0;
      this.createCombatPulse(battle, {
        x: enemy.x,
        y: enemy.y,
        radius: enemy.radius + 20 + ordinarySurgeRatio * 10,
        lifeSec: 0.14 + pickupLeadRatio * 0.04,
        color: 0xbaffcf,
        secondaryColor: 0xffffff,
        fillAlpha: 0.05,
        strokeAlpha: 0.34 + pickupLeadRatio * 0.12,
        strokeWidth: 2.2,
        growthPerSec: 188,
        innerRadiusRatio: 0.7,
        spokeCount: 4,
        spokeLength: 12 + ordinarySurgeRatio * 6,
        angle: Math.atan2(enemy.y - battle.playerY, enemy.x - battle.playerX),
        spinRate: 5.4,
      });
    }
    let critSplashHits = 0;
    if (critSplashRatio > 0) {
      for (const target of battle.enemies) {
        if (target.id === enemy.id || target.hp <= 0) {
          continue;
        }
        const distance = Math.hypot(target.x - enemy.x, target.y - enemy.y);
        if (distance <= 72) {
          target.hp -= this.state.stats.damage * critSplashRatio;
          critSplashHits += 1;
        }
      }
    }
    if (critSplashHits > 0) {
      this.enqueueAudio('critSplash');
    }

    const pierceRefund = this.getPierceCooldownRefund();
    if (pierceRefund > 0) {
      battle.fireCooldownSec = Math.max(0.04, battle.fireCooldownSec - pierceRefund);
    }
    if (pierceStage === 'committed' || pierceStage === 'matured') {
      const laneScore = this.getPierceLaneScore(battle, enemy);
      if (enemy.elite || laneScore >= 1.2) {
        battle.fireCooldownSec = Math.max(
          0.035,
          battle.fireCooldownSec - (enemy.elite ? 0.028 : 0.014) - flowChainBonus * 0.003,
        );
        battle.tempoPulseSec = Math.max(battle.tempoPulseSec, enemy.elite ? 0.28 : 0.22 + flowChainBonus * 0.02);
        this.createCombatPulse(battle, {
          x: enemy.x,
          y: enemy.y,
          radius: enemy.radius + (enemy.elite ? 24 : 18) + Math.min(10, laneScore * 3),
          lifeSec: 0.16,
          color: 0x8fd8ff,
          secondaryColor: 0xf7fcff,
          fillAlpha: 0.05,
          strokeAlpha: 0.6,
          strokeWidth: 2,
          growthPerSec: 196,
          innerRadiusRatio: 0.66,
          spokeCount: enemy.elite ? 6 : 4,
          spokeLength: enemy.elite ? 24 : 16 + Math.min(8, laneScore * 2),
          angle: Math.atan2(enemy.y - battle.playerY, enemy.x - battle.playerX),
          spinRate: enemy.elite ? 6.4 : 5,
        });
      }
    }

    if (critStage === 'committed' || critStage === 'matured') {
      battle.critOverdriveSec = Math.min(4.2, battle.critOverdriveSec + (enemy.elite ? 0.42 : 0.18));
      battle.fireCooldownSec = Math.max(
        0.035,
        battle.fireCooldownSec - (enemy.elite ? 0.04 : critStage === 'matured' ? 0.028 : 0.018) - flowChainBonus * 0.003,
      );
      if (this.state.routeCounts.crit > 0) {
        this.createCombatPulse(battle, {
          x: enemy.x,
          y: enemy.y,
          radius: enemy.radius + (enemy.elite ? 26 : 18),
          lifeSec: 0.18,
          color: 0xffd978,
          secondaryColor: 0xfffbdf,
          fillAlpha: 0.06,
          strokeAlpha: 0.58,
          strokeWidth: 2,
          growthPerSec: 190,
          innerRadiusRatio: 0.68,
          spokeCount: enemy.elite ? 7 : 5,
          spokeLength: enemy.elite ? 28 : 18,
          angle: Math.atan2(battle.playerY - enemy.y, battle.playerX - enemy.x),
          spinRate: enemy.elite ? 6.8 : 5.2,
        });
      }
    }

    if (this.state.routeCounts.dash > 0) {
      const chaseCarry = dashStage === 'matured' ? 0.22 : dashStage === 'committed' ? 0.14 : 0.08;
      battle.dashDriveSec = Math.min(1.55, Math.max(battle.dashDriveSec, 0.35) + chaseCarry);
      if (dashStage !== 'unformed') {
        this.state.stats.hp = clamp(this.state.stats.hp + 2, 0, this.state.stats.maxHp);
        battle.playerRecoverySec = Math.max(battle.playerRecoverySec, 0.22);
        battle.dashCharge = Math.min(6, battle.dashCharge + (enemy.elite ? 2 : 1));
        if (moveMagnitude > 0.08) {
          battle.fireCooldownSec = Math.max(
            0.035,
            battle.fireCooldownSec - (enemy.elite ? 0.04 : 0.022) - flowChainBonus * 0.004,
          );
          battle.tempoPulseSec = Math.max(battle.tempoPulseSec, 0.18 + flowChainBonus * 0.03);
        }
      }
    }

    if (!enemy.elite) {
      const familyColor =
        enemy.archetype === 'brute'
          ? 0xffc08a
          : enemy.archetype === 'ranged'
            ? 0x9ae1ff
            : enemy.archetype === 'skirmisher'
              ? 0x9fffd8
              : 0xffd6c7;
      this.createCombatPulse(battle, {
        x: enemy.x,
        y: enemy.y,
        radius:
          enemy.radius +
          (enemy.archetype === 'brute' ? 22 : enemy.archetype === 'ranged' ? 16 : enemy.archetype === 'skirmisher' ? 18 : 14) +
          flowChainBonus * 3,
        lifeSec: enemy.archetype === 'brute' ? 0.2 : 0.14,
        color: familyColor,
        secondaryColor: 0xffffff,
        fillAlpha: enemy.archetype === 'brute' ? 0.12 : 0.08,
        strokeAlpha: 0.42 + flowChainBonus * 0.06,
        strokeWidth: enemy.archetype === 'brute' ? 2.8 : 2,
        growthPerSec: enemy.archetype === 'brute' ? 240 : 190,
        innerRadiusRatio: enemy.archetype === 'skirmisher' ? 0.48 : 0.62,
      });
    }
    this.applyRegularDefeatHandoff(battle, enemy, flowChainBonus);

    this.createCombatPulse(battle, {
      x: enemy.x,
      y: enemy.y,
      radius: enemy.radius + (enemy.elite ? 18 : 10),
      lifeSec: enemy.elite ? 0.34 : 0.24,
      color: enemy.elite ? 0xffcc7b : 0xff9c83,
      secondaryColor: 0xffffff,
      fillAlpha: enemy.elite ? 0.18 : 0.1,
      strokeAlpha: enemy.elite ? 0.96 : 0.7,
      strokeWidth: enemy.elite ? 4 : 3,
      growthPerSec: enemy.elite ? 260 : 210,
      innerRadiusRatio: 0.6,
      spokeCount: enemy.elite ? 7 : enemy.archetype === 'brute' ? 5 : 4,
      spokeLength: enemy.elite ? 34 : enemy.archetype === 'brute' ? 24 : 18,
      angle: Math.atan2(battle.playerY - enemy.y, battle.playerX - enemy.x),
      spinRate: enemy.elite ? 8 : 6.2,
    });
    this.createCombatPulse(battle, {
      x: enemy.x,
      y: enemy.y,
      radius: enemy.radius + (enemy.elite ? 28 : 16),
      lifeSec: enemy.elite ? 0.18 : 0.12,
      color: enemy.elite ? 0xfff0b6 : 0xffd6c7,
      secondaryColor: enemy.elite ? 0xffd57f : 0xff9c83,
      fillAlpha: enemy.elite ? 0.12 : 0.08,
      strokeAlpha: enemy.elite ? 0.72 : 0.46,
      strokeWidth: enemy.elite ? 2.5 : 2,
      growthPerSec: enemy.elite ? 220 : 180,
      innerRadiusRatio: 0.54,
      spokeCount: enemy.elite ? 5 : 3,
      spokeLength: enemy.elite ? 22 : 14,
      angle: Math.atan2(enemy.y - battle.playerY, enemy.x - battle.playerX),
      spinRate: enemy.elite ? -5.6 : -4.2,
    });
    this.queueImpactFreeze(
      battle,
      enemy.elite ? 0.072 : enemy.archetype === 'brute' ? 0.042 : 0.032,
      enemy.elite ? 0.1 : enemy.archetype === 'brute' ? 0.22 : 0.3,
    );
    this.kickBattleShake(
      battle,
      enemy.elite ? 0.24 : enemy.archetype === 'brute' ? 0.14 : enemy.archetype === 'skirmisher' ? 0.12 : 0.1,
      enemy.elite ? 0.78 : enemy.archetype === 'brute' ? 0.34 : enemy.archetype === 'ranged' ? 0.28 : 0.24,
    );
    battle.playerShotFlashSec = Math.max(battle.playerShotFlashSec, enemy.elite ? 0.11 : 0.085 + flowChainBonus * 0.01);
    battle.playerShotRecoilSec = Math.max(battle.playerShotRecoilSec, enemy.elite ? 0.12 : 0.096);
    battle.playerShotRecoilStrength = Math.max(
      battle.playerShotRecoilStrength,
      enemy.elite ? 8 : enemy.archetype === 'brute' ? 6.4 : 5.8,
    );
    battle.tempoPulseSec = Math.max(battle.tempoPulseSec, enemy.elite ? 0.3 : 0.18 + flowChainBonus * 0.04);
    this.feedBattleFlow(
      battle,
      'kill',
      enemy.elite ? 5 + flowChainBonus * 0.8 : (enemy.archetype === 'brute' ? 2.5 : enemy.archetype === 'ranged' ? 2 : 1.4) + flowChainBonus * 0.45,
    );
    battle.fireCooldownSec = Math.max(0.035, battle.fireCooldownSec - (enemy.elite ? 0.02 : 0.01) - flowChainBonus * 0.003);
    this.enqueueAudio(enemy.elite ? 'crit' : 'kill');

    const orbValue = Math.round(this.getEnemyExperienceValue(battle, enemy.elite) * ENEMY_ARCHETYPES[enemy.archetype].experienceMultiplier);
    const orbBurstCount =
      enemy.elite ? Math.min(5, Math.max(3, Math.ceil(orbValue / 10))) : orbValue >= 18 ? 3 : orbValue >= 9 ? 2 : 1;
    const baseOrbValue = Math.floor(orbValue / orbBurstCount);
    let orbRemainder = orbValue - baseOrbValue * orbBurstCount;
    const playerAngle = Math.atan2(battle.playerY - enemy.y, battle.playerX - enemy.x);
    const spreadStep = orbBurstCount === 1 ? 0 : enemy.elite ? 0.42 : 0.32;
    for (let orbIndex = 0; orbIndex < orbBurstCount; orbIndex += 1) {
      const shardValue = baseOrbValue + (orbRemainder > 0 ? 1 : 0);
      orbRemainder = Math.max(0, orbRemainder - 1);
      const fan = orbIndex - (orbBurstCount - 1) * 0.5;
      const angle = playerAngle + fan * spreadStep + (Math.random() - 0.5) * 0.12;
      const launchSpeed = (enemy.elite ? 170 : 120) + Math.abs(fan) * (enemy.elite ? 22 : 16);
      battle.experienceOrbs.push({
        id: enemy.id * 10 + orbIndex,
        x: enemy.x + Math.cos(angle) * (enemy.elite ? 8 : 4),
        y: enemy.y + Math.sin(angle) * (enemy.elite ? 8 : 4),
        value: shardValue,
        velocityX: Math.cos(angle) * launchSpeed + (Math.random() - 0.5) * 26,
        velocityY: Math.sin(angle) * launchSpeed + (Math.random() - 0.5) * 26,
      });
    }

    // 路线特色击杀奖励
    const routeCounts = this.state.routeCounts;

    // Crit路线：暴击击杀产生爆炸波（小范围AOE伤害）
    if (enemy.lastHitWasCrit && routeCounts.crit >= 2) {
      const explosionRadius = 80 + routeCounts.crit * 8;
      const explosionDamage = this.state.stats.damage * (0.3 + routeCounts.crit * 0.05);

      battle.enemies.forEach((target) => {
        if (target.id === enemy.id || target.hp <= 0) return;
        const distance = Math.hypot(target.x - enemy.x, target.y - enemy.y);
        if (distance <= explosionRadius) {
          const falloff = 1 - distance / explosionRadius;
          target.hp -= explosionDamage * falloff;
          target.hitFlashSec = 0.12;
        }
      });

      this.createCombatPulse(battle, {
        x: enemy.x,
        y: enemy.y,
        radius: 20,
        lifeSec: 0.3,
        color: 0xff4444,
        secondaryColor: 0xffaa44,
        fillAlpha: 0.2,
        strokeAlpha: 0.8,
        strokeWidth: 3,
        growthPerSec: explosionRadius * 3,
        innerRadiusRatio: 0.3,
        spokeCount: 8,
        spokeLength: 20,
        angle: 0,
        spinRate: 12,
      });
    }

    // Pierce路线：穿透击杀触发连锁闪电（跳跃到附近敌人）
    if (enemy.lastHitWasPierce && routeCounts.pierce >= 2) {
      const chainCount = Math.min(3, 1 + Math.floor(routeCounts.pierce / 3));
      const chainDamage = this.state.stats.damage * (0.4 + routeCounts.pierce * 0.04);
      const chainRange = 120 + routeCounts.pierce * 6;

      let currentX = enemy.x;
      let currentY = enemy.y;
      const hitTargets = new Set<number>([enemy.id]);

      for (let i = 0; i < chainCount; i++) {
        const nearestTarget = battle.enemies
          .filter((target) => !hitTargets.has(target.id) && target.hp > 0)
          .map((target) => ({
            target,
            distance: Math.hypot(target.x - currentX, target.y - currentY),
          }))
          .filter(({ distance }) => distance <= chainRange)
          .sort((a, b) => a.distance - b.distance)[0];

        if (!nearestTarget) break;

        const damageMultiplier = Math.pow(0.7, i);
        nearestTarget.target.hp -= chainDamage * damageMultiplier;
        nearestTarget.target.hitFlashSec = 0.14;
        hitTargets.add(nearestTarget.target.id);

        this.createCombatPulse(battle, {
          x: nearestTarget.target.x,
          y: nearestTarget.target.y,
          radius: 12,
          lifeSec: 0.2,
          color: 0x44aaff,
          secondaryColor: 0xaaffff,
          fillAlpha: 0.15,
          strokeAlpha: 0.7,
          strokeWidth: 2,
          growthPerSec: 150,
          innerRadiusRatio: 0.5,
        });

        currentX = nearestTarget.target.x;
        currentY = nearestTarget.target.y;
      }
    }

    // Dash路线：脉冲击杀产生冲击波（击退+减速）
    if (enemy.lastHitWasDash && routeCounts.dash >= 2) {
      const shockwaveRadius = 100 + routeCounts.dash * 10;
      const knockbackStrength = 150 + routeCounts.dash * 15;
      const slowDuration = 1.5 + routeCounts.dash * 0.2;

      battle.enemies.forEach((target) => {
        if (target.id === enemy.id || target.hp <= 0) return;
        const dx = target.x - enemy.x;
        const dy = target.y - enemy.y;
        const distance = Math.hypot(dx, dy);

        if (distance <= shockwaveRadius && distance > 0) {
          const falloff = 1 - distance / shockwaveRadius;
          const knockbackX = (dx / distance) * knockbackStrength * falloff;
          const knockbackY = (dy / distance) * knockbackStrength * falloff;

          target.x += knockbackX * 0.016;
          target.y += knockbackY * 0.016;
          target.slowSec = Math.max(target.slowSec || 0, slowDuration * falloff);
          target.hitFlashSec = 0.1;
        }
      });

      this.createCombatPulse(battle, {
        x: enemy.x,
        y: enemy.y,
        radius: 25,
        lifeSec: 0.35,
        color: 0x00ffff,
        secondaryColor: 0xaaffff,
        fillAlpha: 0.1,
        strokeAlpha: 0.75,
        strokeWidth: 3.5,
        growthPerSec: shockwaveRadius * 2.5,
        innerRadiusRatio: 0.7,
        spokeCount: 6,
        spokeLength: 28,
        angle: 0,
        spinRate: -10,
      });
    }

    // Pierce路线独特被动：穿透印记爆破
    if (pierceStage === 'matured' && battle.pierceFractureMark.has(enemy.id)) {
      // 击杀带穿透印记的敌人时，传播印记到附近敌人
      const spreadRadius = 120;
      battle.enemies.forEach((target) => {
        if (target.id === enemy.id || target.hp <= 0) return;
        const distance = Math.hypot(target.x - enemy.x, target.y - enemy.y);
        if (distance <= spreadRadius) {
          battle.pierceFractureMark.add(target.id);
          target.hitFlashSec = 0.12;
        }
      });

      // 创建传播视觉效果
      this.createCombatPulse(battle, {
        x: enemy.x,
        y: enemy.y,
        radius: 20,
        lifeSec: 0.3,
        color: 0x8844ff,
        secondaryColor: 0xcc88ff,
        fillAlpha: 0.12,
        strokeAlpha: 0.65,
        strokeWidth: 2.5,
        growthPerSec: spreadRadius * 3,
        innerRadiusRatio: 0.6,
        spokeCount: 8,
        spokeLength: 16,
        angle: 0,
        spinRate: 12,
      });
    }
  }

  private applyRegularDefeatHandoff(
    battle: BattleState,
    enemy: BattleState['enemies'][number],
    flowChainBonus: number,
  ): void {
    if (enemy.elite || enemy.role !== 'regular' || battle.encounterType !== 'battle') {
      return;
    }

    const getNearbyRegulars = (
      radius: number,
      predicate?: (candidate: BattleState['enemies'][number]) => boolean,
    ): Array<BattleState['enemies'][number]> =>
      battle.enemies
        .filter((candidate) => {
          if (candidate.id === enemy.id || candidate.hp <= 0 || candidate.elite || candidate.role !== 'regular') {
            return false;
          }
          if (predicate && !predicate(candidate)) {
            return false;
          }
          return Math.hypot(candidate.x - enemy.x, candidate.y - enemy.y) <= radius;
        })
        .sort(
          (left, right) =>
            Math.hypot(left.x - enemy.x, left.y - enemy.y) - Math.hypot(right.x - enemy.x, right.y - enemy.y),
        );

    const midpointPulse = (target: BattleState['enemies'][number], color: number, secondaryColor: number): void => {
      this.createCombatPulse(battle, {
        x: (enemy.x + target.x) * 0.5,
        y: (enemy.y + target.y) * 0.5,
        radius: 12 + flowChainBonus * 2,
        lifeSec: 0.11,
        color,
        secondaryColor,
        fillAlpha: 0.03,
        strokeAlpha: 0.24,
        strokeWidth: 1.5,
        growthPerSec: 132,
        innerRadiusRatio: 0.7,
        spokeCount: 3,
        spokeLength: 10 + flowChainBonus * 2,
        angle: Math.atan2(target.y - enemy.y, target.x - enemy.x),
        spinRate: 5.2,
      });
    };

    switch (enemy.archetype) {
      case 'standard': {
        const relay = getNearbyRegulars(
          96,
          (candidate) =>
            (candidate.archetype === 'standard' || candidate.archetype === 'brute') &&
            candidate.recoverySec <= 0.08 &&
            candidate.tacticCooldownSec <= 0.06,
        )[0];
        if (!relay) {
          return;
        }
        if (
          this.triggerRegularPressureBeat(
            battle,
            relay,
            0.14 + Math.min(0.03, flowChainBonus * 0.01),
            0.78 + Math.min(0.08, flowChainBonus * 0.02),
          )
        ) {
          this.primeRegularPressureLead(battle, relay, 1);
          relay.spawnFlashSec = Math.max(relay.spawnFlashSec, 0.12);
          this.syncRegularPressurePack(battle, relay, {
            radius: 84,
            limit: 1,
            durationSec: 0.1,
            cooldownSec: 0.82,
            predicate: (candidate) => candidate.archetype === 'standard',
          });
          midpointPulse(relay, 0xffd8c7, 0xffffff);
          this.enqueueRegularRelayAudio('standard');
        }
        return;
      }
      case 'skirmisher': {
        const relay = getNearbyRegulars(
          124,
          (candidate) =>
            (candidate.archetype === 'skirmisher' || candidate.archetype === 'standard') &&
            candidate.recoverySec <= 0.1 &&
            candidate.tacticCooldownSec <= 0.08,
        )[0];
        if (!relay) {
          return;
        }
        if (
          this.triggerRegularPressureBeat(
            battle,
            relay,
            0.16 + Math.min(0.03, flowChainBonus * 0.01),
            0.94 + Math.min(0.08, flowChainBonus * 0.02),
          )
        ) {
          this.primeRegularPressureLead(battle, relay, 1.04);
          const dx = relay.x - enemy.x;
          const dy = relay.y - enemy.y;
          const distance = Math.max(1, Math.hypot(dx, dy));
          relay.hitOffsetX = clamp(relay.hitOffsetX + (dx / distance) * 5, -16, 16);
          relay.hitOffsetY = clamp(relay.hitOffsetY + (dy / distance) * 5, -16, 16);
          relay.spawnFlashSec = Math.max(relay.spawnFlashSec, 0.14);
          midpointPulse(relay, 0x9fffe2, 0xf4fffb);
          this.enqueueRegularRelayAudio('skirmisher');
        }
        return;
      }
      case 'brute': {
        const disrupted = getNearbyRegulars(126).slice(0, 3);
        if (disrupted.length === 0) {
          return;
        }
        battle.playerMoveBoostSec = Math.max(battle.playerMoveBoostSec, 0.18 + Math.min(0.04, flowChainBonus * 0.01));
        disrupted.forEach((candidate, index) => {
          const dx = candidate.x - enemy.x;
          const dy = candidate.y - enemy.y;
          const distance = Math.max(1, Math.hypot(dx, dy));
          const recoil = candidate.archetype === 'brute' ? 8 : candidate.archetype === 'ranged' ? 7 : 6;
          candidate.hitOffsetX = clamp(candidate.hitOffsetX + (dx / distance) * recoil, -18, 18);
          candidate.hitOffsetY = clamp(candidate.hitOffsetY + (dy / distance) * recoil, -18, 18);
          this.pushEnemyRecovery(
            candidate,
            candidate.archetype === 'ranged' ? 0.18 : candidate.archetype === 'skirmisher' ? 0.16 : 0.14,
          );
          candidate.spawnFlashSec = Math.max(candidate.spawnFlashSec, 0.1 - index * 0.01);
          if (candidate.archetype === 'ranged') {
            candidate.rangedCooldownSec = Math.max(candidate.rangedCooldownSec, 0.38 + index * 0.04);
          }
        });
        const relay = disrupted.find((candidate) => candidate.archetype === 'standard' || candidate.archetype === 'brute');
        if (
          relay &&
          this.triggerRegularPressureBeat(
            battle,
            relay,
            0.16 + Math.min(0.03, flowChainBonus * 0.01),
            0.98 + Math.min(0.08, flowChainBonus * 0.02),
          )
        ) {
          this.primeRegularPressureLead(battle, relay, 0.92);
        }
        this.createCombatPulse(battle, {
          x: enemy.x,
          y: enemy.y,
          radius: enemy.radius + 28 + disrupted.length * 4,
          lifeSec: 0.16,
          color: 0xffd0a2,
          secondaryColor: 0xfff4e2,
          fillAlpha: 0.08,
          strokeAlpha: 0.34,
          strokeWidth: 2,
          growthPerSec: 176,
          innerRadiusRatio: 0.68,
        });
        this.enqueueRegularRelayAudio('brute');
        return;
      }
      case 'ranged': {
        const softened = getNearbyRegulars(
          136,
          (candidate) => candidate.archetype === 'ranged' || candidate.archetype === 'skirmisher',
        ).slice(0, 2);
        if (softened.length === 0) {
          return;
        }
        battle.playerTurnBurstSec = Math.max(
          battle.playerTurnBurstSec,
          0.08 + Math.min(0.03, flowChainBonus * 0.01),
        );
        softened.forEach((candidate, index) => {
          const dx = candidate.x - enemy.x;
          const dy = candidate.y - enemy.y;
          const distance = Math.max(1, Math.hypot(dx, dy));
          candidate.hitOffsetX = clamp(candidate.hitOffsetX + (dx / distance) * 5, -14, 14);
          candidate.hitOffsetY = clamp(candidate.hitOffsetY + (dy / distance) * 5, -14, 14);
          this.pushEnemyRecovery(candidate, candidate.archetype === 'ranged' ? 0.18 : 0.14);
          candidate.spawnFlashSec = Math.max(candidate.spawnFlashSec, 0.12);
          candidate.tacticCooldownSec = Math.max(candidate.tacticCooldownSec, 0.18 + index * 0.04);
          if (candidate.archetype === 'ranged') {
            candidate.rangedCooldownSec = Math.max(candidate.rangedCooldownSec, 0.44 + index * 0.06);
          }
        });
        const relay = softened.find((candidate) => candidate.archetype === 'ranged') ?? softened[0];
        if (
          relay &&
          this.triggerRegularPressureBeat(
            battle,
            relay,
            0.16 + Math.min(0.04, flowChainBonus * 0.012),
            0.92 + Math.min(0.08, flowChainBonus * 0.02),
            {
              rangedLeadSec: 0.24,
            },
          )
        ) {
          this.primeRegularPressureLead(battle, relay, 0.88);
        }
        this.createCombatPulse(battle, {
          x: enemy.x,
          y: enemy.y,
          radius: enemy.radius + 24 + softened.length * 4,
          lifeSec: 0.15,
          color: 0xaee8ff,
          secondaryColor: 0xf6fcff,
          fillAlpha: 0.06,
          strokeAlpha: 0.32,
          strokeWidth: 2,
          growthPerSec: 164,
          innerRadiusRatio: 0.72,
        });
        this.enqueueRegularRelayAudio('ranged');
        return;
      }
      default:
        return;
    }
  }

  private getNearestEnemy(battle: BattleState): BattleState['enemies'][number] | null {
    if (battle.enemies.length === 0) {
      return null;
    }

    const focusRoute = this.getLiveCombatFocusRoute(battle);
    const activeElite = battle.eliteAlive ? this.getEliteEnemy(battle) : null;
    const activeEliteRecovery = activeElite ? this.getEnemyRecoveryRatio(activeElite) : 0;
    const eliteCrackRatio = activeElite ? this.getEliteCrackWindowRatio(battle) : 0;
    const activeEliteEscortCount =
      activeElite && (activeEliteRecovery > 0.18 || eliteCrackRatio > 0.08)
        ? this.countNearbyAllies(
            battle,
            activeElite,
            208,
            (candidate) => !candidate.elite && candidate.role === 'escort',
          )
        : 0;
    const moveMagnitude = Math.hypot(battle.playerMoveDirX, battle.playerMoveDirY);
    const pickupFlowRatio = this.getPickupFlowRatio(battle);
    const pickupLeadRatio = this.getPickupLeadRatio(battle);
    const ordinarySurgeRatio = this.getOrdinaryBattleSurgeRatio(battle);
    let bestTarget: BattleState['enemies'][number] | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const enemy of battle.enemies) {
      if (enemy.hp <= 0) {
        continue;
      }
      const dx = enemy.x - battle.playerX;
      const dy = enemy.y - battle.playerY;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const recoveryRatio = this.getEnemyRecoveryRatio(enemy);
      const isPickupLead = this.isPickupLeadEnemy(battle, enemy);
      const eliteLinkDistance = activeElite ? Math.hypot(enemy.x - activeElite.x, enemy.y - activeElite.y) : Number.POSITIVE_INFINITY;
      const eliteEscortCount =
        enemy.elite
          ? this.countNearbyAllies(
              battle,
              enemy,
              188,
              (candidate) => !candidate.elite && candidate.role === 'escort',
            )
          : 0;
      let score = 132 - distance * 0.42 + (enemy.elite ? 18 : 0);
      if (battle.encounterType === 'boss' && activeElite) {
        if (enemy.id === activeElite.id) {
          score += 96;
          score += distance <= 360 ? 28 : 12;
        } else if (enemy.role === 'escort') {
          score -= 42;
          if (eliteLinkDistance <= 260) {
            score -= 28;
          }
        }
      }
      if (!enemy.elite && isPickupLead) {
        score += 28 + pickupLeadRatio * 34 + ordinarySurgeRatio * 18;
      }
      if (!enemy.elite && ordinarySurgeRatio > 0.08) {
        score += Math.max(0, 180 - distance) * 0.03;
        if (moveMagnitude > 0.05) {
          const surgeAlignment = ((dx / distance) * battle.playerMoveDirX) + ((dy / distance) * battle.playerMoveDirY);
          score += Math.max(0, surgeAlignment) * (8 + pickupFlowRatio * 14 + ordinarySurgeRatio * 8);
        }
      }

      if (activeElite && (activeEliteRecovery > 0.18 || eliteCrackRatio > 0.08)) {
        const crackEscortGap = Math.max(0, 2 - activeEliteEscortCount);
        const crackBias = activeEliteRecovery * 42 + eliteCrackRatio * 56;
        if (enemy.id === activeElite.id) {
          score += 44 + crackBias + activeEliteEscortCount * 5 + crackEscortGap * 18;
          score += eliteCrackRatio > 0 ? 18 + eliteCrackRatio * 28 : 0;
          if (moveMagnitude > 0.05) {
            const chaseAlignment = ((dx / distance) * battle.playerMoveDirX) + ((dy / distance) * battle.playerMoveDirY);
            score += Math.max(0, chaseAlignment) * (18 + crackEscortGap * 10 + eliteCrackRatio * 14);
          }
        } else if (enemy.role === 'escort' && eliteLinkDistance <= 236) {
          score -= 18 + activeEliteRecovery * 24 + crackEscortGap * 12 + eliteCrackRatio * 32;
        }
      }
      if (battle.encounterType === 'battle' && activeElite && enemy.id === activeElite.id) {
        const eliteHpRatio = enemy.hp / Math.max(1, enemy.maxHp);
        if (focusRoute === 'crit' && (activeEliteRecovery > 0.16 || eliteCrackRatio > 0.08)) {
          score += 14 + (1 - eliteHpRatio) * 28 + Math.max(activeEliteRecovery, eliteCrackRatio) * 24;
        } else if (focusRoute === 'pierce' && (activeEliteRecovery > 0.16 || eliteCrackRatio > 0.08)) {
          const laneScore = this.getPierceLaneScore(battle, enemy);
          score += 12 + laneScore * 12 + Math.max(activeEliteRecovery, eliteCrackRatio) * 20;
        }
      }

      if (focusRoute === 'crit') {
        const hpRatio = enemy.hp / Math.max(1, enemy.maxHp);
        score += (1 - hpRatio) * (battle.critOverdriveSec > 0 ? 78 : 46);
        score += enemy.elite ? (battle.critOverdriveSec > 0 ? 34 : 16) : 0;
        score += battle.critChain >= 2 && distance <= 180 ? 18 : 0;
        score += hpRatio <= 0.35 ? 26 : 0;
        score += recoveryRatio * (battle.critOverdriveSec > 0 ? 34 : 20);
        score += enemy.elite && recoveryRatio > 0.2 ? 28 + recoveryRatio * 24 : 0;
        score += enemy.elite ? eliteCrackRatio * 28 : 0;
        if (enemy.elite && eliteEscortCount > 0) {
          score += eliteEscortCount * (recoveryRatio > 0.18 ? 14 : 7);
        }
      } else if (focusRoute === 'pierce') {
        const laneScore = this.getPierceLaneScore(battle, enemy);
        score += laneScore * 26;
        score += Math.max(0, distance - 110) * 0.08;
        score += enemy.archetype === 'ranged' ? 6 : 0;
        score += recoveryRatio * 16;
        score += enemy.elite && laneScore >= 1.2 ? 24 + laneScore * 8 : 0;
        score += activeElite && enemy.id === activeElite.id && activeEliteRecovery > 0.18 ? 18 + laneScore * 10 : 0;
        score += enemy.elite ? eliteCrackRatio * (laneScore >= 1.2 ? 34 : 18) : 0;
        score -= activeElite && enemy.role === 'escort' && activeEliteRecovery > 0.18 && eliteLinkDistance <= 236 ? 8 : 0;
        if (enemy.elite && eliteEscortCount > 0) {
          score += eliteEscortCount * (laneScore >= 1.2 ? 10 : 4);
        }
      } else if (focusRoute === 'dash') {
        score += Math.max(0, 200 - distance) * 0.28;
        score += enemy.archetype === 'ranged' ? 18 : 0;
        if (moveMagnitude > 0.05) {
          const alignment = ((dx / distance) * battle.playerMoveDirX) + ((dy / distance) * battle.playerMoveDirY);
          score += Math.max(0, alignment) * (battle.dashDriveSec > 0 ? 44 : 22);
        }
        if (battle.dashDriveSec > 0 && distance <= 150) {
          score += 24;
        }
        score += enemy.elite && recoveryRatio > 0.2 ? 8 + recoveryRatio * 12 : 0;
      }
      if (!enemy.elite && ordinarySurgeRatio > 0.1) {
        score +=
          enemy.archetype === 'skirmisher'
            ? 6 + ordinarySurgeRatio * 8
            : enemy.archetype === 'ranged'
              ? 4 + pickupFlowRatio * 10
              : enemy.archetype === 'standard'
                ? 4 + ordinarySurgeRatio * 6
                : 2 + ordinarySurgeRatio * 4;
      }

      score += recoveryRatio * 6;

      if (score > bestScore) {
        bestScore = score;
        bestTarget = enemy;
      }
    }

    return bestTarget;
  }

  private getLiveCombatFocusRoute(battle: BattleState): RouteId | null {
    if (battle.dashDriveSec > 0 && this.getRouteBuildStage('dash') !== 'unformed') {
      return 'dash';
    }
    if (battle.critOverdriveSec > 0 && this.getRouteBuildStage('crit') !== 'unformed') {
      return 'crit';
    }
    if (battle.pierceFlowSec > 0 && this.getRouteBuildStage('pierce') !== 'unformed') {
      return 'pierce';
    }
    return this.state.maturedRoute ?? this.state.committedRoute ?? this.getDominantRoute();
  }

  private getPierceLaneScore(
    battle: BattleState,
    candidate: BattleState['enemies'][number],
  ): number {
    const dx = candidate.x - battle.playerX;
    const dy = candidate.y - battle.playerY;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const dirX = dx / distance;
    const dirY = dy / distance;
    let score = 0;

    for (const enemy of battle.enemies) {
      if (enemy.id === candidate.id || enemy.hp <= 0) {
        continue;
      }

      const enemyDx = enemy.x - battle.playerX;
      const enemyDy = enemy.y - battle.playerY;
      const along = enemyDx * dirX + enemyDy * dirY;
      if (along < distance - 10 || along > distance + 220) {
        continue;
      }

      const lateral = Math.abs(enemyDx * dirY - enemyDy * dirX);
      if (lateral > enemy.radius + 24) {
        continue;
      }

      score += 1 + (enemy.elite ? 1 : 0) + (enemy.archetype === 'ranged' ? 0.35 : 0);
    }

    return score;
  }

  private pushEnemyRecovery(enemy: BattleState['enemies'][number], recoverySec: number): void {
    enemy.recoverySec = Math.max(enemy.recoverySec, recoverySec);
  }

  private applyEnemyHitRecoil(
    enemy: BattleState['enemies'][number],
    dirX: number,
    dirY: number,
    kick: number,
  ): void {
    if (enemy.elite) {
      enemy.hitOffsetX = dirX * kick;
      enemy.hitOffsetY = dirY * kick;
      return;
    }

    const orthoX = -dirY;
    const orthoY = dirX;
    const sideSign = enemy.id % 2 === 0 ? -1 : 1;
    let worldPush = 2.6 + kick * 0.16;
    let lateralPush = 0;
    let visualPush = kick * 0.82 + 1.4;
    let recoverySec = 0.12 + kick * 0.004;
    let tacticSec = 0.06;
    let rangedDelaySec = 0;

    switch (enemy.archetype) {
      case 'brute':
        worldPush = 1.8 + kick * 0.1;
        lateralPush = sideSign * (0.6 + kick * 0.03);
        visualPush = kick * 0.66 + 1.2;
        recoverySec = 0.1 + kick * 0.004;
        tacticSec = 0.07;
        break;
      case 'skirmisher':
        worldPush = 3.2 + kick * 0.18;
        lateralPush = sideSign * (1.8 + kick * 0.08);
        visualPush = kick * 0.86 + 1.8;
        recoverySec = 0.13 + kick * 0.005;
        tacticSec = 0.08;
        break;
      case 'ranged':
        worldPush = 4.2 + kick * 0.2;
        lateralPush = sideSign * (1.2 + kick * 0.05);
        visualPush = kick * 0.92 + 2;
        recoverySec = 0.16 + kick * 0.006;
        tacticSec = 0.1;
        rangedDelaySec = 0.16 + kick * 0.012;
        break;
      case 'standard':
      default:
        break;
    }

    enemy.x = clamp(enemy.x + dirX * worldPush + orthoX * lateralPush, -44, ARENA_WIDTH + 44);
    enemy.y = clamp(enemy.y + dirY * worldPush + orthoY * lateralPush, -44, ARENA_HEIGHT + 44);
    enemy.hitOffsetX = clamp(enemy.hitOffsetX + dirX * visualPush + orthoX * lateralPush * 1.1, -20, 20);
    enemy.hitOffsetY = clamp(enemy.hitOffsetY + dirY * visualPush + orthoY * lateralPush * 1.1, -20, 20);
    this.pushEnemyRecovery(enemy, recoverySec);
    enemy.tacticCooldownSec = Math.max(enemy.tacticCooldownSec, tacticSec);
    if (rangedDelaySec > 0) {
      enemy.rangedCooldownSec = Math.max(enemy.rangedCooldownSec, rangedDelaySec);
    }
  }

  private getEnemyRecoveryOnCollisionSec(enemy: BattleState['enemies'][number]): number {
    if (enemy.elite) {
      return 0.28;
    }

    switch (enemy.archetype) {
      case 'brute':
        return 0.44;
      case 'ranged':
        return 0.38;
      case 'skirmisher':
        return 0.3;
      case 'standard':
      default:
        return 0.22;
    }
  }

  private getEnemyRecoveryWindowSec(enemy: BattleState['enemies'][number]): number {
    if (enemy.elite) {
      return 0.32;
    }

    switch (enemy.archetype) {
      case 'brute':
        return 0.44;
      case 'ranged':
        return 0.42;
      case 'skirmisher':
        return 0.34;
      case 'standard':
      default:
        return 0.24;
    }
  }

  private getEnemyRecoveryRatio(enemy: BattleState['enemies'][number]): number {
    return clamp(enemy.recoverySec / this.getEnemyRecoveryWindowSec(enemy), 0, 1);
  }

  private getEnemyPressureWindowSec(enemy: BattleState['enemies'][number]): number {
    if (enemy.elite) {
      return 0.72;
    }

    switch (enemy.archetype) {
      case 'brute':
        return 0.22;
      case 'ranged':
        return 0.2;
      case 'skirmisher':
        return 0.18;
      case 'standard':
      default:
        return 0.16;
    }
  }

  private primeRegularPressureLead(
    battle: BattleState,
    enemy: BattleState['enemies'][number],
    intensity = 1,
  ): void {
    if (enemy.elite) {
      return;
    }

    const dx = battle.playerX - enemy.x;
    const dy = battle.playerY - enemy.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const dirX = dx / distance;
    const dirY = dy / distance;
    const orthoX = -dirY;
    const orthoY = dirX;
    const sideSign = enemy.id % 2 === 0 ? -1 : 1;
    let worldLead = 1.4 * intensity;
    let visualLead = 2.8 * intensity;
    let lateralLead = 0;

    switch (enemy.archetype) {
      case 'brute':
        worldLead = 1.8 * intensity;
        visualLead = 3.2 * intensity;
        lateralLead = sideSign * 0.6 * intensity;
        break;
      case 'skirmisher':
        worldLead = 1.4 * intensity;
        visualLead = 3 * intensity;
        lateralLead = sideSign * 2.8 * intensity;
        break;
      case 'ranged':
        worldLead = 0.8 * intensity;
        visualLead = 2.2 * intensity;
        lateralLead = sideSign * 1.2 * intensity;
        enemy.rangedCooldownSec = enemy.rangedCooldownSec > 0 ? Math.min(enemy.rangedCooldownSec, 0.26) : 0;
        break;
      case 'standard':
      default:
        break;
    }

    enemy.x = clamp(enemy.x + dirX * worldLead + orthoX * lateralLead * 0.35, -42, ARENA_WIDTH + 42);
    enemy.y = clamp(enemy.y + dirY * worldLead + orthoY * lateralLead * 0.35, -42, ARENA_HEIGHT + 42);
    enemy.hitOffsetX = clamp(enemy.hitOffsetX + dirX * visualLead + orthoX * lateralLead, -18, 18);
    enemy.hitOffsetY = clamp(enemy.hitOffsetY + dirY * visualLead + orthoY * lateralLead, -18, 18);
  }

  private enqueueRegularRelayAudio(archetype: EnemyArchetypeId): void {
    const cue: AudioCue =
      archetype === 'brute'
        ? 'relayBrute'
        : archetype === 'skirmisher'
          ? 'relaySkirmisher'
          : archetype === 'ranged'
            ? 'relayRanged'
            : 'relayStandard';
    this.enqueueAudio(cue);
  }

  private triggerEnemyPressurePulse(
    enemy: BattleState['enemies'][number],
    durationSec: number,
    cooldownSec: number,
  ): boolean {
    if (enemy.tacticCooldownSec > 0) {
      return false;
    }

    enemy.pressurePulseSec = Math.max(enemy.pressurePulseSec, durationSec);
    enemy.tacticCooldownSec = Math.max(enemy.tacticCooldownSec, cooldownSec);
    return true;
  }

  private triggerRegularPressureBeat(
    battle: BattleState,
    enemy: BattleState['enemies'][number],
    durationSec: number,
    cooldownSec: number,
    options?: {
      rangedLeadSec?: number;
    },
  ): boolean {
    if (enemy.elite) {
      return false;
    }
    if (!this.triggerEnemyPressurePulse(enemy, durationSec, cooldownSec)) {
      return false;
    }

    enemy.spawnFlashSec = Math.max(
      enemy.spawnFlashSec,
      enemy.archetype === 'brute' ? 0.18 : enemy.archetype === 'ranged' ? 0.16 : enemy.archetype === 'skirmisher' ? 0.15 : 0.13,
    );
    if (enemy.archetype === 'ranged' && enemy.rangedCooldownSec > 0) {
      enemy.rangedCooldownSec = Math.min(enemy.rangedCooldownSec, options?.rangedLeadSec ?? 0.42);
    }

    const pulseColor =
      enemy.archetype === 'brute'
        ? 0xffc386
        : enemy.archetype === 'ranged'
          ? 0x9edfff
          : enemy.archetype === 'skirmisher'
            ? 0x92ffe1
            : 0xffd6c2;
    this.createCombatPulse(battle, {
      x: enemy.x,
      y: enemy.y,
      radius: enemy.radius + (enemy.archetype === 'brute' ? 12 : enemy.archetype === 'ranged' ? 10 : 9),
      lifeSec: enemy.archetype === 'brute' ? 0.14 : 0.11,
      color: pulseColor,
      secondaryColor: 0xffffff,
      fillAlpha: 0.04,
      strokeAlpha: 0.34,
      strokeWidth: enemy.archetype === 'brute' ? 2.6 : 2,
      growthPerSec: enemy.archetype === 'skirmisher' ? 160 : 132,
      innerRadiusRatio: enemy.archetype === 'skirmisher' ? 0.54 : 0.68,
      spokeCount: enemy.archetype === 'brute' ? 4 : enemy.archetype === 'ranged' ? 5 : enemy.archetype === 'skirmisher' ? 5 : 3,
      spokeLength: enemy.archetype === 'brute' ? 16 : enemy.archetype === 'ranged' ? 18 : enemy.archetype === 'skirmisher' ? 16 : 12,
      angle: Math.atan2(battle.playerY - enemy.y, battle.playerX - enemy.x),
      spinRate: enemy.archetype === 'skirmisher' ? 6.2 : enemy.archetype === 'ranged' ? 5.4 : 4.6,
    });
    return true;
  }

  private syncRegularPressurePack(
    battle: BattleState,
    source: BattleState['enemies'][number],
    options?: {
      radius?: number;
      limit?: number;
      durationSec?: number;
      cooldownSec?: number;
      predicate?: (candidate: BattleState['enemies'][number]) => boolean;
    },
  ): number {
    const radius = options?.radius ?? 104;
    const limit = options?.limit ?? 1;
    const durationSec = options?.durationSec ?? 0.12;
    const cooldownSec = options?.cooldownSec ?? 0.92;
    const candidates = battle.enemies
      .filter((candidate) => {
        if (candidate.id === source.id || candidate.hp <= 0 || candidate.elite || candidate.role !== 'regular') {
          return false;
        }
        if (candidate.recoverySec > 0.08 || candidate.tacticCooldownSec > 0.04) {
          return false;
        }
        if (options?.predicate && !options.predicate(candidate)) {
          return false;
        }
        return Math.hypot(candidate.x - source.x, candidate.y - source.y) <= radius;
      })
      .sort(
        (left, right) =>
          Math.hypot(left.x - source.x, left.y - source.y) - Math.hypot(right.x - source.x, right.y - source.y),
      )
      .slice(0, limit);

    let syncedCount = 0;
    candidates.forEach((candidate, index) => {
      if (this.triggerEnemyPressurePulse(candidate, durationSec, cooldownSec + index * 0.08)) {
        candidate.spawnFlashSec = Math.max(candidate.spawnFlashSec, 0.1);
        this.primeRegularPressureLead(battle, candidate, candidate.archetype === 'ranged' ? 0.82 : 0.9);
        syncedCount += 1;
      }
    });
    return syncedCount;
  }

  private findNearestAlly(
    battle: BattleState,
    source: BattleState['enemies'][number],
    predicate?: (candidate: BattleState['enemies'][number]) => boolean,
  ): BattleState['enemies'][number] | null {
    let best: BattleState['enemies'][number] | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const candidate of battle.enemies) {
      if (candidate.id === source.id || candidate.hp <= 0) {
        continue;
      }
      if (predicate && !predicate(candidate)) {
        continue;
      }

      const distance = Math.hypot(candidate.x - source.x, candidate.y - source.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = candidate;
      }
    }

    return best;
  }

  private countNearbyAllies(
    battle: BattleState,
    source: BattleState['enemies'][number],
    maxDistance: number,
    predicate?: (candidate: BattleState['enemies'][number]) => boolean,
  ): number {
    let count = 0;
    for (const candidate of battle.enemies) {
      if (candidate.id === source.id || candidate.hp <= 0) {
        continue;
      }
      if (predicate && !predicate(candidate)) {
        continue;
      }
      if (Math.hypot(candidate.x - source.x, candidate.y - source.y) <= maxDistance) {
        count += 1;
      }
    }
    return count;
  }

  private getActiveEscortCount(battle: BattleState): number {
    return battle.enemies.filter((enemy) => !enemy.elite && enemy.role === 'escort' && enemy.hp > 0).length;
  }

  private getEliteEnemy(battle: BattleState): BattleState['enemies'][number] | null {
    return battle.enemies.find((enemy) => enemy.elite && enemy.hp > 0) ?? null;
  }

  private getEliteNearbyEscorts(
    battle: BattleState,
    eliteEnemy: BattleState['enemies'][number] | null,
    maxDistance: number,
  ): Array<BattleState['enemies'][number]> {
    if (!eliteEnemy) {
      return [];
    }

    return battle.enemies
      .filter((enemy) => !enemy.elite && enemy.role === 'escort' && enemy.hp > 0)
      .map((enemy) => ({
        enemy,
        distance: Math.hypot(enemy.x - eliteEnemy.x, enemy.y - eliteEnemy.y),
      }))
      .filter((entry) => entry.distance <= maxDistance)
      .sort((left, right) => left.distance - right.distance)
      .map((entry) => entry.enemy);
  }

  private getEliteCrackWindowRatio(battle: BattleState): number {
    return clamp(battle.eliteCrackWindowSec / 0.82, 0, 1);
  }

  private getEliteBreachFollowThroughRatio(
    battle: BattleState,
    enemy: BattleState['enemies'][number],
  ): number {
    if (battle.encounterType !== 'battle' || !enemy.elite) {
      return 0;
    }

    const crackRatio = this.getEliteCrackWindowRatio(battle);
    const recoveryRatio = this.getEnemyRecoveryRatio(enemy);
    const recoveryCarry = clamp((recoveryRatio - 0.08) / 0.32, 0, 1);
    return Math.max(crackRatio, recoveryCarry);
  }

  private getEliteBreachProjectileSuppressionRatio(battle: BattleState): number {
    if (battle.encounterType !== 'battle' || !battle.eliteAlive) {
      return 0;
    }

    const crackRatio = this.getEliteCrackWindowRatio(battle);
    if (crackRatio <= 0.08) {
      return 0;
    }

    const recoveryRatio = clamp(battle.playerRecoverySec / 0.26, 0, 1);
    const impactPenalty = clamp(battle.playerImpactSec / 0.34, 0, 1);
    return clamp(crackRatio * 0.76 + recoveryRatio * 0.24 - impactPenalty * 0.12, 0, 1);
  }

  private getEliteBreachProjectileCorridorRatio(
    battle: BattleState,
    projectile: BattleState['enemyProjectiles'][number],
  ): number {
    const eliteEnemy = this.getEliteEnemy(battle);
    if (!eliteEnemy) {
      return 0;
    }

    const crackRatio = this.getEliteCrackWindowRatio(battle);
    if (crackRatio <= 0.08) {
      return 0;
    }

    const playerDx = battle.playerX - eliteEnemy.x;
    const playerDy = battle.playerY - eliteEnemy.y;
    const playerDistance = Math.max(1, Math.hypot(playerDx, playerDy));
    const dirX = playerDx / playerDistance;
    const dirY = playerDy / playerDistance;
    const orthoX = -dirY;
    const orthoY = dirX;
    const relX = projectile.x - eliteEnemy.x;
    const relY = projectile.y - eliteEnemy.y;
    const projection = relX * dirX + relY * dirY;
    const corridorLength = Math.max(
      eliteEnemy.radius + 20,
      Math.min(playerDistance - 10, eliteEnemy.radius + 92 + crackRatio * 36 + battle.eliteCrackEscortCount * 8),
    );
    if (projection < eliteEnemy.radius - 8 || projection > corridorLength) {
      return 0;
    }

    const lateral = Math.abs(relX * orthoX + relY * orthoY);
    const corridorWidth =
      eliteEnemy.radius + 18 + crackRatio * 24 + battle.eliteCrackEscortCount * 5 + projectile.radius * 1.2;
    if (lateral > corridorWidth) {
      return 0;
    }

    const centerRatio = 1 - lateral / Math.max(1, corridorWidth);
    const depthRatio =
      1 -
      Math.min(
        1,
        Math.abs(projection - corridorLength * 0.54) / Math.max(16, corridorLength * 0.62),
      );
    return clamp(centerRatio * 0.74 + depthRatio * 0.26, 0, 1);
  }

  private dampenEliteBreachProjectile(
    battle: BattleState,
    projectile: BattleState['enemyProjectiles'][number],
    dt: number,
  ): boolean {
    const suppressionRatio = this.getEliteBreachProjectileSuppressionRatio(battle);
    if (suppressionRatio <= 0.08) {
      return false;
    }

    const corridorRatio = this.getEliteBreachProjectileCorridorRatio(battle, projectile);
    if (corridorRatio <= 0.08) {
      return false;
    }

    const slowBlend = clamp(dt * (1.28 + suppressionRatio * 1.46 + corridorRatio * 1.14), 0, 0.38);
    projectile.vx *= 1 - slowBlend;
    projectile.vy *= 1 - slowBlend;
    projectile.radius = Math.max(
      2.4,
      projectile.radius - dt * (2.3 + suppressionRatio * 2.7 + corridorRatio * 2.1),
    );
    projectile.lifeSec -= dt * (0.16 + suppressionRatio * 0.24 + corridorRatio * 0.18);

    const speedAfterDampen = Math.max(1, Math.hypot(projectile.vx, projectile.vy));
    if (corridorRatio > 0.46 && (speedAfterDampen <= 112 || projectile.radius <= 2.9 || projectile.lifeSec <= 0.16)) {
      battle.playerRecoverySec = Math.max(
        battle.playerRecoverySec,
        0.08 + suppressionRatio * 0.08 + corridorRatio * 0.06,
      );
      this.createCombatPulse(battle, {
        x: projectile.x,
        y: projectile.y,
        radius: 10 + projectile.radius * 2 + corridorRatio * 6,
        lifeSec: 0.1,
        color: 0xffefc4,
        secondaryColor: 0xf7ffff,
        fillAlpha: 0.03,
        strokeAlpha: 0.2 + corridorRatio * 0.14,
        strokeWidth: 1.4,
        growthPerSec: 136,
        innerRadiusRatio: 0.76,
        spokeCount: 3,
        spokeLength: 10 + corridorRatio * 4,
        angle: Math.atan2(projectile.vy, projectile.vx),
        spinRate: 5.6,
      });
      return true;
    }

    return false;
  }

  private applyEliteBreachHitFollowThrough(
    battle: BattleState,
    enemy: BattleState['enemies'][number],
    bulletRouteFocus: BattleState['bullets'][number]['routeFocus'],
    critical: boolean,
    recoveryRatio: number,
    critStage: RouteBuildStage,
    pierceStage: RouteBuildStage,
    dashStage: RouteBuildStage,
  ): void {
    const breachRatio = this.getEliteBreachFollowThroughRatio(battle, enemy);
    if (breachRatio <= 0.08) {
      return;
    }

    battle.tempoPulseSec = Math.max(battle.tempoPulseSec, 0.22 + breachRatio * 0.1 + (critical ? 0.03 : 0));
    battle.playerTurnBurstSec = Math.max(battle.playerTurnBurstSec, 0.08 + breachRatio * 0.08);
    battle.playerRecoverySec = Math.max(battle.playerRecoverySec, 0.08 + breachRatio * 0.1 + (critical ? 0.02 : 0));
    battle.playerMoveBoostSec = Math.max(
      battle.playerMoveBoostSec,
      0.08 + breachRatio * 0.08 + (recoveryRatio > 0.18 ? 0.04 : 0),
    );
    battle.playerShotFlashSec = Math.max(battle.playerShotFlashSec, 0.07 + breachRatio * 0.03);
    battle.fireCooldownSec = Math.max(
      0.035,
      battle.fireCooldownSec - (0.004 + breachRatio * 0.008 + (critical ? 0.003 : 0)),
    );

    this.createCombatPulse(battle, {
      x: enemy.x,
      y: enemy.y,
      radius: enemy.radius + 18 + breachRatio * 10,
      lifeSec: 0.11 + breachRatio * 0.04,
      color: 0xffefc8,
      secondaryColor: 0xffffff,
      fillAlpha: 0.03,
      strokeAlpha: 0.28 + breachRatio * 0.14,
      strokeWidth: 1.8,
      growthPerSec: 184,
      innerRadiusRatio: 0.72,
    });

    if (bulletRouteFocus === 'crit' && (critStage === 'committed' || critStage === 'matured')) {
      const hpRatio = enemy.hp / Math.max(1, enemy.maxHp);
      const overdriveFloor =
        (critStage === 'matured' ? 0.72 : 0.56) +
        breachRatio * (critStage === 'matured' ? 0.24 : 0.18) +
        (critical ? 0.08 : 0);
      battle.critOverdriveSec = Math.min(4.2, Math.max(battle.critOverdriveSec, overdriveFloor));
      if (hpRatio <= (critStage === 'matured' ? 0.58 : 0.46) || recoveryRatio > 0.2) {
        battle.fireCooldownSec = Math.max(
          0.035,
          battle.fireCooldownSec - (critStage === 'matured' ? 0.016 : 0.01) - breachRatio * 0.01,
        );
        battle.playerMoveBoostSec = Math.max(
          battle.playerMoveBoostSec,
          0.1 + breachRatio * 0.12 + (critical ? 0.04 : 0),
        );
      }
      this.createCombatPulse(battle, {
        x: enemy.x,
        y: enemy.y,
        radius: enemy.radius + 22 + breachRatio * 8,
        lifeSec: 0.13,
        color: 0xffda7a,
        secondaryColor: 0xfff7da,
        fillAlpha: 0.05,
        strokeAlpha: 0.46 + breachRatio * 0.16,
        strokeWidth: 2,
        growthPerSec: 196,
        innerRadiusRatio: 0.68,
        spokeCount: 5,
        spokeLength: 18 + breachRatio * 8,
        angle: Math.atan2(enemy.y - battle.playerY, enemy.x - battle.playerX),
        spinRate: 6.1,
      });
    }

    if (bulletRouteFocus === 'pierce' && (pierceStage === 'committed' || pierceStage === 'matured')) {
      const laneScore = this.getPierceLaneScore(battle, enemy);
      const behavior = this.getActiveEliteBehavior(battle, BATTLE_TEMPLATES[battle.templateId]);
      const escortLimit = laneScore >= 1.2 || breachRatio > 0.66 ? 2 : 1;
      const escorts = this.getEliteNearbyEscorts(battle, enemy, 218).slice(0, escortLimit);
      const pierceFlowCount = this.registerPierceFlow(battle, {
        laneScore,
        hitCount: 1,
        echoCount: escorts.length,
        eliteCrackRatio: breachRatio,
      });
      escorts.forEach((escort, index) => {
        this.pushEnemyRecovery(
          escort,
          (escort.archetype === 'ranged' ? 0.16 : escort.archetype === 'brute' ? 0.13 : 0.11) +
            breachRatio * 0.12,
        );
        escort.tacticCooldownSec = Math.max(escort.tacticCooldownSec, 0.22 + breachRatio * 0.16 + index * 0.04);
        escort.hitFlashSec = Math.max(escort.hitFlashSec, 0.1 + breachRatio * 0.08);
        escort.spawnFlashSec = Math.max(escort.spawnFlashSec, 0.1);
        if (escort.archetype === 'ranged') {
          escort.rangedCooldownSec = Math.max(escort.rangedCooldownSec, 0.34 + breachRatio * 0.18 + index * 0.06);
        }
        this.displaceEscortOnEliteCrack(battle, enemy, escort, behavior, index);
        this.createCombatPulse(battle, {
          x: (enemy.x + escort.x) * 0.5,
          y: (enemy.y + escort.y) * 0.5,
          radius: 14 + breachRatio * 8,
          lifeSec: 0.1,
          color: 0x96ddff,
          secondaryColor: 0xf6fcff,
          fillAlpha: 0.03,
          strokeAlpha: 0.26 + breachRatio * 0.14,
          strokeWidth: 1.5,
          growthPerSec: 154,
          innerRadiusRatio: 0.74,
          spokeCount: 3,
          spokeLength: 12 + breachRatio * 6,
          angle: Math.atan2(escort.y - enemy.y, escort.x - enemy.x),
          spinRate: 5.8,
        });
      });
      battle.fireCooldownSec = Math.max(
        0.035,
        battle.fireCooldownSec -
          Math.min(0.032, 0.01 + laneScore * 0.004 + breachRatio * 0.008 + escorts.length * 0.004),
      );
      battle.playerMoveBoostSec = Math.max(
        battle.playerMoveBoostSec,
        0.1 + breachRatio * 0.08 + Math.min(0.08, laneScore * 0.018),
      );
      battle.tempoPulseSec = Math.max(
        battle.tempoPulseSec,
        0.22 + breachRatio * 0.08 + Math.min(0.06, laneScore * 0.016) + Math.min(0.04, pierceFlowCount * 0.008),
      );
      this.createCombatPulse(battle, {
        x: enemy.x,
        y: enemy.y,
        radius: enemy.radius + 20 + Math.min(10, laneScore * 3) + escorts.length * 4,
        lifeSec: 0.13,
        color: 0x8fdcff,
        secondaryColor: 0xf4fbff,
        fillAlpha: 0.04,
        strokeAlpha: 0.44 + breachRatio * 0.14,
        strokeWidth: 2,
        growthPerSec: 186,
        innerRadiusRatio: 0.7,
        spokeCount: Math.min(6, 3 + pierceFlowCount),
        spokeLength: 16 + breachRatio * 8 + escorts.length * 3,
        angle: Math.atan2(enemy.y - battle.playerY, enemy.x - battle.playerX),
        spinRate: 5.9,
      });
    }

    if (bulletRouteFocus === 'dash' && (dashStage === 'committed' || dashStage === 'matured')) {
      battle.dashDriveSec = Math.max(
        battle.dashDriveSec,
        (dashStage === 'matured' ? 1.02 : 0.82) + breachRatio * 0.2 + (critical ? 0.08 : 0),
      );
      battle.fireCooldownSec = Math.max(
        0.035,
        battle.fireCooldownSec - (dashStage === 'matured' ? 0.016 : 0.011) - breachRatio * 0.012 - (critical ? 0.004 : 0),
      );
      battle.playerMoveBoostSec = Math.max(
        battle.playerMoveBoostSec,
        0.14 + breachRatio * 0.14 + (critical ? 0.03 : 0),
      );
      battle.playerTurnBurstSec = Math.max(
        battle.playerTurnBurstSec,
        0.12 + breachRatio * 0.1 + (critical ? 0.03 : 0),
      );
      battle.playerRecoverySec = Math.max(
        battle.playerRecoverySec,
        0.1 + breachRatio * 0.12 + (recoveryRatio > 0.16 ? 0.04 : 0),
      );
      battle.tempoPulseSec = Math.max(battle.tempoPulseSec, 0.24 + breachRatio * 0.12 + (critical ? 0.03 : 0));
      this.createCombatPulse(battle, {
        x: enemy.x,
        y: enemy.y,
        radius: enemy.radius + 18 + breachRatio * 12,
        lifeSec: 0.13,
        color: 0x92f7d9,
        secondaryColor: 0xffffff,
        fillAlpha: 0.04,
        strokeAlpha: 0.42 + breachRatio * 0.14,
        strokeWidth: 2,
        growthPerSec: 188,
        innerRadiusRatio: 0.68,
        spokeCount: 4,
        spokeLength: 16 + breachRatio * 10,
        angle: Math.atan2(enemy.y - battle.playerY, enemy.x - battle.playerX),
        spinRate: 6.3,
      });
    }
  }

  private extendEliteCrackWindow(
    battle: BattleState,
    eliteEnemy: BattleState['enemies'][number],
    behavior: EliteBehaviorId,
    crackedEscorts: number,
    laneScore: number,
    critStage: RouteBuildStage,
    pierceStage: RouteBuildStage,
  ): void {
    const focusRoute = this.getLiveCombatFocusRoute(battle);
    const eliteDistance = Math.hypot(eliteEnemy.x - battle.playerX, eliteEnemy.y - battle.playerY);
    let windowSec = crackedEscorts > 0 ? 0.36 : 0.24;
    windowSec += behavior === 'screened' ? 0.08 : behavior === 'summoner' ? 0.05 : behavior === 'frontline' ? 0.04 : 0.03;
    windowSec += Math.min(0.18, crackedEscorts * 0.06);
    if (eliteDistance <= 220) {
      windowSec += 0.06;
    } else if (eliteDistance <= 280) {
      windowSec += 0.03;
    }
    if (focusRoute === 'crit' && (critStage === 'committed' || critStage === 'matured')) {
      windowSec += critStage === 'matured' ? 0.08 : 0.05;
    }
    if (focusRoute === 'pierce' && (pierceStage === 'committed' || pierceStage === 'matured')) {
      windowSec += laneScore >= 1.2 ? 0.08 : 0.04;
    }

    battle.eliteCrackWindowSec = Math.max(battle.eliteCrackWindowSec, Math.min(0.82, windowSec));
    battle.eliteCrackEscortCount = Math.max(battle.eliteCrackEscortCount, crackedEscorts);
    if (crackedEscorts > 0 || windowSec > 0.32) {
      battle.eliteCrackSeen = true;
    }
    battle.playerTurnBurstSec = Math.max(
      battle.playerTurnBurstSec,
      0.08 + Math.min(0.08, crackedEscorts * 0.02 + (focusRoute === 'crit' ? 0.03 : focusRoute === 'pierce' ? 0.02 : 0)),
    );
    battle.playerShotFlashSec = Math.max(
      battle.playerShotFlashSec,
      0.05 + Math.min(0.05, crackedEscorts * 0.01 + (focusRoute === 'crit' ? 0.02 : focusRoute === 'pierce' ? 0.012 : 0)),
    );
  }

  private updateEscortEnemy(enemy: BattleState['enemies'][number], battle: BattleState, dt: number): void {
    const eliteEnemy = this.getEliteEnemy(battle);
    if (!eliteEnemy) {
      // 如果没有精英，降级为标准移动
      this.updateArchetypeEnemyByType(enemy, battle, dt);
      return;
    }

    const dx = battle.playerX - enemy.x;
    const dy = battle.playerY - enemy.y;
    const playerDistance = Math.max(1, Math.hypot(dx, dy));
    const playerDirX = dx / playerDistance;
    const playerDirY = dy / playerDistance;

    const eliteDx = eliteEnemy.x - enemy.x;
    const eliteDy = eliteEnemy.y - enemy.y;
    const eliteDistance = Math.max(1, Math.hypot(eliteDx, eliteDy));
    const eliteDirX = eliteDx / eliteDistance;
    const eliteDirY = eliteDy / eliteDistance;

    // 计算玩家到精英的向量（用于拦截）
    const eliteToPlayerDx = battle.playerX - eliteEnemy.x;
    const eliteToPlayerDy = battle.playerY - eliteEnemy.y;
    const eliteToPlayerDistance = Math.max(1, Math.hypot(eliteToPlayerDx, eliteToPlayerDy));
    const eliteToPlayerDirX = eliteToPlayerDx / eliteToPlayerDistance;
    const eliteToPlayerDirY = eliteToPlayerDy / eliteToPlayerDistance;

    const recoveryRatio = this.getEnemyRecoveryRatio(enemy);
    const weave = Math.sin(battle.elapsedSec * 1.8 + enemy.id * 0.5);
    const strafeX = -playerDirY;
    const strafeY = playerDirX;

    // 护卫的理想位置：在精英和玩家之间
    const guardDistance = enemy.archetype === 'ranged' ? 80 : enemy.archetype === 'brute' ? 50 : 65;
    const guardX = eliteEnemy.x + eliteToPlayerDirX * guardDistance;
    const guardY = eliteEnemy.y + eliteToPlayerDirY * guardDistance;

    // 添加侧向偏移，形成防御弧线
    const orthoX = -eliteToPlayerDirY;
    const orthoY = eliteToPlayerDirX;
    const lateralOffset = (enemy.id % 3 - 1) * 35; // -35, 0, 35
    const targetX = guardX + orthoX * lateralOffset;
    const targetY = guardY + orthoY * lateralOffset;

    const toTargetDx = targetX - enemy.x;
    const toTargetDy = targetY - enemy.y;
    const toTargetDistance = Math.max(1, Math.hypot(toTargetDx, toTargetDy));
    const toTargetDirX = toTargetDx / toTargetDistance;
    const toTargetDirY = toTargetDy / toTargetDistance;

    let moveX = 0;
    let moveY = 0;

    // 1. 阵型保持力：向理想位置移动
    const formationWeight = toTargetDistance > 40 ? 0.85 : toTargetDistance > 20 ? 0.6 : 0.35;
    moveX += toTargetDirX * formationWeight;
    moveY += toTargetDirY * formationWeight;

    // 2. 与精英保持距离（不要离太远）
    if (eliteDistance > 140) {
      moveX += eliteDirX * 0.4;
      moveY += eliteDirY * 0.4;
    } else if (eliteDistance < 40) {
      // 太近了，稍微远离
      moveX -= eliteDirX * 0.2;
      moveY -= eliteDirY * 0.2;
    }

    // 3. 根据原型调整行为
    if (enemy.archetype === 'ranged') {
      // 远程护卫：保持距离，优先射击
      if (playerDistance < 100) {
        moveX -= playerDirX * 0.3;
        moveY -= playerDirY * 0.3;
      }
      moveX += strafeX * weave * 0.12;
      moveY += strafeY * weave * 0.12;
    } else if (enemy.archetype === 'brute') {
      // 重型护卫：更激进地拦截
      if (playerDistance < 120 && eliteToPlayerDistance < 150) {
        moveX += playerDirX * 0.25;
        moveY += playerDirY * 0.25;
      }
    } else if (enemy.archetype === 'skirmisher') {
      // 游击护卫：快速机动
      moveX += strafeX * weave * 0.18;
      moveY += strafeY * weave * 0.18;
      if (playerDistance < 90) {
        moveX += playerDirX * 0.2;
        moveY += playerDirY * 0.2;
      }
    } else {
      // 标准护卫：平衡
      if (playerDistance < 110) {
        moveX += playerDirX * 0.15;
        moveY += playerDirY * 0.15;
      }
      moveX += strafeX * weave * 0.08;
      moveY += strafeY * weave * 0.08;
    }

    // 4. 受伤后撤
    if (recoveryRatio > 0) {
      const retreatSign = enemy.id % 2 === 0 ? -1 : 1;
      moveX += strafeX * retreatSign * (0.2 + recoveryRatio * 0.35);
      moveY += strafeY * retreatSign * (0.2 + recoveryRatio * 0.35);
      moveX -= playerDirX * (0.12 + recoveryRatio * 0.25);
      moveY -= playerDirY * (0.12 + recoveryRatio * 0.25);
    }

    // 5. 压力脉冲期：协同进攻
    if (enemy.pressurePulseSec > 0) {
      const pressureRatio = Math.min(1, enemy.pressurePulseSec / this.getEnemyPressureWindowSec(enemy));
      moveX += playerDirX * (0.2 + pressureRatio * 0.4);
      moveY += playerDirY * (0.2 + pressureRatio * 0.4);
    }

    const moveMagnitude = Math.max(0.01, Math.hypot(moveX, moveY));
    const normalizedMoveX = moveX / moveMagnitude;
    const normalizedMoveY = moveY / moveMagnitude;
    const moveSpeed = enemy.speed * dt;
    enemy.x += normalizedMoveX * moveSpeed;
    enemy.y += normalizedMoveY * moveSpeed;
  }

  private updateArchetypeEnemyByType(enemy: BattleState['enemies'][number], battle: BattleState, dt: number): void {
    switch (enemy.archetype) {
      case 'standard':
        this.updateStandardEnemy(enemy, battle, dt);
        return;
      case 'brute':
        this.updateBruteEnemy(enemy, battle, dt);
        return;
      case 'skirmisher':
        this.updateSkirmisherEnemy(enemy, battle, dt);
        return;
      case 'ranged':
        this.updateRangedEnemy(enemy, battle, dt);
        return;
      default:
        this.updateStandardEnemy(enemy, battle, dt);
        return;
    }
  }

  private stabilizeEliteCrackEscort(
    battle: BattleState,
    escort: BattleState['enemies'][number],
  ): void {
    const crackRatio = this.getEliteCrackWindowRatio(battle);
    if (crackRatio <= 0.08 || escort.elite || escort.role !== 'escort') {
      return;
    }

    const eliteEnemy = this.getEliteEnemy(battle);
    if (!eliteEnemy) {
      return;
    }

    const eliteDistance = Math.hypot(escort.x - eliteEnemy.x, escort.y - eliteEnemy.y);
    if (eliteDistance > 232) {
      return;
    }

    const sustainRecovery =
      escort.archetype === 'ranged'
        ? 0.1 + crackRatio * 0.22
        : escort.archetype === 'brute'
          ? 0.08 + crackRatio * 0.16
          : 0.08 + crackRatio * 0.14;
    escort.recoverySec = Math.max(escort.recoverySec, sustainRecovery);
    escort.tacticCooldownSec = Math.max(escort.tacticCooldownSec, 0.16 + crackRatio * 0.22);
    escort.hitFlashSec = Math.max(escort.hitFlashSec, 0.08 + crackRatio * 0.08);
    if (escort.archetype === 'ranged') {
      escort.rangedCooldownSec = Math.max(escort.rangedCooldownSec, 0.32 + crackRatio * 0.26);
    }

    const playerDx = battle.playerX - eliteEnemy.x;
    const playerDy = battle.playerY - eliteEnemy.y;
    const playerDistance = Math.max(1, Math.hypot(playerDx, playerDy));
    const orthoX = -(playerDy / playerDistance);
    const orthoY = playerDx / playerDistance;
    const escortDx = escort.x - eliteEnemy.x;
    const escortDy = escort.y - eliteEnemy.y;
    const lateral = escortDx * orthoX + escortDy * orthoY;
    const peelSign = Math.abs(lateral) > 4 ? Math.sign(lateral) : escort.id % 2 === 0 ? -1 : 1;
    escort.hitOffsetX = clamp(escort.hitOffsetX + orthoX * peelSign * (1.8 + crackRatio * 4.4), -16, 16);
    escort.hitOffsetY = clamp(escort.hitOffsetY + orthoY * peelSign * (1.8 + crackRatio * 4.4), -16, 16);
  }

  private syncEscortPressureFromElite(
    battle: BattleState,
    eliteEnemy: BattleState['enemies'][number],
    behavior: EliteBehaviorId,
  ): {
    syncedCount: number;
    rangedCount: number;
  } {
    const syncDistance = behavior === 'summoner' ? 224 : behavior === 'screened' ? 196 : 184;
    const escorts = this.getEliteNearbyEscorts(battle, eliteEnemy, syncDistance);
    let syncedCount = 0;
    let rangedCount = 0;

    escorts.forEach((escort, index) => {
      const escortDistance = Math.max(1, Math.hypot(escort.x - eliteEnemy.x, escort.y - eliteEnemy.y));
      const proximityRatio = 1 - escortDistance / syncDistance;
      const basePulseSec =
        escort.archetype === 'brute'
          ? 0.22
          : escort.archetype === 'ranged'
            ? 0.24
            : escort.archetype === 'skirmisher'
              ? 0.18
              : 0.2;
      const pulseSec = basePulseSec + proximityRatio * 0.08;
      const cooldownSec =
        escort.archetype === 'ranged'
          ? 1.44
          : escort.archetype === 'brute'
            ? 1.28
            : escort.archetype === 'skirmisher'
              ? 1.16
              : 1.22;
      if (this.triggerEnemyPressurePulse(escort, pulseSec, cooldownSec + index * 0.06)) {
        syncedCount += 1;
      }
      if (escort.archetype === 'ranged') {
        rangedCount += 1;
        const rangedLead =
          behavior === 'screened' ? 0.24 : behavior === 'summoner' ? 0.3 : behavior === 'kiting' ? 0.34 : 0.4;
        escort.rangedCooldownSec =
          escort.rangedCooldownSec <= 0
            ? rangedLead + index * 0.08
            : Math.min(escort.rangedCooldownSec, rangedLead + index * 0.08);
      }
      this.createCombatPulse(battle, {
        x: escort.x,
        y: escort.y,
        radius: escort.radius + 8 + proximityRatio * 4,
        lifeSec: 0.12,
        color: 0xffd7a1,
        secondaryColor: 0xfffbeb,
        fillAlpha: 0.03,
        strokeAlpha: 0.3 + proximityRatio * 0.12,
        strokeWidth: 1.5,
        growthPerSec: 116,
        innerRadiusRatio: 0.74,
      });
    });

    return {
      syncedCount,
      rangedCount,
    };
  }

  private crackEliteEscortScreen(
    battle: BattleState,
    eliteEnemy: BattleState['enemies'][number],
    behavior: EliteBehaviorId,
  ): number {
    const crackDistance = behavior === 'screened' ? 208 : 188;
    const escorts = this.getEliteNearbyEscorts(battle, eliteEnemy, crackDistance);
    let crackedCount = 0;

    escorts.forEach((escort, index) => {
      const recoverySec =
        escort.archetype === 'brute'
          ? 0.34
          : escort.archetype === 'ranged'
            ? 0.46
            : escort.archetype === 'skirmisher'
              ? 0.28
              : 0.32;
      this.pushEnemyRecovery(
        escort,
        recoverySec + (behavior === 'screened' ? 0.12 : behavior === 'summoner' ? 0.08 : 0.04),
      );
      escort.tacticCooldownSec = Math.max(escort.tacticCooldownSec, 0.5 + index * 0.05);
      escort.pressurePulseSec = Math.min(escort.pressurePulseSec, 0.08);
      escort.hitFlashSec = Math.max(escort.hitFlashSec, 0.16);
      escort.spawnFlashSec = Math.max(escort.spawnFlashSec, 0.14);
      if (escort.archetype === 'ranged') {
        escort.rangedCooldownSec = Math.max(escort.rangedCooldownSec, 0.58 + index * 0.08);
      }
      this.displaceEscortOnEliteCrack(battle, eliteEnemy, escort, behavior, index);
      this.createCombatPulse(battle, {
        x: escort.x,
        y: escort.y,
        radius: escort.radius + 10,
        lifeSec: 0.14,
        color: 0xfff0c1,
        secondaryColor: 0xf9ffff,
        fillAlpha: 0.03,
        strokeAlpha: 0.34,
        strokeWidth: 1.8,
        growthPerSec: 142,
        innerRadiusRatio: 0.76,
      });
      crackedCount += 1;
    });

    return crackedCount;
  }

  private displaceEscortOnEliteCrack(
    battle: BattleState,
    eliteEnemy: BattleState['enemies'][number],
    escort: BattleState['enemies'][number],
    behavior: EliteBehaviorId,
    index: number,
  ): void {
    const playerDx = battle.playerX - eliteEnemy.x;
    const playerDy = battle.playerY - eliteEnemy.y;
    const playerDistance = Math.max(1, Math.hypot(playerDx, playerDy));
    const playerDirX = playerDx / playerDistance;
    const playerDirY = playerDy / playerDistance;
    const orthoX = -playerDirY;
    const orthoY = playerDirX;
    const escortDx = escort.x - eliteEnemy.x;
    const escortDy = escort.y - eliteEnemy.y;
    const lateral = escortDx * orthoX + escortDy * orthoY;
    const forward = escortDx * playerDirX + escortDy * playerDirY;
    const peelSign = Math.abs(lateral) > 6 ? Math.sign(lateral) : index % 2 === 0 ? -1 : 1;
    const sidePush =
      (behavior === 'screened' ? 30 : behavior === 'summoner' ? 24 : 20) + Math.min(16, index * 5);
    const backPush =
      (behavior === 'screened' ? 18 : behavior === 'summoner' ? 22 : 16) + Math.max(0, 24 - forward * 0.12);
    const shoveX = orthoX * peelSign * sidePush - playerDirX * backPush;
    const shoveY = orthoY * peelSign * sidePush - playerDirY * backPush;

    escort.x = clamp(escort.x + shoveX, -42, ARENA_WIDTH + 42);
    escort.y = clamp(escort.y + shoveY, -42, ARENA_HEIGHT + 42);
    escort.hitOffsetX = shoveX * 0.34;
    escort.hitOffsetY = shoveY * 0.34;
  }

  private getElitePressureCycle(behavior: EliteBehaviorId): {
    pulseSec: number;
    cooldownSec: number;
    recoverySec: number;
  } {
    switch (behavior) {
      case 'kiting':
        return { pulseSec: 0.56, cooldownSec: 3.1, recoverySec: 0.24 };
      case 'screened':
        return { pulseSec: 0.62, cooldownSec: 3.25, recoverySec: 0.28 };
      case 'summoner':
        return { pulseSec: 0.7, cooldownSec: 2.9, recoverySec: 0.22 };
      case 'frontline':
      default:
        return { pulseSec: 0.66, cooldownSec: 2.75, recoverySec: 0.3 };
    }
  }

  private startElitePressurePulse(
    enemy: BattleState['enemies'][number],
    battle: BattleState,
    template: (typeof BATTLE_TEMPLATES)[keyof typeof BATTLE_TEMPLATES],
    behavior: EliteBehaviorId,
  ): void {
    const cycle = this.getElitePressureCycle(behavior);
    if (!this.triggerEnemyPressurePulse(enemy, cycle.pulseSec, cycle.cooldownSec)) {
      return;
    }

    const escortCount = this.getActiveEscortCount(battle);
    if (behavior === 'kiting') {
      this.firePressureVolley(battle, 1, {
        spreadRad: 0.18,
        shotsPerShooter: 2,
      });
    } else if (behavior === 'screened') {
      if (escortCount <= 1) {
        this.spawnPhaseEscortBurst(battle, 1);
      }
    } else if (behavior === 'summoner') {
      this.spawnPhaseEscortBurst(battle, escortCount === 0 ? 2 : 1);
    } else if (behavior === 'frontline' && escortCount === 0 && (template.eliteRule?.escortBatch ?? 0) > 0) {
      this.spawnPhaseEscortBurst(battle, 1);
    }
    const syncedEscortState = this.syncEscortPressureFromElite(battle, enemy, behavior);

    this.createCombatPulse(battle, {
      x: enemy.x,
      y: enemy.y,
      radius: enemy.radius + 16,
      lifeSec: 0.16,
      color: 0xffc47b,
      secondaryColor: 0xfff6d4,
      fillAlpha: 0.06,
      strokeAlpha: 0.62,
      strokeWidth: 3,
      growthPerSec: 168,
      innerRadiusRatio: 0.68,
    });
    if (syncedEscortState.syncedCount > 0) {
      this.createCombatPulse(battle, {
        x: enemy.x,
        y: enemy.y,
        radius: enemy.radius + 28 + Math.min(12, syncedEscortState.syncedCount * 4),
        lifeSec: 0.12,
        color: 0xffdfae,
        secondaryColor: 0xfff8e2,
        fillAlpha: 0.03,
        strokeAlpha: 0.34,
        strokeWidth: 2,
        growthPerSec: 156,
        innerRadiusRatio: 0.76,
      });
    }
    battle.tempoPulseSec = Math.max(battle.tempoPulseSec, syncedEscortState.syncedCount > 0 ? 0.22 : 0.18);
    this.enqueueAudio('pressure');
  }

  private resolveElitePressurePulse(
    enemy: BattleState['enemies'][number],
    battle: BattleState,
    template: (typeof BATTLE_TEMPLATES)[keyof typeof BATTLE_TEMPLATES],
  ): void {
    const behavior = this.getActiveEliteBehavior(battle, template);
    const cycle = this.getElitePressureCycle(behavior);
    const pierceStage = this.getRouteBuildStage('pierce');
    const critStage = this.getRouteBuildStage('crit');
    const dashStage = this.getRouteBuildStage('dash');
    const crackedEscorts = this.crackEliteEscortScreen(battle, enemy, behavior);
    const laneScore = pierceStage !== 'unformed' ? this.getPierceLaneScore(battle, enemy) : 0;

    this.extendEliteCrackWindow(battle, enemy, behavior, crackedEscorts, laneScore, critStage, pierceStage);

    this.pushEnemyRecovery(enemy, cycle.recoverySec);
    this.createCombatPulse(battle, {
      x: enemy.x,
      y: enemy.y,
      radius: enemy.radius + 22,
      lifeSec: 0.18,
      color: 0xffefb8,
      secondaryColor: 0xffffff,
      fillAlpha: 0.05,
      strokeAlpha: 0.54,
      strokeWidth: 2.5,
      growthPerSec: 154,
      innerRadiusRatio: 0.72,
    });
    const crackFollowThrough = crackedEscorts > 0 ? Math.min(0.18, crackedEscorts * 0.05) : 0;
    battle.fireCooldownSec = Math.max(0.035, battle.fireCooldownSec - (0.01 + crackFollowThrough * 0.5));
    battle.playerMoveBoostSec = Math.max(
      battle.playerMoveBoostSec,
      crackedEscorts > 0 ? 0.16 + crackFollowThrough : 0.12,
    );
    battle.tempoPulseSec = Math.max(
      battle.tempoPulseSec,
      crackedEscorts > 0 ? 0.26 + crackFollowThrough : 0.22,
    );
    battle.eliteSupportCooldownSec = Math.max(
      battle.eliteSupportCooldownSec,
      crackedEscorts > 0 ? 1.08 + crackedEscorts * 0.2 : 0.72,
    );

    if (critStage === 'committed' || critStage === 'matured') {
      const crackCarry = crackedEscorts > 0 ? Math.min(0.28, crackedEscorts * (critStage === 'matured' ? 0.09 : 0.06)) : 0;
      battle.critOverdriveSec = Math.min(
        4.2,
        Math.max(
          battle.critOverdriveSec,
          critStage === 'matured' ? 0.7 : 0.48,
        ) + crackCarry,
      );
      const critRefund = (critStage === 'matured' ? 0.032 : 0.018) + Math.min(0.018, crackedEscorts * 0.006);
      battle.fireCooldownSec = Math.max(0.035, battle.fireCooldownSec - critRefund);
      battle.tempoPulseSec = Math.max(battle.tempoPulseSec, crackedEscorts > 0 ? 0.24 : 0.2);
      battle.playerTurnBurstSec = Math.max(
        battle.playerTurnBurstSec,
        crackedEscorts > 0 ? 0.12 + Math.min(0.06, crackedEscorts * 0.02) : 0.08,
      );
    }

    if ((pierceStage === 'committed' || pierceStage === 'matured') && (laneScore >= 1.2 || crackedEscorts >= 2)) {
      const crackLaneBonus = crackedEscorts > 0 ? Math.min(0.024, crackedEscorts * 0.008) : 0;
      battle.fireCooldownSec = Math.max(
        0.035,
        battle.fireCooldownSec - Math.min(0.044, 0.016 + laneScore * 0.006 + crackLaneBonus),
      );
      battle.tempoPulseSec = Math.max(battle.tempoPulseSec, crackedEscorts > 0 ? 0.26 : 0.22);
      battle.playerMoveBoostSec = Math.max(
        battle.playerMoveBoostSec,
        crackedEscorts > 0 ? 0.18 + Math.min(0.08, laneScore * 0.02) : 0.14,
      );
      this.createCombatPulse(battle, {
        x: enemy.x,
        y: enemy.y,
        radius: enemy.radius + 18 + Math.min(12, laneScore * 3) + Math.min(8, crackedEscorts * 2),
        lifeSec: 0.14,
        color: 0x8fdcff,
        secondaryColor: 0xf5fbff,
        fillAlpha: 0.04,
        strokeAlpha: 0.52,
        strokeWidth: 2,
        growthPerSec: 180,
        innerRadiusRatio: 0.7,
      });
    }

    if (dashStage === 'committed' || dashStage === 'matured') {
      battle.dashDriveSec = Math.max(
        battle.dashDriveSec,
        (dashStage === 'matured' ? 0.86 : 0.62) + Math.min(0.12, crackedEscorts * 0.04),
      );
      battle.dashCharge = Math.min(6, battle.dashCharge + 1 + (crackedEscorts >= 2 ? 1 : 0));
    }

    if (crackedEscorts > 0) {
      battle.eliteBreachFlashSec = Math.max(
        battle.eliteBreachFlashSec,
        0.3 + Math.min(0.2, crackedEscorts * 0.08),
      );
      if (battle.eliteBreachCalloutCooldownSec <= 0) {
        const focusRoute = this.getLiveCombatFocusRoute(battle);
        const breachTip =
          focusRoute === 'pierce'
            ? '裂口出现，穿过火线'
            : focusRoute === 'crit'
              ? '精英裂口打开，贴近反打'
              : focusRoute === 'dash'
                ? '安全窗打开，追回一拍'
                : '精英裂口打开，追击本体';
        this.enqueueTip(breachTip);
        battle.eliteBreachCalloutCooldownSec = 1.4;
      }
      this.createCombatPulse(battle, {
        x: enemy.x,
        y: enemy.y,
        radius: enemy.radius + 30 + Math.min(12, crackedEscorts * 4),
        lifeSec: 0.12,
        color: 0xfff1c6,
        secondaryColor: 0xffffff,
        fillAlpha: 0.03,
        strokeAlpha: 0.32,
        strokeWidth: 2,
        growthPerSec: 168,
        innerRadiusRatio: 0.78,
      });
    }
  }

  private getRegularEnemyHp(
    template: (typeof BATTLE_TEMPLATES)[keyof typeof BATTLE_TEMPLATES],
    round: number,
    phase: RunState['phase'],
    difficultyScale: number,
    eliteMultiplier = 1,
  ): number {
    return getEnemyHealth(template, round, phase, difficultyScale, eliteMultiplier);
  }

  private getRegularEnemySpeed(
    template: (typeof BATTLE_TEMPLATES)[keyof typeof BATTLE_TEMPLATES],
    round: number,
    phase: RunState['phase'],
    difficultyScale: number,
    speedMultiplier = 1,
  ): number {
    return getEnemyMoveSpeed(template, round, phase, difficultyScale, speedMultiplier);
  }

  private getEnemySpawnInterval(
    battle: BattleState,
    template: (typeof BATTLE_TEMPLATES)[keyof typeof BATTLE_TEMPLATES],
    elapsedSec: number,
  ): number {
    const pressureMultiplier = this.getActivePressurePhase(battle)?.spawnIntervalMultiplier ?? 1;
    return Math.max(
      0.18,
      getEnemySpawnInterval(template, this.getCurrentBattleIndex(), this.state.phase, elapsedSec) * pressureMultiplier,
    );
  }

  private getRegularEnemyCap(battle: BattleState): number | null {
    const template = BATTLE_TEMPLATES[battle.templateId];
    const eliteCapMultiplier =
      template.eliteRule && battle.eliteAlive ? (template.eliteRule.regularEnemyCap ?? template.regularEnemyCap) / template.regularEnemyCap : 1;
    return Math.max(
      1,
      getRegularEnemyCap(template, this.getCurrentBattleIndex(), this.state.phase, eliteCapMultiplier) +
        (this.getActivePressurePhase(battle)?.regularEnemyCapBonus ?? 0),
    );
  }

  private getEnemyExperienceValue(battle: BattleState, isElite: boolean): number {
    const template = BATTLE_TEMPLATES[battle.templateId];
    return getEnemyExperienceValue(template, this.getCurrentBattleIndex(), this.state.phase, isElite);
  }

  private getPhaseTier(phase: RunState['phase']): number {
    return getPhaseTier(phase);
  }

  private getPlayerMoveSpeed(): number {
    return getPlayerMoveSpeed(this.state.stats);
  }

  private getProjectileSpeed(): number {
    return getProjectileSpeed(this.state.stats);
  }

  private getPickupRadius(): number {
    return getPickupRadius(this.state.stats);
  }

  private getMagnetRadius(): number {
    return getMagnetRadius(this.state.stats);
  }

  private getDashGrazeOuterRadius(buildStage: RouteBuildStage): number {
    return getDashGrazeOuterRadius(this.state.stats, buildStage);
  }

  private getDashGrazeInnerRadius(): number {
    return getDashGrazeInnerRadius();
  }

  private getDashPulseRadius(dashCharge: number, buildStage: RouteBuildStage): number {
    return getDashPulseRadius(this.state.stats, dashCharge, buildStage);
  }

  private getDashPulseDamage(dashCharge: number, buildStage: RouteBuildStage): number {
    return getDashPulseDamage(this.state.stats, dashCharge, buildStage);
  }

  private getDashPulseHeal(dashCharge: number, buildStage: RouteBuildStage): number {
    return getDashPulseHeal(dashCharge, buildStage);
  }

  private getDashDriveDuration(dashCharge: number): number {
    return getDashDriveDuration(dashCharge, this.state.routeCounts.dash);
  }

  private getDashCooldownAfterPulse(buildStage: RouteBuildStage): number {
    return getDashCooldownAfterPulse(this.state.stats, buildStage);
  }

  private getDashDamageMultiplier(buildStage: RouteBuildStage, dashDriveSec: number): number {
    return getDashDamageMultiplier(buildStage, dashDriveSec);
  }

  private getEffectiveFireRate(battle: BattleState): number {
    return getEffectiveFireRate(this.state.stats, battle, this.state.routeCounts.crit, this.state.routeCounts.dash);
  }

  private getEffectiveCritChance(battle: BattleState): number {
    return getEffectiveCritChance(this.state.stats, this.getRouteBuildStage('crit'), battle.critOverdriveSec);
  }

  private getCritOverdriveDurationGain(): number {
    return getCritOverdriveDurationGain(this.getRouteBuildStage('crit'));
  }

  private getCritSplashRatio(battle: BattleState): number {
    return getCritSplashRatio(this.getRouteBuildStage('crit'), battle.critOverdriveSec);
  }

  private getPierceEchoCount(): number {
    return getPierceEchoCount(this.state.stats.multishot, this.getRouteBuildStage('pierce'));
  }

  private getPierceEchoDamageRatio(): number {
    return getPierceEchoDamageRatio(this.getRouteBuildStage('pierce'));
  }

  private getPierceCooldownRefund(): number {
    return getPierceCooldownRefund(this.getRouteBuildStage('pierce'));
  }
}
