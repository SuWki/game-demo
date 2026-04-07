import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
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
  RouteBuildStage,
  RouteId,
  RunEndingKind,
  RunOutcome,
  RunState,
  Services,
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

    if (node.type === 'battle' || node.type === 'boss') {
      this.enterBattle(node);
      return;
    }

    if (node.type === 'upgrade') {
      this.state.status = 'upgradeChoice';
      this.state.upgradeSource = 'nodePrep';
      this.state.upgradeChoices = this.rollUpgradeChoices('nodePrep');
      this.state.currentEvent = null;
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
      `${upgrade.sourceId}:${upgrade.rarity}`,
      upgrade.routeId,
      upgrade.contentTier,
      {
        phase: this.state.phase,
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
    this.services.metrics.recordEventSelected(eventDef.id, option.id, optionRouteId, eventDef.contentTier, {
      phase: this.state.phase,
      contentKind: eventDef.contentKind ?? 'event',
      isHybridPick:
        isRedirectPick ||
        eventDef.id === 'signal-soften' ||
        eventDef.id === 'phase-splitter' ||
        eventDef.id === 'cross-branch-signal' ||
        eventDef.id === 'route-handoff' ||
        eventDef.id === 'relay-splice' ||
        eventDef.id === 'null-lens' ||
        eventDef.id === 'mirror-cache' ||
        eventDef.id === 'carrier-breach',
      isLatePayoff: this.isLatePayoffEvent(eventDef),
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
    battle.remainingSec = Math.max(0, battle.remainingSec - dt);
    battle.critOverdriveSec = Math.max(0, battle.critOverdriveSec - dt);
    battle.dashDriveSec = Math.max(0, battle.dashDriveSec - dt);
    battle.invulnerableSec = Math.max(0, battle.invulnerableSec - dt);
    battle.pressurePhaseElapsedSec += dt;
    battle.pressureTransitionSec = Math.max(0, battle.pressureTransitionSec - dt);

    this.updatePressurePhase(battle);
    this.updatePressureSignature(battle, dt);
    this.updatePressurePattern(battle, dt);
    this.updatePlayerMovement(battle, dt);
    this.spawnEnemies(battle, dt);
    this.updateShooting(battle, dt);
    this.updateBullets(battle, dt);
    this.updateEnemies(battle, dt);
    this.updateEnemyProjectiles(battle, dt);
    this.updatePulses(battle, dt);
    this.updateExperienceOrbs(battle, dt);

    if (this.state.stats.regeneration > 0) {
      this.state.stats.hp = clamp(this.state.stats.hp + this.state.stats.regeneration * dt, 0, this.state.stats.maxHp);
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
      enemies: [],
      bullets: [],
      pulses: [],
      experienceOrbs: [],
      enemyProjectiles: [],
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

  private openPressureSafeWindow(
    battle: BattleState,
    phase: BattlePressurePhaseDefinition,
    axis: PressureSafeWindowAxis,
  ): void {
    if (axis === 'pocket') {
      const shiftType = this.getPressurePocketShiftType(battle, phase);
      const shiftProfile = this.getPressurePocketShiftProfile(shiftType);
      const baseSafeWindowSpan = clamp(phase.patternSafeWindowSize ?? 184, 152, ARENA_WIDTH * 0.36);
      const baseSafeWindowSecondarySpan = clamp(
        phase.patternSafeWindowSecondarySize ?? baseSafeWindowSpan * 0.68,
        108,
        ARENA_HEIGHT * 0.34,
      );
      const safeWindowSpan = clamp(baseSafeWindowSpan * shiftProfile.widthScale, 144, ARENA_WIDTH * 0.38);
      const safeWindowSecondarySpan = clamp(
        baseSafeWindowSecondarySpan * shiftProfile.heightScale,
        104,
        ARENA_HEIGHT * 0.36,
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

    const dimension = axis === 'vertical' ? ARENA_WIDTH : ARENA_HEIGHT;
    const minimumSpan = axis === 'vertical' ? 164 : 132;
    const maximumSpan = dimension * 0.46;
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
    battle.pressureSafeWindowSecondaryCenter = axis === 'vertical' ? CENTER_Y : CENTER_X;
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
    const dimension = axis === 'vertical' ? ARENA_WIDTH : ARENA_HEIGHT;
    const playerCoord = axis === 'vertical' ? battle.playerX : battle.playerY;
    const laneRatios = axis === 'vertical' ? [0.32, 0.68, 0.5, 0.36, 0.64] : [0.3, 0.7, 0.5, 0.38, 0.62];
    const pulseIndex = Math.max(0, battle.pressurePatternPulseCount - 1) % laneRatios.length;
    const anchoredLane = dimension * laneRatios[pulseIndex];
    const blendedCenter = anchoredLane * 0.72 + playerCoord * 0.28;
    const margin = axis === 'vertical' ? 92 : 74;
    return clamp(blendedCenter, margin + span * 0.5, dimension - margin - span * 0.5);
  }

  private choosePressureSafePocketCenter(
    battle: BattleState,
    spanX: number,
    spanY: number,
    shiftType: PressurePocketShiftModeId,
  ): { x: number; y: number } {
    const shiftModes = this.getActivePressurePhase(battle)?.patternPocketShiftModes;
    const shiftModeCount = Math.max(1, shiftModes?.length ?? 0);
    const shiftCycleIndex = Math.floor(Math.max(0, battle.pressurePatternPulseCount - 1) / shiftModeCount);
    const shiftProfile = this.getPressurePocketShiftProfile(shiftType);
    const anchor = shiftProfile.anchors[shiftCycleIndex % shiftProfile.anchors.length];
    const anchorX = ARENA_WIDTH * anchor.x;
    const anchorY = ARENA_HEIGHT * anchor.y;
    const playerBlend = shiftProfile.playerBlend;
    const blendedX = anchorX * (1 - playerBlend) + battle.playerX * playerBlend;
    const blendedY = anchorY * (1 - playerBlend) + battle.playerY * playerBlend;
    return {
      x: clamp(blendedX, 108 + spanX * 0.5, ARENA_WIDTH - 108 - spanX * 0.5),
      y: clamp(blendedY, 92 + spanY * 0.5, ARENA_HEIGHT - 92 - spanY * 0.5),
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

    const dimension = axis === 'vertical' ? ARENA_WIDTH : ARENA_HEIGHT;
    const margin = axis === 'vertical' ? 72 : 58;
    const shotSlots = Math.max(4, phase.patternWallShotCount ?? (axis === 'vertical' ? 7 : 6));
    const safeStart = battle.pressureSafeWindowCenter - battle.pressureSafeWindowSpan * 0.5;
    const safeEnd = battle.pressureSafeWindowCenter + battle.pressureSafeWindowSpan * 0.5;
    const slotPositions = this.collectPressureSlotPositions(dimension, margin, shotSlots, safeStart, safeEnd);
    const { projectileSpeed, projectileDamage } = this.getPressureProjectileStats(battle, 0.7);

    for (const position of slotPositions) {
      if (axis === 'vertical') {
        this.spawnEnemyProjectile(battle, position, -22, projectileSpeed, projectileDamage, 6, Math.PI / 2);
        this.spawnEnemyProjectile(battle, position, ARENA_HEIGHT + 22, projectileSpeed, projectileDamage, 6, -Math.PI / 2);
        continue;
      }

      this.spawnEnemyProjectile(battle, -22, position, projectileSpeed, projectileDamage, 6, 0);
      this.spawnEnemyProjectile(battle, ARENA_WIDTH + 22, position, projectileSpeed, projectileDamage, 6, Math.PI);
    }
  }

  private spawnPressurePocketShots(battle: BattleState, phase: BattlePressurePhaseDefinition): void {
    if (battle.pressureSafeWindowAxis !== 'pocket' || battle.pressureSafeWindowSpan <= 0) {
      return;
    }

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
    const xSlots = this.collectPressureSlotPositions(ARENA_WIDTH, xMargin, horizontalSlotCount, safeStartX, safeEndX);
    const ySlots = this.collectPressureSlotPositions(ARENA_HEIGHT, yMargin, verticalSlotCount, safeStartY, safeEndY);
    const damageMultiplier = shiftType === 'centerReset' ? 0.64 : shiftType === 'edgeBounce' ? 0.7 : 0.68;
    const { projectileSpeed, projectileDamage } = this.getPressureProjectileStats(battle, damageMultiplier);

    for (const x of xSlots) {
      this.spawnEnemyProjectile(battle, x, -24, projectileSpeed, projectileDamage, 6, Math.PI / 2);
      this.spawnEnemyProjectile(battle, x, ARENA_HEIGHT + 24, projectileSpeed, projectileDamage, 6, -Math.PI / 2);
    }

    for (const y of ySlots) {
      this.spawnEnemyProjectile(battle, -24, y, projectileSpeed, projectileDamage, 6, 0);
      this.spawnEnemyProjectile(battle, ARENA_WIDTH + 24, y, projectileSpeed, projectileDamage, 6, Math.PI);
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
    if (!routeId) {
      return '再来一局优先把前段节奏立住，主路线会更容易自然站稳。';
    }

    const routeName = ROUTE_NAME_MAP[routeId];
    if (outcome === 'victory') {
      if (buildStage === 'matured') {
        return `${routeName}路线这一局已经跑通，再开一局可以试着换一条路，或把收尾打得更稳。`;
      }
      return `${routeName}路线已经站住了，再来一局可以继续把它压到完整成型。`;
    }

    if (endingKind === 'timeOut') {
      return `${routeName}路线已经起势，再来一局重点补最后一段输出和转场决策。`;
    }
    if (buildStage === 'matured' || buildStage === 'committed') {
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
    battle.eliteSupportCooldownSec = Math.max(0, battle.eliteSupportCooldownSec - dt);
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
        role: 'elite',
        archetype: 'brute',
        contactDamage: this.getContactDamage(template, this.getCurrentBattleIndex(), this.state.phase, battle.difficultyScale, eliteRule.damageMultiplier),
        guardSec: eliteRule.guardSec ?? 0,
        guardDamageMultiplier: eliteRule.guardDamageMultiplier ?? 1,
        grazeCooldownSec: 0,
        rangedCooldownSec: 0,
      });
      battle.eliteSupportCooldownSec = this.getEliteEscortRespawnSec(template, battle);
      const openingEscortBatch = this.getEliteEscortBatch(template, battle);
      if (openingEscortBatch > 0) {
        this.spawnEliteSupportEnemies(battle, openingEscortBatch);
      }
      this.enqueueTip(battle.encounterType === 'boss' ? 'Boss 进入战场' : '精英进入战场');
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

    while (battle.enemySpawnTimerSec <= 0) {
      battle.enemySpawnTimerSec += this.getEnemySpawnInterval(battle, template, battle.elapsedSec);
      const regularEnemyCap = this.getRegularEnemyCap(battle);
      if (regularEnemyCap !== null && battle.enemies.filter((enemy) => !enemy.elite).length >= regularEnemyCap) {
        break;
      }
      const burstCount = this.getSpawnBurstCount(template);
      for (let burstIndex = 0; burstIndex < burstCount; burstIndex += 1) {
        const activeRegulars = battle.enemies.filter((enemy) => !enemy.elite).length;
        if (regularEnemyCap !== null && activeRegulars >= regularEnemyCap) {
          break;
        }

        const position = this.getSpawnPosition(battle, template, burstIndex);
        battle.enemies.push(this.createArchetypedEnemy(battle, template, 'regular', position.x, position.y));
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
    const margin = 44;
    const cursor = battle.spawnCursor++;
    const sideOffset = 46 + Math.floor(index / 2) * 34;
    const jitter = ((cursor % 3) - 1) * 12;

    if (mode === 'laneCrush') {
      const fromTop = index % 2 === 0;
      const x = clamp(battle.playerX + (index % 4 < 2 ? -sideOffset : sideOffset) + jitter, margin, ARENA_WIDTH - margin);
      return {
        x,
        y: fromTop ? -28 : ARENA_HEIGHT + 28,
      };
    }

    const fromLeft = index % 2 === 0;
    const y = clamp(battle.playerY + (index % 4 < 2 ? -sideOffset : sideOffset) + jitter, margin, ARENA_HEIGHT - margin);
    return {
      x: fromLeft ? -28 : ARENA_WIDTH + 28,
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

  private getSpawnBurstCount(template: (typeof BATTLE_TEMPLATES)[keyof typeof BATTLE_TEMPLATES]): number {
    return getSpawnBurstCount(template);
  }

  private getSpawnPosition(
    battle: BattleState,
    template: (typeof BATTLE_TEMPLATES)[keyof typeof BATTLE_TEMPLATES],
    burstIndex: number,
  ): { x: number; y: number } {
    const pattern = template.spawnRule?.pattern ?? 'surround';
    const laneBias = template.spawnRule?.laneBias ?? 'horizontal';
    const cursor = battle.spawnCursor++;
    const margin = 36;

    if (pattern === 'pincers') {
      const fromLeft = (cursor + burstIndex) % 2 === 0;
      const y = margin + (((cursor * 73) + burstIndex * 41) % Math.max(1, ARENA_HEIGHT - margin * 2));
      return {
        x: fromLeft ? -28 : ARENA_WIDTH + 28,
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
          x: clamp(((lane + 1) / (laneCount + 1)) * ARENA_WIDTH + jitter, margin, ARENA_WIDTH - margin),
          y: sideIndex === 0 ? -28 : ARENA_HEIGHT + 28,
        };
      }

      return {
        x: sideIndex === 0 ? -28 : ARENA_WIDTH + 28,
        y: clamp(((lane + 1) / (laneCount + 1)) * ARENA_HEIGHT + jitter, margin, ARENA_HEIGHT - margin),
      };
    }

    const side = (cursor + burstIndex) % 4;
    const t = (((cursor * 53) + burstIndex * 17) % 100) / 100;
    if (side === 0) {
      return {
        x: margin + t * (ARENA_WIDTH - margin * 2),
        y: -28,
      };
    }
    if (side === 1) {
      return {
        x: ARENA_WIDTH + 28,
        y: margin + t * (ARENA_HEIGHT - margin * 2),
      };
    }
    if (side === 2) {
      return {
        x: margin + t * (ARENA_WIDTH - margin * 2),
        y: ARENA_HEIGHT + 28,
      };
    }
    return {
      x: -28,
      y: margin + t * (ARENA_HEIGHT - margin * 2),
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
    };
  }

  private spawnEliteSupportEnemies(battle: BattleState, count: number): void {
    if (count <= 0) {
      return;
    }

    const template = BATTLE_TEMPLATES[battle.templateId];
    const eliteEnemy = battle.enemies.find((enemy) => enemy.elite);
    const battleIndex = this.getCurrentBattleIndex();
    const escortHp = Math.round(this.getRegularEnemyHp(template, battleIndex, this.state.phase, battle.difficultyScale) * 0.82);
    const escortSpeed = Math.round(this.getRegularEnemySpeed(template, battleIndex, this.state.phase, battle.difficultyScale, 1.06));
    const escortDamage = Math.max(6, Math.round(this.getContactDamage(template, battleIndex, this.state.phase, battle.difficultyScale, 0.92)));
    const screenAngle = eliteEnemy
      ? Math.atan2(eliteEnemy.y - battle.playerY, eliteEnemy.x - battle.playerX)
      : -Math.PI / 2;

    for (let index = 0; index < count; index += 1) {
      const spread = count === 1 ? 0 : ((index / Math.max(1, count - 1)) - 0.5) * 0.95;
      const distance = 42 + index * 8;
      const anchorX = eliteEnemy?.x ?? CENTER_X;
      const anchorY = eliteEnemy?.y ?? -30;
      const offsetX = Math.cos(screenAngle) * distance;
      const offsetY = Math.sin(screenAngle) * distance;
      const strafeX = -Math.sin(screenAngle) * spread * 44;
      const strafeY = Math.cos(screenAngle) * spread * 44;

      battle.enemies.push(
        this.createArchetypedEnemy(
          battle,
          template,
          'escort',
          anchorX - offsetX + strafeX,
          anchorY - offsetY + strafeY,
          {
            hp: escortHp,
            speed: escortSpeed,
            damage: escortDamage,
            radius: 11 + (index % 2),
          },
        ),
      );
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
    const template = BATTLE_TEMPLATES[battle.templateId];
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
        if (enemy.elite && enemy.guardSec > 0) {
          damage *= enemy.guardDamageMultiplier;
        }
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
    const template = BATTLE_TEMPLATES[battle.templateId];
    for (const enemy of battle.enemies) {
      enemy.guardSec = Math.max(0, enemy.guardSec - dt);
      if (enemy.elite && enemy.guardSec <= 0) {
        enemy.guardDamageMultiplier = template.eliteRule?.guardDamageMultiplier ?? 1;
      }
      enemy.grazeCooldownSec = Math.max(0, enemy.grazeCooldownSec - dt);
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
        this.updateArchetypeEnemy(enemy, battle, dt);
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
        if (dashStage === 'committed' || dashStage === 'matured') {
          battle.dashDriveSec = Math.max(battle.dashDriveSec, 0.7);
          battle.dashCooldownSec = Math.max(0.75, battle.dashCooldownSec - 0.35);
          this.state.stats.hp = clamp(this.state.stats.hp + 0.9, 0, this.state.stats.maxHp);
        }
      }

      if (distance <= enemy.radius + PLAYER_COLLISION_RADIUS) {
        if (battle.invulnerableSec <= 0) {
          let damage = enemy.contactDamage;
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

  private updateArchetypeEnemy(enemy: BattleState['enemies'][number], battle: BattleState, dt: number): void {
    switch (enemy.archetype) {
      case 'skirmisher':
        this.updateSkirmisherEnemy(enemy, battle, dt);
        return;
      case 'ranged':
        this.updateRangedEnemy(enemy, battle, dt);
        return;
      case 'brute':
      case 'standard':
      default:
        this.updateChasingEnemy(enemy, battle, dt);
        return;
    }
  }

  private updateChasingEnemy(enemy: BattleState['enemies'][number], battle: BattleState, dt: number): void {
    const angle = Math.atan2(battle.playerY - enemy.y, battle.playerX - enemy.x);
    enemy.x += Math.cos(angle) * enemy.speed * dt;
    enemy.y += Math.sin(angle) * enemy.speed * dt;
  }

  private updateSkirmisherEnemy(enemy: BattleState['enemies'][number], battle: BattleState, dt: number): void {
    const dx = battle.playerX - enemy.x;
    const dy = battle.playerY - enemy.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const dirX = dx / distance;
    const dirY = dy / distance;
    const strafeX = -dirY;
    const strafeY = dirX;
    const strafeStrength = getEnemyArchetype(enemy.archetype).strafeStrength ?? 0.3;
    const strafeDirection = Math.sin(battle.elapsedSec * 2.25 + enemy.id * 0.6);
    const chaseWeight = distance > 120 ? 0.94 : 0.7;
    const moveX = dirX * chaseWeight + strafeX * strafeDirection * strafeStrength;
    const moveY = dirY * chaseWeight + strafeY * strafeDirection * strafeStrength;
    const magnitude = Math.max(1, Math.hypot(moveX, moveY));

    enemy.x = clamp(enemy.x + (moveX / magnitude) * enemy.speed * dt, -36, ARENA_WIDTH + 36);
    enemy.y = clamp(enemy.y + (moveY / magnitude) * enemy.speed * dt, -36, ARENA_HEIGHT + 36);
  }

  private updateRangedEnemy(enemy: BattleState['enemies'][number], battle: BattleState, dt: number): void {
    const archetype = getEnemyArchetype(enemy.archetype);
    const pressurePhase = this.getActivePressurePhase(battle);
    const preferredDistance = archetype.preferredDistance ?? 205;
    const strafeStrength = archetype.strafeStrength ?? 0.22;
    const dx = battle.playerX - enemy.x;
    const dy = battle.playerY - enemy.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const dirX = dx / distance;
    const dirY = dy / distance;
    const strafeX = -dirY;
    const strafeY = dirX;
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

    const magnitude = Math.max(1, Math.hypot(moveX, moveY));
    enemy.x = clamp(enemy.x + (moveX / magnitude) * enemy.speed * dt, -42, ARENA_WIDTH + 42);
    enemy.y = clamp(enemy.y + (moveY / magnitude) * enemy.speed * dt, -42, ARENA_HEIGHT + 42);

    enemy.rangedCooldownSec = Math.max(0, enemy.rangedCooldownSec - dt);
    if (enemy.rangedCooldownSec > 0 || distance > preferredDistance * 1.45) {
      return;
    }

    const projectileSpeed =
      (archetype.projectileSpeed ?? 220) * (pressurePhase?.rangedProjectileSpeedMultiplier ?? 1);
    const projectileDamageMultiplier = archetype.projectileDamageMultiplier ?? 0.76;
    this.spawnEnemyProjectile(
      battle,
      enemy.x,
      enemy.y,
      projectileSpeed,
      Math.max(1, Math.round(enemy.contactDamage * projectileDamageMultiplier)),
      archetype.projectileRadius ?? 5,
    );
    enemy.rangedCooldownSec = this.getRangedShotIntervalSec(archetype, battle);
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
          this.enqueueAudio('pressure');
        }
        continue;
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
    let moveX = 0;
    let moveY = 0;

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
        } else {
          applyKitingBaseline();
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
        break;
    }

    const moveMagnitude = Math.max(1, Math.hypot(moveX, moveY));
    enemy.x = clamp(enemy.x + (moveX / moveMagnitude) * movementSpeed * dt, -48, ARENA_WIDTH + 48);
    enemy.y = clamp(enemy.y + (moveY / moveMagnitude) * movementSpeed * dt, -48, ARENA_HEIGHT + 48);
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

    const orbValue = Math.round(this.getEnemyExperienceValue(battle, enemy.elite) * ENEMY_ARCHETYPES[enemy.archetype].experienceMultiplier);
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
