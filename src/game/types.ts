export type RouteId = 'crit' | 'pierce' | 'dash';
export type RouteReference = RouteId | 'dominant';
export type NodeType = 'battle' | 'upgrade' | 'anomaly' | 'boss';
export type ContentTier = 'standard' | 'rare';
export type BattleEncounterType = 'battle' | 'boss';
export type EventContentKind = 'event' | 'anomaly';
export type AnomalyClassId = 'routeWindow' | 'distortion' | 'hybrid' | 'bossEcho';
export type BattleTemplateId =
  | 'elimination'
  | 'elimination-pincer'
  | 'elimination-sweep'
  | 'elimination-crossline'
  | 'elite'
  | 'elite-vice'
  | 'elite-lockdown'
  | 'elite-screen'
  | 'elite-bulwark'
  | 'boss-hunt'
  | 'boss-lockdown'
  | 'boss-bastion'
  | 'survival'
  | 'survival-crossfire'
  | 'survival-rush'
  | 'survival-gauntlet'
  | 'survival-sieve';
export type PhaseId = 'opening' | 'mid' | 'late' | 'finalPrep' | 'finalBattle' | 'ended';
export type RunStatus = 'battle' | 'nodeChoice' | 'upgradeChoice' | 'eventChoice' | 'result';
export type RunOutcome = 'victory' | 'defeat';
export type RouteBuildStage = 'unformed' | 'hinted' | 'committed' | 'matured';
export type RunEndingKind = 'victory' | 'hpDepleted' | 'timeOut';
export type AudioCue =
  | 'click'
  | 'confirm'
  | 'start'
  | 'upgrade'
  | 'anomaly'
  | 'boss'
  | 'shoot'
    | 'dash'
    | 'hit'
    | 'pierceHit'
    | 'dashHit'
    | 'critSplash'
    | 'pierceEcho'
    | 'dashPulse'
    | 'hurt'
  | 'kill'
  | 'pickup'
  | 'crit'
  | 'enemyShot'
  | 'nearMiss'
  | 'relayStandard'
  | 'relaySkirmisher'
  | 'relayBrute'
  | 'relayRanged'
  | 'pressure'
  | 'victory'
  | 'defeat'
  | 'result';
export type ToastTone = 'neutral' | 'accent' | 'route' | 'danger' | 'success';
export type UpgradeRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type UpgradeValueBucket = 'low' | 'mid' | 'high' | 'spike';
export type UpgradeSource = 'levelUp' | 'nodePrep';
export type UpgradeCategory = 'generic' | 'route';
export type SpawnPatternId = 'surround' | 'pincers' | 'lanes';
export type EliteBehaviorId = 'frontline' | 'screened' | 'kiting' | 'summoner';
export type EnemyRole = 'regular' | 'escort' | 'elite';
export type EnemyArchetypeId = 'standard' | 'brute' | 'skirmisher' | 'ranged';
export type PressurePatternModeId = 'laneCrush' | 'sideClamp' | 'crossfireWave';
export type PressureSafeWindowAxis = 'vertical' | 'horizontal' | 'pocket';
export type PressurePocketShiftModeId = 'sweep' | 'centerReset' | 'edgeBounce';
export type DebugBattlePhaseId = 'opening' | 'mid' | 'late' | 'finalBattle';

export interface EnemyArchetypeDefinition {
  id: EnemyArchetypeId;
  name: string;
  hpMultiplier: number;
  speedMultiplier: number;
  radiusMultiplier: number;
  contactDamageMultiplier: number;
  experienceMultiplier: number;
  preferredDistance?: number;
  strafeStrength?: number;
  shotIntervalSec?: number;
  projectileSpeed?: number;
  projectileDamageMultiplier?: number;
  projectileRadius?: number;
}

export interface RouteDefinition {
  id: RouteId;
  name: string;
  shortHint: string;
  matureHint: string;
  color: string;
}

export interface BattlePressurePhaseDefinition {
  id: string;
  label: string;
  behaviorOverride?: EliteBehaviorId;
  signatureLabel?: string;
  signatureDurationSec?: number;
  signaturePulseIntervalSec?: number;
  signatureEscortBurst?: number;
  signatureVolleyCount?: number;
  patternLabel?: string;
  patternMode?: PressurePatternModeId;
  patternPulseIntervalSec?: number;
  patternEscortBurst?: number;
  patternEscortArchetype?: EnemyArchetypeId;
  patternVolleyCount?: number;
  patternVolleySpreadRad?: number;
  patternVolleyShotsPerShooter?: number;
  patternSafeWindowSize?: number;
  patternSafeWindowSecondarySize?: number;
  patternSafeWindowLingerSec?: number;
  patternPocketShiftModes?: PressurePocketShiftModeId[];
  patternWallShotCount?: number;
  triggerHpRatio?: number;
  triggerRemainingSec?: number;
  minResidenceSec?: number;
  entryGuardSec?: number;
  entryGuardDamageMultiplier?: number;
  entryEscortBurst?: number;
  spawnIntervalMultiplier?: number;
  regularEnemyCapBonus?: number;
  escortBatchBonus?: number;
  escortMaxBonus?: number;
  escortRespawnMultiplier?: number;
  eliteSpeedMultiplier?: number;
  preferredDistanceDelta?: number;
  strafeStrengthBonus?: number;
  rangedShotIntervalMultiplier?: number;
  rangedProjectileSpeedMultiplier?: number;
}

export interface BattleTemplateDefinition {
  id: BattleTemplateId;
  name: string;
  description: string;
  encounterType?: BattleEncounterType;
  contentTier?: ContentTier;
  durationSec: number;
  spawnIntervalSec: number;
  enemyHp: number;
  enemySpeed: number;
  enemyDamage: number;
  regularEnemyCap: number;
  pressureMultiplier: number;
  accent: number;
  winCondition: {
    type: 'kills' | 'elite' | 'survive';
    target?: number;
  };
  spawnRule?: {
    pattern: SpawnPatternId;
    burstCount?: number;
    laneBias?: 'horizontal' | 'vertical';
  };
  regularArchetypes?: Partial<Record<EnemyArchetypeId, number>>;
  escortArchetypes?: Partial<Record<EnemyArchetypeId, number>>;
  eliteRule?: {
    spawnAtSec: number;
    hpMultiplier: number;
    speedMultiplier: number;
    damageMultiplier: number;
    guardSec?: number;
    guardDamageMultiplier?: number;
    radius: number;
    regularEnemyCap: number;
    behavior?: EliteBehaviorId;
    preferredDistance?: number;
    strafeStrength?: number;
    escortBatch?: number;
    escortRespawnSec?: number;
    escortMax?: number;
    pressurePhases?: BattlePressurePhaseDefinition[];
  };
}

export interface StatModifiers {
  maxHp?: number;
  damage?: number;
  fireRate?: number;
  projectileSpeed?: number;
  critChance?: number;
  critMultiplier?: number;
  pierce?: number;
  multishot?: number;
  moveSpeed?: number;
  dashInterval?: number;
  dashPulseDamage?: number;
  dashInvulnerability?: number;
  regeneration?: number;
}

export interface ContentSelectionProfile {
  baseWeight?: number;
  minRound?: number;
  maxRound?: number;
  phaseBonuses?: Partial<Record<PhaseId, number>>;
  noDominantRouteBonus?: number;
  hintedRouteBonus?: number;
  dominantRouteBonus?: number;
  committedRouteBonus?: number;
  maturedRouteBonus?: number;
  offRouteMultiplier?: number;
  finalPrepBonus?: number;
  excludeFromFinalPrep?: boolean;
}

export type ContentEffect =
  | {
      type: 'stats';
      modifiers: StatModifiers;
    }
  | {
      type: 'heal';
      amount: number;
    }
  | {
      type: 'route';
      routeId: RouteReference;
    };

export interface UpgradeArchetype {
  id: string;
  name: string;
  description?: string;
  category: UpgradeCategory;
  contentTier?: ContentTier;
  routeId?: RouteId;
  repeatable?: boolean;
  tags?: string[];
  selection?: ContentSelectionProfile;
  effects: ContentEffect[];
}

export interface UpgradeDefinition {
  id: string;
  sourceId: string;
  name: string;
  description: string;
  category: UpgradeCategory;
  contentTier?: ContentTier;
  rarity: UpgradeRarity;
  rarityLabel: string;
  routeId?: RouteId;
  repeatable?: boolean;
  tags?: string[];
  effects: ContentEffect[];
  valueScore: number;
  valueBucket: UpgradeValueBucket;
  valueBreakdown: {
    directDps: number;
    utility: number;
    survival: number;
    mobility: number;
    routeSynergy: number;
    total: number;
  };
}

export interface EventOption {
  id: string;
  label: string;
  description: string;
  routeId?: RouteReference;
  effects?: ContentEffect[];
}

export interface EventDefinition {
  id: string;
  name: string;
  description: string;
  contentKind?: EventContentKind;
  anomalyClass?: AnomalyClassId;
  contentTier?: ContentTier;
  routeAffinity?: RouteReference;
  selection?: ContentSelectionProfile;
  options: EventOption[];
}

export interface PickedEventRecord {
  eventId: string;
  optionId: string;
  routeId?: RouteId;
  anomalyClass?: AnomalyClassId;
  contentTier?: ContentTier;
  isHybridPick?: boolean;
  isLatePayoff?: boolean;
  isRedirectPick?: boolean;
}

export interface NodeOption {
  id: string;
  type: NodeType;
  title: string;
  description: string;
  templateId?: BattleTemplateId;
  phase: PhaseId;
  isFinalPrep?: boolean;
  difficultyScale?: number;
  laneIndex?: number;
}

export interface PlayerStats {
  maxHp: number;
  hp: number;
  damage: number;
  fireRate: number;
  projectileSpeed: number;
  critChance: number;
  critMultiplier: number;
  pierce: number;
  multishot: number;
  moveSpeed: number;
  dashInterval: number;
  dashPulseDamage: number;
  dashInvulnerability: number;
  regeneration: number;
}

export interface EnemyState {
  id: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  radius: number;
  elite: boolean;
  role: EnemyRole;
  archetype: EnemyArchetypeId;
  contactDamage: number;
  guardSec: number;
  guardDamageMultiplier: number;
  grazeCooldownSec: number;
  rangedCooldownSec: number;
  recoverySec: number;
  hitFlashSec: number;
  spawnFlashSec: number;
  pressurePulseSec: number;
  tacticCooldownSec: number;
  hitOffsetX: number;
  hitOffsetY: number;
  debugMoveVX: number;
  debugMoveVY: number;
}

export interface BulletState {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  lifeSec: number;
  pierceRemaining: number;
  canEcho: boolean;
  hitCount: number;
  routeFocus?: RouteId;
}

export interface PulseState {
  id: number;
  x: number;
  y: number;
  radius: number;
  lifeSec: number;
  maxLifeSec: number;
  color: number;
  secondaryColor: number;
  fillAlpha: number;
  strokeAlpha: number;
  strokeWidth: number;
  growthPerSec: number;
  innerRadiusRatio: number;
  spokeCount: number;
  spokeLength: number;
  angle: number;
  spinRate: number;
}

export interface ExperienceOrbState {
  id: number;
  x: number;
  y: number;
  value: number;
  velocityX: number;
  velocityY: number;
}

export interface EnemyProjectileState {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  lifeSec: number;
  radius: number;
  respectsSafeWindow?: boolean;
}

export interface PlayerInputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export interface BattleState {
  encounterType: BattleEncounterType;
  templateId: BattleTemplateId;
  label: string;
  description: string;
  durationSec: number;
  remainingSec: number;
  targetKills: number;
  spawnIntervalSec: number;
  enemyHp: number;
  enemySpeed: number;
  difficultyScale: number;
  kills: number;
  elapsedSec: number;
  pressurePhaseIndex: number;
  pressurePhaseElapsedSec: number;
  pressurePhaseLabel?: string;
  pressureTransitionSec: number;
  pressureSignatureLabel?: string;
  pressureSignatureSec: number;
  pressureSignaturePulseSec: number;
  pressurePatternLabel?: string;
  pressurePatternMode?: PressurePatternModeId;
  pressurePatternPulseSec: number;
  pressurePatternFlashSec: number;
  pressurePatternPulseCount: number;
  pressureSafeWindowAxis?: PressureSafeWindowAxis;
  pressureSafeWindowShiftType?: PressurePocketShiftModeId;
  pressureSafeWindowCenter: number;
  pressureSafeWindowSpan: number;
  pressureSafeWindowSecondaryCenter: number;
  pressureSafeWindowSecondarySpan: number;
  pressureSafeWindowSec: number;
  pressurePocketShiftSeen: PressurePocketShiftModeId[];
  nextEnemyId: number;
  nextBulletId: number;
  nextPulseId: number;
  nextEnemyProjectileId: number;
  enemySpawnTimerSec: number;
  eliteSupportCooldownSec: number;
  spawnCursor: number;
  fireCooldownSec: number;
  dashCooldownSec: number;
  invulnerableSec: number;
  impactFreezeSec: number;
  impactFreezeFactor: number;
  enemies: EnemyState[];
  bullets: BulletState[];
  pulses: PulseState[];
  experienceOrbs: ExperienceOrbState[];
  enemyProjectiles: EnemyProjectileState[];
  playerX: number;
  playerY: number;
  playerVelocityX: number;
  playerVelocityY: number;
  playerMoveDirX: number;
  playerMoveDirY: number;
  playerAimDirX: number;
  playerAimDirY: number;
  eliteAlive: boolean;
  eliteSpawned: boolean;
  eliteCrackWindowSec: number;
  eliteCrackEscortCount: number;
  eliteBreachFlashSec: number;
  eliteBreachCalloutCooldownSec: number;
  critOverdriveSec: number;
  critChain: number;
  dashCharge: number;
  dashDriveSec: number;
  playerKnockbackVX: number;
  playerKnockbackVY: number;
  playerImpactSec: number;
  playerRecoverySec: number;
  killFlowSec: number;
  killFlowCount: number;
  pierceFlowSec: number;
  pierceFlowCount: number;
  pickupFlowSec: number;
  pickupFlowCount: number;
  pickupLeadSec: number;
  pickupLeadEnemyId: number | null;
  playerDamageFlashSec: number;
  playerDamageAngle: number;
  cameraShakeSec: number;
  cameraShakeStrength: number;
  tempoPulseSec: number;
  playerShotFlashSec: number;
  playerShotRecoilSec: number;
  playerShotRecoilStrength: number;
  playerMoveBoostSec: number;
  playerTurnBurstSec: number;
  playerNearMissSec: number;
  playerNearMissAngle: number;
  playerNearMissCooldownSec: number;
  lateDashWindowMoments: number;
  dashCounterMoments: number;
  eliteCrackSeen: boolean;
  eliteCrackFollowThroughMoments: number;
  bossFirelineCoverage: number;
  bossSafeWindowMoments: number;
  killPickupContinueMoments: number;
  monitorDashLateMomentCooldownSec: number;
  monitorDashCounterCooldownSec: number;
  monitorEliteCrackFollowThroughCooldownSec: number;
  monitorKillPickupContinueCooldownSec: number;
}

export interface NodeRecord {
  id: string;
  type: NodeType;
  title: string;
}

export interface RunResult {
  outcome: RunOutcome;
  summary: string;
  routeId: RouteId | null;
  buildStage: RouteBuildStage;
  buildLabel: string;
  buildSummary: string;
  endingKind: RunEndingKind;
  endingLabel: string;
  endingReason: string;
  finalNodeTitle: string;
  finalNodeType: NodeType | null;
  runDurationSec: number;
  nodesCleared: number;
  battleWins: number;
  levelReached: number;
  routeTrace: NodeRecord[];
  replayPrompt: string;
}

export interface RunState {
  status: RunStatus;
  phase: PhaseId;
  round: number;
  totalRounds: number;
  level: number;
  experience: number;
  experienceToNext: number;
  queuedLevelUps: number;
  upgradeSource: UpgradeSource | null;
  routeCounts: Record<RouteId, number>;
  committedRoute: RouteId | null;
  maturedRoute: RouteId | null;
  stats: PlayerStats;
  selectedUpgrades: string[];
  eventHistory: PickedEventRecord[];
  traversedNodes: NodeRecord[];
  battleWins: number;
  nodeOptions: NodeOption[];
  currentNode: NodeOption | null;
  upgradeChoices: UpgradeDefinition[];
  currentEvent: EventDefinition | null;
  battle: BattleState | null;
  result: RunResult | null;
}

export interface BattleDebugConfig {
  panelOpen: boolean;
  paused: boolean;
  timeScale: number;
  freezeEnemyMovement: boolean;
  freezeEnemyProjectiles: boolean;
  freezeEnemySpawning: boolean;
  freezePlayerAutoFire: boolean;
  invulnerablePlayer: boolean;
  showEnemyVectors: boolean;
  showProjectileVectors: boolean;
  showCollisionRadii: boolean;
  phase: DebugBattlePhaseId;
  templateId: BattleTemplateId;
}

export interface BattleDebugRuntimeConfig {
  freezeEnemyMovement: boolean;
  freezeEnemyProjectiles: boolean;
  freezeEnemySpawning: boolean;
  freezePlayerAutoFire: boolean;
  invulnerablePlayer: boolean;
}

export interface BattleDebugEnemySnapshot {
  id: number;
  archetype: EnemyArchetypeId;
  role: EnemyRole;
  elite: boolean;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  recoverySec: number;
  pressurePulseSec: number;
  rangedCooldownSec: number;
  moveVX: number;
  moveVY: number;
}

export interface BattleDebugProjectileSnapshot {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  lifeSec: number;
  radius: number;
}

export interface BattleDebugSnapshot {
  status: RunStatus;
  phase: PhaseId;
  templateId: BattleTemplateId | null;
  encounterType: BattleEncounterType | null;
  playerX: number;
  playerY: number;
  playerHp: number;
  playerMaxHp: number;
  enemyCount: number;
  projectileCount: number;
  bulletCount: number;
  orbCount: number;
  eliteAlive: boolean;
  dashDriveSec: number;
  playerTurnBurstSec: number;
  eliteRecoverySec: number;
  elitePressureSec: number;
  eliteCrackWindowSec: number;
  escortCount: number;
  escortRecoveryCount: number;
  escortCrackCount: number;
  enemyProjectileCount: number;
  breachProjectileCount: number;
  breachSuppressionRatio: number;
  pressureSafeWindowAxis: PressureSafeWindowAxis | null;
  pressureSafeWindowCenter: number;
  pressureSafeWindowSpan: number;
  pressureSafeWindowSecondaryCenter: number;
  pressureSafeWindowSecondarySpan: number;
  pressureSafeWindowSec: number;
  pressureSafeWindowCenterDistance: number;
  pressureSafeWindowTravelDistance: number;
  lateDashWindowMoments: number;
  dashCounterMoments: number;
  eliteCrackSeen: boolean;
  eliteCrackFollowThroughMoments: number;
  bossFirelineCoverage: number;
  bossSafeWindowMoments: number;
  killPickupContinueMoments: number;
  enemies: BattleDebugEnemySnapshot[];
  enemyProjectiles: BattleDebugProjectileSnapshot[];
}

export interface OverlayMetaSummary {
  totalRuns: number;
  wins: number;
  lastRouteName: string;
  lastRouteId: RouteId | null;
  lastDurationSec: number;
}

export interface OverlayHudSnapshot {
  phaseLabel: string;
  nodeLabel: string;
  hpText: string;
  hpRatio: number;
  levelText: string;
  experienceText: string;
  experienceRatio: number;
  routeStatusText: string;
  routeProgress: Array<{
    routeId: RouteId;
    label: string;
    value: number;
    color: string;
    active: boolean;
  }>;
  statSummary: Array<{
    label: string;
    value: string;
    tone: 'offense' | 'survival' | 'mobility' | 'utility';
  }>;
  statusText: string;
  statusSubtext?: string;
  progressLabel: string;
  progressDetail: string;
  phaseTrack: Array<{
    label: string;
    state: 'done' | 'active' | 'upcoming' | 'boss-upcoming' | 'boss-active';
  }>;
  objectiveLabel: string;
  objectiveText: string;
  objectiveDetail: string;
  objectiveProgressText: string;
  objectiveTone: 'flow' | 'battle' | 'elite' | 'survive' | 'boss';
}

export interface Services {
  overlay: import('../ui/OverlayController').OverlayController;
  debugPanel: import('../ui/BattleDebugPanel').BattleDebugPanel;
  metrics: import('../systems/MetricsTracker').MetricsTracker;
  meta: import('../systems/MetaProgression').MetaProgression;
  audio: import('../systems/PilotAudio').PilotAudio;
}
