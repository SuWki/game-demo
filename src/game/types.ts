export type RouteId = 'crit' | 'pierce' | 'dash';
export type RouteReference = RouteId | 'dominant';
export type NodeType = 'battle' | 'upgrade' | 'anomaly' | 'boss';
export type ContentTier = 'standard' | 'rare';
export type BattleEncounterType = 'battle' | 'boss';
export type EventContentKind = 'event' | 'anomaly';
export type BattleTemplateId =
  | 'elimination'
  | 'elimination-pincer'
  | 'elimination-sweep'
  | 'elite'
  | 'elite-vice'
  | 'elite-lockdown'
  | 'elite-screen'
  | 'boss-hunt'
  | 'boss-lockdown'
  | 'boss-bastion'
  | 'survival'
  | 'survival-crossfire'
  | 'survival-rush'
  | 'survival-gauntlet';
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
  | 'hit'
  | 'crit'
  | 'pressure'
  | 'victory'
  | 'defeat'
  | 'result';
export type ToastTone = 'neutral' | 'accent' | 'route' | 'danger' | 'success';
export type UpgradeRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type UpgradeSource = 'levelUp' | 'nodePrep';
export type UpgradeCategory = 'generic' | 'route';
export type SpawnPatternId = 'surround' | 'pincers' | 'lanes';
export type EliteBehaviorId = 'frontline' | 'screened' | 'kiting' | 'summoner';
export type EnemyRole = 'regular' | 'escort' | 'elite';
export type EnemyArchetypeId = 'standard' | 'brute' | 'skirmisher' | 'ranged';
export type PressurePatternModeId = 'laneCrush' | 'sideClamp' | 'crossfireWave';
export type PressureSafeWindowAxis = 'vertical' | 'horizontal' | 'pocket';
export type PressurePocketShiftModeId = 'sweep' | 'centerReset' | 'edgeBounce';

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
  contentTier?: ContentTier;
  routeAffinity?: RouteReference;
  selection?: ContentSelectionProfile;
  options: EventOption[];
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
}

export interface PulseState {
  id: number;
  x: number;
  y: number;
  radius: number;
  lifeSec: number;
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
  enemies: EnemyState[];
  bullets: BulletState[];
  pulses: PulseState[];
  experienceOrbs: ExperienceOrbState[];
  enemyProjectiles: EnemyProjectileState[];
  playerX: number;
  playerY: number;
  eliteAlive: boolean;
  eliteSpawned: boolean;
  critOverdriveSec: number;
  critChain: number;
  dashCharge: number;
  dashDriveSec: number;
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
  traversedNodes: NodeRecord[];
  battleWins: number;
  nodeOptions: NodeOption[];
  currentNode: NodeOption | null;
  upgradeChoices: UpgradeDefinition[];
  currentEvent: EventDefinition | null;
  battle: BattleState | null;
  result: RunResult | null;
}

export interface OverlayMetaSummary {
  totalRuns: number;
  wins: number;
  lastRouteName: string;
}

export interface OverlayHudSnapshot {
  phaseLabel: string;
  nodeLabel: string;
  hpText: string;
  levelText: string;
  experienceText: string;
  routeProgress: Array<{
    routeId: RouteId;
    label: string;
    value: number;
    color: string;
    active: boolean;
  }>;
  battleText: string;
  battleSubtext?: string;
}

export interface Services {
  overlay: import('../ui/OverlayController').OverlayController;
  metrics: import('../systems/MetricsTracker').MetricsTracker;
  meta: import('../systems/MetaProgression').MetaProgression;
  audio: import('../systems/PilotAudio').PilotAudio;
}
