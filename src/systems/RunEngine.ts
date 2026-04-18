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
  ContentEffect,
  ContentTier,
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
      eventHistory: [],
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
    this.applyEffects(upgrade.effects, {
      pickId: `upgrade:${upgrade.sourceId}`,
    });
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
    if (this.state.status !== 'battle' || !this.state.battle) {
      return;
    }

    const battle = this.state.battle;
    const dt = deltaMs / 1000;
    battle.elapsedSec += dt;
    battle.impactFreezeSec = Math.max(0, battle.impactFreezeSec - dt);
    if (battle.impactFreezeSec <= 0) {
      battle.impactFreezeFactor = 1;
    }
    const simulationDt = dt * (battle.impactFreezeSec > 0 ? battle.impactFreezeFactor : 1);
    battle.remainingSec = Math.max(0, battle.remainingSec - simulationDt);
    battle.critOverdriveSec = Math.max(0, battle.critOverdriveSec - simulationDt);
    battle.dashDriveSec = Math.max(0, battle.dashDriveSec - simulationDt);
    battle.eliteCrackWindowSec = Math.max(0, battle.eliteCrackWindowSec - simulationDt);
    battle.invulnerableSec = Math.max(0, battle.invulnerableSec - simulationDt);
    battle.playerImpactSec = Math.max(0, battle.playerImpactSec - dt);
    battle.playerRecoverySec = Math.max(0, battle.playerRecoverySec - dt);
    battle.killFlowSec = Math.max(0, battle.killFlowSec - dt);
    battle.playerDamageFlashSec = Math.max(0, battle.playerDamageFlashSec - dt);
    battle.cameraShakeSec = Math.max(0, battle.cameraShakeSec - dt);
    battle.tempoPulseSec = Math.max(0, battle.tempoPulseSec - dt);
    battle.playerShotFlashSec = Math.max(0, battle.playerShotFlashSec - dt);
    battle.playerShotRecoilSec = Math.max(0, battle.playerShotRecoilSec - dt);
    battle.playerMoveBoostSec = Math.max(0, battle.playerMoveBoostSec - dt);
    battle.playerTurnBurstSec = Math.max(0, battle.playerTurnBurstSec - dt);
    battle.playerNearMissSec = Math.max(0, battle.playerNearMissSec - dt);
    battle.playerNearMissCooldownSec = Math.max(0, battle.playerNearMissCooldownSec - dt);
    if (battle.eliteCrackWindowSec <= 0) {
      battle.eliteCrackEscortCount = 0;
    }
    if (battle.killFlowSec <= 0) {
      battle.killFlowCount = 0;
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
    this.updatePlayerMovement(battle, simulationDt);
    this.spawnEnemies(battle, simulationDt);
    this.updateShooting(battle, simulationDt);
    this.updateBullets(battle, simulationDt);
    this.updateEnemies(battle, simulationDt);
    this.updateEnemyProjectiles(battle, simulationDt);
    this.updatePulses(battle, dt);
    this.updateExperienceOrbs(battle, simulationDt);

    if (this.state.stats.regeneration > 0) {
      this.state.stats.hp = clamp(
        this.state.stats.hp + this.state.stats.regeneration * simulationDt,
        0,
        this.state.stats.maxHp,
      );
    }

    if (this.state.stats.hp <= 0) {
      this.finalizeBossPressureMetrics(battle);
      this.services.metrics.recordBattleCompleted(battle.templateId, 'loss', BATTLE_TEMPLATES[battle.templateId].contentTier);
      this.finishRun('defeat', 'hpDepleted');
      return;
    }

    if (isBattleVictory(battle)) {
      this.completeBattle();
      return;
    }

    if (battle.remainingSec <= 0) {
      this.finalizeBossPressureMetrics(battle);
      this.services.metrics.recordBattleCompleted(battle.templateId, 'loss', BATTLE_TEMPLATES[battle.templateId].contentTier);
      this.finishRun('defeat', 'timeOut');
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
        return `${label} ${Math.ceil(battle.remainingSec)}s`;
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
      playerDamageFlashSec: 0,
      playerDamageAngle: -Math.PI / 2,
      cameraShakeSec: 0,
      cameraShakeStrength: 0,
      tempoPulseSec: 0,
      playerShotFlashSec: 0,
      playerShotRecoilSec: 0,
      playerShotRecoilStrength: 0,
      playerMoveBoostSec: 0,
      playerTurnBurstSec: 0,
      playerNearMissSec: 0,
      playerNearMissAngle: -Math.PI / 2,
      playerNearMissCooldownSec: 0,
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

  private openPressureSafeWindow(
    battle: BattleState,
    phase: BattlePressurePhaseDefinition,
    axis: PressureSafeWindowAxis,
  ): void {
    const view = this.getBattleViewportBounds(battle);

    if (axis === 'pocket') {
      const shiftType = this.getPressurePocketShiftType(battle, phase);
      const shiftProfile = this.getPressurePocketShiftProfile(shiftType);
      const baseSafeWindowSpan = clamp(phase.patternSafeWindowSize ?? 184, 152, view.width * 0.42);
      const baseSafeWindowSecondarySpan = clamp(
        phase.patternSafeWindowSecondarySize ?? baseSafeWindowSpan * 0.68,
        108,
        view.height * 0.4,
      );
      const safeWindowSpan = clamp(baseSafeWindowSpan * shiftProfile.widthScale, 144, view.width * 0.44);
      const safeWindowSecondarySpan = clamp(
        baseSafeWindowSecondarySpan * shiftProfile.heightScale,
        104,
        view.height * 0.42,
      );
      const safeWindowCenter = this.choosePressureSafePocketCenter(battle, safeWindowSpan, safeWindowSecondarySpan, shiftType);
      const safeWindowSec = clamp((phase.patternSafeWindowLingerSec ?? 1.08) * shiftProfile.lingerScale, 0.72, 1.72);

      battle.pressureSafeWindowAxis = axis;
      battle.pressureSafeWindowShiftType = shiftType;
      battle.pressureSafeWindowCenter = safeWindowCenter.x;
      battle.pressureSafeWindowSpan = safeWindowSpan;
      battle.pressureSafeWindowSecondaryCenter = safeWindowCenter.y;
      battle.pressureSafeWindowSecondarySpan = safeWindowSecondarySpan;
      battle.pressureSafeWindowSec = safeWindowSec;

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
    const minimumSpan = axis === 'vertical' ? 164 : 132;
    const maximumSpan = dimension * 0.48;
    const safeWindowSpan = clamp(
      phase.patternSafeWindowSize ?? (axis === 'vertical' ? 212 : 156),
      minimumSpan,
      maximumSpan,
    );
    const safeWindowCenter = this.choosePressureSafeWindowCenter(battle, axis, safeWindowSpan);
    const safeWindowSec = clamp(
      phase.patternSafeWindowLingerSec ?? (axis === 'vertical' ? 1.28 : 1.18),
      0.82,
      1.9,
    );

    battle.pressureSafeWindowAxis = axis;
    battle.pressureSafeWindowShiftType = undefined;
    battle.pressureSafeWindowCenter = safeWindowCenter;
    battle.pressureSafeWindowSpan = safeWindowSpan;
    battle.pressureSafeWindowSecondaryCenter =
      axis === 'vertical' ? view.top + view.height * 0.5 : view.left + view.width * 0.5;
    battle.pressureSafeWindowSecondarySpan = 0;
    battle.pressureSafeWindowSec = safeWindowSec;

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
    const playerBlend = shiftProfile.playerBlend;
    const blendedX = anchorX * (1 - playerBlend) + battle.playerX * playerBlend;
    const blendedY = anchorY * (1 - playerBlend) + battle.playerY * playerBlend;
    return {
      x: clamp(blendedX, view.left + 84 + spanX * 0.5, view.right - 84 - spanX * 0.5),
      y: clamp(blendedY, view.top + 74 + spanY * 0.5, view.bottom - 74 - spanY * 0.5),
    };
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

    for (let index = 0; index < shotSlots; index += 1) {
      const ratio = shotSlots === 1 ? 0.5 : index / (shotSlots - 1);
      const position = margin + ratio * (dimension - margin * 2);
      if (position > safeStart - 18 && position < safeEnd + 18) {
        continue;
      }
      slotPositions.push(position);
    }

    if (slotPositions.length === 0) {
      slotPositions.push(
        clamp(safeStart - 36, margin, dimension - margin),
        clamp(safeEnd + 36, margin, dimension - margin),
      );
    }

    return slotPositions;
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
        this.spawnEnemyProjectile(battle, position, view.top - 22, projectileSpeed, projectileDamage, 6, Math.PI / 2);
        this.spawnEnemyProjectile(
          battle,
          position,
          view.bottom + 22,
          projectileSpeed,
          projectileDamage,
          6,
          -Math.PI / 2,
        );
        continue;
      }

      this.spawnEnemyProjectile(battle, view.left - 22, position, projectileSpeed, projectileDamage, 6, 0);
      this.spawnEnemyProjectile(battle, view.right + 22, position, projectileSpeed, projectileDamage, 6, Math.PI);
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
      this.spawnEnemyProjectile(battle, x, view.top - 24, projectileSpeed, projectileDamage, 6, Math.PI / 2);
      this.spawnEnemyProjectile(
        battle,
        x,
        view.bottom + 24,
        projectileSpeed,
        projectileDamage,
        6,
        -Math.PI / 2,
      );
    }

    for (const y of ySlots) {
      this.spawnEnemyProjectile(battle, view.left - 24, y, projectileSpeed, projectileDamage, 6, 0);
      this.spawnEnemyProjectile(battle, view.right + 24, y, projectileSpeed, projectileDamage, 6, Math.PI);
    }
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
    this.services.metrics.recordBattleCompleted(battle.templateId, 'win', BATTLE_TEMPLATES[battle.templateId].contentTier);
    const completionExp = getBattleCompletionExperience(
      BATTLE_TEMPLATES[battle.templateId],
      this.getCurrentBattleIndex(),
      this.state.phase,
    );
    this.enqueueTip(`${battle.label || BATTLE_TEMPLATES[battle.templateId].name}完成`);
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

    const hasInput = Math.abs(moveX) > 0 || Math.abs(moveY) > 0;
    const magnitude = hasInput ? Math.hypot(moveX, moveY) : 1;
    const normalizedX = hasInput ? moveX / magnitude : 0;
    const normalizedY = hasInput ? moveY / magnitude : 0;
    const moveSpeed = this.getPlayerMoveSpeed();
    const tempoMoveMultiplier = 1 + Math.min(0.12, battle.tempoPulseSec * 0.28);
    const controlFactor = battle.playerImpactSec > 0 ? 0.52 : 1;
    const currentVelocitySpeed = Math.hypot(battle.playerVelocityX, battle.playerVelocityY);
    const currentVelocityDirX = currentVelocitySpeed > 0.01 ? battle.playerVelocityX / currentVelocitySpeed : 0;
    const currentVelocityDirY = currentVelocitySpeed > 0.01 ? battle.playerVelocityY / currentVelocitySpeed : 0;
    const directionDot =
      hasInput && currentVelocitySpeed > 14 ? currentVelocityDirX * normalizedX + currentVelocityDirY * normalizedY : 1;

    if (hasInput && currentVelocitySpeed <= moveSpeed * 0.16 && battle.playerMoveBoostSec <= 0.01) {
      battle.playerMoveBoostSec = 0.16;
      this.createCombatPulse(battle, {
        x: battle.playerX,
        y: battle.playerY,
        radius: 22,
        lifeSec: 0.1,
        color: 0x96ecff,
        secondaryColor: 0xffffff,
        fillAlpha: 0.04,
        strokeAlpha: 0.28,
        strokeWidth: 2,
        growthPerSec: 132,
        innerRadiusRatio: 0.72,
      });
    }

    if (hasInput && currentVelocitySpeed > moveSpeed * 0.18 && directionDot < -0.18) {
      battle.playerTurnBurstSec = Math.max(battle.playerTurnBurstSec, 0.12);
      battle.tempoPulseSec = Math.max(battle.tempoPulseSec, 0.08);
    }

    const moveBoostRatio = battle.playerMoveBoostSec > 0 ? Math.min(1, battle.playerMoveBoostSec / 0.16) : 0;
    const turnBurstRatio = battle.playerTurnBurstSec > 0 ? Math.min(1, battle.playerTurnBurstSec / 0.12) : 0;
    const targetSpeed =
      moveSpeed *
      controlFactor *
      tempoMoveMultiplier *
      (1 + moveBoostRatio * 0.13 + turnBurstRatio * 0.06 + (battle.dashDriveSec > 0 ? 0.08 : 0));
    const desiredVelocityX = normalizedX * targetSpeed;
    const desiredVelocityY = normalizedY * targetSpeed;
    const velocityBlend = hasInput
      ? Math.min(1, dt * (battle.dashDriveSec > 0 ? 18 : turnBurstRatio > 0.08 ? 16 : 13))
      : Math.min(1, dt * 11);
    battle.playerVelocityX += (desiredVelocityX - battle.playerVelocityX) * velocityBlend;
    battle.playerVelocityY += (desiredVelocityY - battle.playerVelocityY) * velocityBlend;
    if (!hasInput) {
      const coastDamping = Math.max(0, 1 - dt * (battle.dashDriveSec > 0 ? 3.4 : 7.8));
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
    this.kickBattleShake(battle, 0.18, 0.42 + dashCharge * 0.06);
    battle.tempoPulseSec = Math.max(battle.tempoPulseSec, 0.18);
    this.enqueueAudio('dash');

    for (const enemy of battle.enemies) {
      const distance = Math.hypot(enemy.x - battle.playerX, enemy.y - battle.playerY);
      if (distance <= pulseRadius) {
        enemy.hp -= pulseDamage;
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
      this.kickBattleShake(battle, 0.34, 0.8);
      battle.tempoPulseSec = Math.max(battle.tempoPulseSec, 0.24);
      battle.eliteSupportCooldownSec = this.getEliteEscortRespawnSec(template, battle);
      const openingEscortBatch = this.getEliteEscortBatch(template, battle);
      if (openingEscortBatch > 0) {
        this.spawnEliteSupportEnemies(battle, openingEscortBatch);
      }
      this.enqueueTip(
        battle.encounterType === 'boss' ? 'Boss 已进场：击败金色血条首领即可通关' : '精英进入战场',
      );
      this.enqueueAudio('pressure');
    }

    if (battle.eliteAlive && template.eliteRule && (template.eliteRule.escortBatch ?? 0) > 0) {
      const escortMax = this.getEliteEscortMax(template, battle);
      const currentEscorts = battle.enemies.filter((enemy) => !enemy.elite).length;
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
        this.kickBattleShake(battle, 0.08, 0.12 + Math.min(0.14, spawnedThisTick * 0.02));
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
    const currentEscorts = battle.enemies.filter((enemy) => !enemy.elite).length;
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
    return battle.killFlowCount;
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

    const side = (cursor + burstIndex) % 4;
    const t = (((cursor * 53) + burstIndex * 17) % 100) / 100;
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
    const moveMagnitude = Math.hypot(battle.playerMoveDirX, battle.playerMoveDirY);
    const targetAlignment =
      target && moveMagnitude > 0.05
        ? (((target.x - battle.playerX) / Math.max(1, targetDistance)) * battle.playerMoveDirX) +
          (((target.y - battle.playerY) / Math.max(1, targetDistance)) * battle.playerMoveDirY)
        : 0;
    const pierceLaneScore = focusRoute === 'pierce' && target ? this.getPierceLaneScore(battle, target) : 0;
    battle.playerAimDirX = Math.cos(baseAngle);
    battle.playerAimDirY = Math.sin(baseAngle);
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
      projectileSpeed *= 1.08;
      bulletLifeSec = 2.06;
      muzzleColor = 0x8fdcff;
      if (pierceLaneScore >= 1.25) {
        projectileSpeed *= 1.05;
        bulletLifeSec += 0.12;
      }
      if (target?.elite && eliteCrackRatio > 0.08) {
        spreadStep = shotCount > 1 ? Math.max(0.05, spreadStep - (0.016 + eliteCrackRatio * 0.022)) : 0.02;
        projectileSpeed *= 1 + eliteCrackRatio * 0.1;
        bulletLifeSec += 0.12 + eliteCrackRatio * 0.14;
        battle.playerMoveBoostSec = Math.max(battle.playerMoveBoostSec, 0.08 + eliteCrackRatio * 0.12);
        battle.tempoPulseSec = Math.max(battle.tempoPulseSec, 0.2 + eliteCrackRatio * 0.08);
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
            : 5.6) + killFlowBoost * 0.7 + eliteCrackRatio * (focusRoute === 'crit' ? 1.4 : focusRoute === 'pierce' ? 1.1 : 0.7);
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
    this.kickBattleShake(battle, 0.05 + killFlowBoost * 0.008, focusRoute === 'dash' ? 0.18 + killFlowRatio * 0.03 : 0.12 + killFlowRatio * 0.02);
    this.enqueueAudio('shoot');

    for (let index = 0; index < shotCount; index += 1) {
      const offset = (index - spreadCenter) * spreadStep;
      const angle = baseAngle + offset;
      battle.bullets.push({
        id: battle.nextBulletId++,
        x: battle.playerX,
        y: battle.playerY,
        vx: Math.cos(angle) * projectileSpeed,
        vy: Math.sin(angle) * projectileSpeed,
        damage: this.state.stats.damage,
        lifeSec: bulletLifeSec,
        pierceRemaining: this.state.stats.pierce,
        canEcho: this.state.routeCounts.pierce > 0,
        hitCount: 0,
        routeFocus: focusRoute ?? undefined,
      });
    }
  }

  private updateBullets(battle: BattleState, dt: number): void {
    const critStage = this.getRouteBuildStage('crit');
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
        const recoveryRatio = this.getEnemyRecoveryRatio(enemy);
        const eliteCrackRatio = enemy.elite ? this.getEliteCrackWindowRatio(battle) : 0;
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
        if (enemy.elite && enemy.guardSec > 0) {
          damage *= enemy.guardDamageMultiplier;
        }
        enemy.hp -= damage;
        bullet.hitCount += 1;
        this.enqueueAudio(critical ? 'crit' : 'hit');
        this.registerEnemyImpact(battle, enemy, bullet.x, bullet.y, {
          flashSec: critical ? 0.22 : 0.14,
          kick: critical ? 11 : 6,
          pulseRadius: enemy.radius + (critical ? 12 : 6),
          pulseColor: critical ? 0xffcf74 : 0xff7d86,
          secondaryColor: critical ? 0xfff8d4 : 0xffffff,
        });
        if (critical) {
          this.queueImpactFreeze(battle, enemy.elite ? 0.064 : 0.048, enemy.elite ? 0.12 : 0.16);
        } else if (enemy.elite) {
          this.queueImpactFreeze(battle, 0.03, 0.42);
        }
        this.kickBattleShake(battle, critical ? 0.14 : 0.08, critical ? 0.34 : 0.14);
        battle.playerShotFlashSec = Math.max(battle.playerShotFlashSec, critical ? 0.095 : 0.072);
        battle.playerShotRecoilSec = Math.max(battle.playerShotRecoilSec, critical ? 0.11 : 0.09);
        battle.playerShotRecoilStrength = Math.max(battle.playerShotRecoilStrength, critical ? 7.2 : 5.6);
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
        if (critical) {
          battle.critOverdriveSec = Math.min(4.2, battle.critOverdriveSec + this.getCritOverdriveDurationGain());
          battle.critChain += 1;
          battle.tempoPulseSec = Math.max(battle.tempoPulseSec, 0.18);
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
          if (laneScore >= 1.2 || bullet.hitCount >= 2) {
            const refund = Math.min(0.028, 0.01 + laneScore * 0.005 + Math.max(0, bullet.hitCount - 1) * 0.004);
            battle.fireCooldownSec = Math.max(0.035, battle.fireCooldownSec - refund);
            battle.tempoPulseSec = Math.max(battle.tempoPulseSec, 0.2);
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
            });
          }
        }

        this.trySpawnPierceEchoShots(battle, bullet, enemy);
        if (dashStage !== 'unformed' && battle.dashDriveSec > 0) {
          battle.dashDriveSec = Math.min(1.45, battle.dashDriveSec + (enemy.elite ? 0.08 : 0.04));
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
    const template = BATTLE_TEMPLATES[battle.templateId];
    for (const enemy of battle.enemies) {
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
          this.state.stats.hp = clamp(this.state.stats.hp + 0.9, 0, this.state.stats.maxHp);
          battle.playerRecoverySec = Math.max(battle.playerRecoverySec, 0.12);
        }
      }

      if (distance <= enemy.radius + PLAYER_COLLISION_RADIUS) {
        if (battle.invulnerableSec <= 0) {
          let damage = enemy.contactDamage;
          damage *= this.getDashDamageMultiplier(dashStage, battle.dashDriveSec);
          this.state.stats.hp = clamp(this.state.stats.hp - damage, 0, this.state.stats.maxHp);
          battle.invulnerableSec = 0.35;
          battle.playerImpactSec = Math.max(battle.playerImpactSec, 0.34);
          this.queueImpactFreeze(battle, enemy.elite ? 0.09 : 0.068, enemy.elite ? 0.1 : 0.15);
          this.pushPlayerKnockback(battle, enemy.x, enemy.y, enemy.elite ? 240 : 190);
          this.kickBattleShake(battle, 0.22, enemy.elite ? 0.76 : 0.48);
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
        survivors.push(enemy);
        continue;
      }

      survivors.push(enemy);
    }
    battle.enemies = survivors;
  }

  private updateArchetypeEnemy(enemy: BattleState['enemies'][number], battle: BattleState, dt: number): void {
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
          this.syncRegularPressurePack(battle, enemy, {
            radius: 88,
            limit: packCount >= 2 ? 2 : 1,
            durationSec: 0.11,
            cooldownSec: 0.86,
            predicate: (candidate) => candidate.archetype === 'standard' || candidate.archetype === 'brute',
          });
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

    const magnitude = Math.max(1, Math.hypot(moveX, moveY));
    const speedMultiplier =
      1 + openingRatio * (frontlineAnchor ? 0.14 : 0.08) + Math.min(0.06, packCount * 0.02) - recoveryRatio * 0.48;

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
      driveWindow > -0.1 &&
      this.triggerRegularPressureBeat(battle, enemy, openingRatio > 0.24 ? 0.26 : 0.22, 1.66)
    ) {
      this.syncRegularPressurePack(battle, enemy, {
        radius: 96,
        limit: 1,
        durationSec: 0.12,
        cooldownSec: 0.92,
        predicate: (candidate) => candidate.archetype === 'standard',
      });
    } else if (
      openingRatio > 0.22 &&
      recoveryRatio <= 0.06 &&
      distance <= 156 &&
      driveWindow > -0.24
    ) {
      this.triggerRegularPressureBeat(battle, enemy, 0.24, 1.58);
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
      openingRatio * 0.14;
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
    const leadX = battle.playerX + (moveMagnitude > 0.08 ? battle.playerMoveDirX * 54 : 0);
    const leadY = battle.playerY + (moveMagnitude > 0.08 ? battle.playerMoveDirY * 54 : 0);
    const sideSign = flankAnchor ? (flankAnchor.x < battle.playerX ? -1 : 1) : enemy.x < battle.playerX ? -1 : 1;
    const flankDirX = moveMagnitude > 0.08 ? -battle.playerMoveDirY : 0;
    const flankDirY = moveMagnitude > 0.08 ? battle.playerMoveDirX : 1;
    let targetX = pincerHeavy ? leadX + flankDirX * 36 * sideSign + sideSign * 24 : leadX;
    let targetY = pincerHeavy ? leadY + flankDirY * 42 * sideSign : leadY;
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
    if (
      flankAnchor &&
      recoveryRatio <= 0.05 &&
      distance <= 126 &&
      (Math.abs(strafeDirection) >= 0.58 || openingRatio > 0.24) &&
      this.triggerRegularPressureBeat(battle, enemy, openingRatio > 0.18 ? 0.2 : 0.18, 1.32)
    ) {
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
    const speedMultiplier = 1 + openingRatio * (pincerHeavy ? 0.14 : 0.08) - recoveryRatio * 0.5;

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
    }

    if (enemy.pressurePulseSec > 0) {
      const pressureRatio = Math.min(1, enemy.pressurePulseSec / this.getEnemyPressureWindowSec(enemy));
      moveX += strafeX * strafeDirection * (0.12 + pressureRatio * 0.22);
      moveY += strafeY * strafeDirection * (0.12 + pressureRatio * 0.22);
      moveX -= dirX * (0.08 + pressureRatio * 0.12);
      moveY -= dirY * (0.08 + pressureRatio * 0.12);
    }

    const magnitude = Math.max(1, Math.hypot(moveX, moveY));
    const speedMultiplier = 1 + openingRatio * (screenedByAnchor ? 0.1 : 0.06) - recoveryRatio * 0.58;
    enemy.x = clamp(enemy.x + (moveX / magnitude) * enemy.speed * speedMultiplier * dt, -42, ARENA_WIDTH + 42);
    enemy.y = clamp(enemy.y + (moveY / magnitude) * enemy.speed * speedMultiplier * dt, -42, ARENA_HEIGHT + 42);

    enemy.rangedCooldownSec = Math.max(0, enemy.rangedCooldownSec - dt);
    if (enemy.rangedCooldownSec > 0 || distance > preferredDistance * 1.45) {
      return;
    }

    const projectileSpeed =
      (archetype.projectileSpeed ?? 220) * (pressurePhase?.rangedProjectileSpeedMultiplier ?? 1);
    const projectileDamageMultiplier = archetype.projectileDamageMultiplier ?? 0.76;
    const leadSec = pattern === 'lanes' ? 0.24 : 0.18;
    const predictedX = battle.playerX + battle.playerMoveDirX * this.getPlayerMoveSpeed() * leadSec;
    const predictedY = battle.playerY + battle.playerMoveDirY * this.getPlayerMoveSpeed() * leadSec;
    const laneSideSign =
      laneBias === 'vertical'
        ? enemy.x < battle.playerX
          ? -1
          : 1
        : enemy.y < battle.playerY
          ? -1
          : 1;
    const targetX = predictedX + (pattern === 'lanes' && laneBias === 'vertical' ? laneSideSign * (rangedHeavy ? 18 : 10) : 0);
    const targetY =
      predictedY + (pattern === 'lanes' && laneBias === 'horizontal' ? laneSideSign * (rangedHeavy ? 18 : 10) : 0);
    const baseAngle = Math.atan2(targetY - enemy.y, targetX - enemy.x);
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
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;
      projectile.lifeSec -= dt;

      if (
        projectile.lifeSec <= 0 ||
        projectile.x < -48 ||
        projectile.x > ARENA_WIDTH + 48 ||
        projectile.y < -48 ||
        projectile.y > ARENA_HEIGHT + 48
      ) {
        continue;
      }

      const distance = Math.hypot(projectile.x - battle.playerX, projectile.y - battle.playerY);
      if (distance <= projectile.radius + PLAYER_COLLISION_RADIUS) {
        if (battle.invulnerableSec <= 0) {
          this.state.stats.hp = clamp(this.state.stats.hp - projectile.damage, 0, this.state.stats.maxHp);
          battle.invulnerableSec = 0.32;
          battle.playerImpactSec = Math.max(battle.playerImpactSec, 0.3);
          this.queueImpactFreeze(battle, projectile.radius > 5 ? 0.082 : 0.062, projectile.radius > 5 ? 0.12 : 0.16);
          this.pushPlayerKnockback(battle, projectile.x, projectile.y, projectile.radius > 5 ? 220 : 170);
          this.kickBattleShake(battle, 0.2, projectile.radius > 5 ? 0.44 : 0.4);
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
        }
        continue;
      }

      if (
        battle.playerNearMissCooldownSec <= 0 &&
        distance <= projectile.radius + PLAYER_COLLISION_RADIUS + 24
      ) {
        battle.playerNearMissSec = Math.max(battle.playerNearMissSec, 0.14);
        battle.playerNearMissAngle = Math.atan2(projectile.y - battle.playerY, projectile.x - battle.playerX);
        battle.playerNearMissCooldownSec = 0.09;
        this.kickBattleShake(battle, 0.05, 0.14);
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
    const preferredDistance =
      (eliteRule.preferredDistance ?? 170) + (pressurePhase?.preferredDistanceDelta ?? 0);
    const strafeStrength = (eliteRule.strafeStrength ?? 0.2) + (pressurePhase?.strafeStrengthBonus ?? 0);
    const movementSpeed = enemy.speed * (pressurePhase?.eliteSpeedMultiplier ?? 1);
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
        const escorts = battle.enemies.filter((candidate) => !candidate.elite);
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
    const flowCarry = flowRatio > 0 ? battle.killFlowCount * 0.72 + flowRatio * 1.24 : 0;
    const effectiveMagnetRadius = magnetRadius + (flowRatio > 0 ? 30 + battle.killFlowCount * 10 : 0);
    const survivors = [];

    for (const orb of battle.experienceOrbs) {
      const distance = Math.hypot(orb.x - battle.playerX, orb.y - battle.playerY);
      if (distance <= pickupRadius) {
        this.gainExperience(orb.value);
        battle.playerRecoverySec = Math.max(battle.playerRecoverySec, 0.18 + Math.min(0.08, flowCarry * 0.026));
        battle.tempoPulseSec = Math.max(
          battle.tempoPulseSec,
          0.14 + Math.min(0.16, orb.value * 0.006 + flowCarry * 0.028),
        );
        if (battle.killFlowSec > 0) {
          battle.killFlowSec = Math.max(
            battle.killFlowSec,
            0.3 + Math.min(0.24, orb.value * 0.01 + flowCarry * 0.042),
          );
          battle.playerMoveBoostSec = Math.max(
            battle.playerMoveBoostSec,
            0.12 + Math.min(0.14, battle.killFlowCount * 0.03 + flowCarry * 0.018),
          );
          battle.tempoPulseSec = Math.max(
            battle.tempoPulseSec,
            0.18 + Math.min(0.2, battle.killFlowCount * 0.04 + orb.value * 0.004 + flowCarry * 0.02),
          );
        }
        this.feedBattleFlow(battle, 'pickup', orb.value + flowCarry * 2.4);
        if (this.state.status === 'battle') {
          battle.fireCooldownSec = Math.max(
            0.035,
            battle.fireCooldownSec - Math.min(0.026, 0.006 + orb.value * 0.0007 + flowCarry * 0.0024),
          );
        }
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
            300 + Math.max(0, chainVacuumRadius - linkedDistance) * 3 + flowCarry * 26,
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
          (220 +
            Math.max(0, effectiveMagnetRadius - distance) * 3.1 +
            Math.min(90, battle.tempoPulseSec * 420) +
            flowCarry * 28) *
          (distance <= effectiveMagnetRadius * 0.42 ? 1.24 : 1);
        const pullBlend = Math.min(1, 0.22 + dt * (8.5 + flowCarry * 0.9));
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

  private kickBattleShake(battle: BattleState, durationSec: number, strength: number): void {
    battle.cameraShakeSec = Math.max(battle.cameraShakeSec, durationSec);
    battle.cameraShakeStrength = Math.max(battle.cameraShakeStrength, strength);
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
    enemy.hitOffsetX = (dx / distance) * kick;
    enemy.hitOffsetY = (dy / distance) * kick;
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
    const critSplashRatio = this.getCritSplashRatio(battle);
    const flowChainCount = this.registerKillFlow(battle, enemy);
    const flowChainBonus = Math.max(0, flowChainCount - 1);
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
          relay.spawnFlashSec = Math.max(relay.spawnFlashSec, 0.12);
          this.syncRegularPressurePack(battle, relay, {
            radius: 84,
            limit: 1,
            durationSec: 0.1,
            cooldownSec: 0.82,
            predicate: (candidate) => candidate.archetype === 'standard',
          });
          midpointPulse(relay, 0xffd8c7, 0xffffff);
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
          const dx = relay.x - enemy.x;
          const dy = relay.y - enemy.y;
          const distance = Math.max(1, Math.hypot(dx, dy));
          relay.hitOffsetX = clamp(relay.hitOffsetX + (dx / distance) * 5, -16, 16);
          relay.hitOffsetY = clamp(relay.hitOffsetY + (dy / distance) * 5, -16, 16);
          relay.spawnFlashSec = Math.max(relay.spawnFlashSec, 0.14);
          midpointPulse(relay, 0x9fffe2, 0xf4fffb);
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
  ): void {
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

    candidates.forEach((candidate, index) => {
      if (this.triggerEnemyPressurePulse(candidate, durationSec, cooldownSec + index * 0.08)) {
        candidate.spawnFlashSec = Math.max(candidate.spawnFlashSec, 0.1);
      }
    });
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
    battle.playerTurnBurstSec = Math.max(
      battle.playerTurnBurstSec,
      0.08 + Math.min(0.08, crackedEscorts * 0.02 + (focusRoute === 'crit' ? 0.03 : focusRoute === 'pierce' ? 0.02 : 0)),
    );
    battle.playerShotFlashSec = Math.max(
      battle.playerShotFlashSec,
      0.05 + Math.min(0.05, crackedEscorts * 0.01 + (focusRoute === 'crit' ? 0.02 : focusRoute === 'pierce' ? 0.012 : 0)),
    );
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
