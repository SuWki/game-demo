export type RouteId = 'crit' | 'pierce' | 'dash';
export type RouteReference = RouteId | 'dominant';
export type NodeType = 'battle' | 'upgrade' | 'anomaly' | 'boss';
export type ContentTier = 'standard' | 'rare';
export type BattleEncounterType = 'battle' | 'boss';
export type EventContentKind = 'event' | 'anomaly';
export type AnomalyClassId = 'routeWindow' | 'distortion' | 'hybrid' | 'bossEcho';
export type AnomalyRoleId = 'direction' | 'core' | 'transform' | 'finisher';
export type BattleTemplateId =
  | 'elimination'
  | 'elimination-pincer'
  | 'elimination-sweep'
  | 'elimination-crossline'
  | 'elimination-needle'
  | 'elite'
  | 'elite-vice'
  | 'elite-lockdown'
  | 'elite-screen'
  | 'elite-bulwark'
  | 'elite-pressure-hold'
  | 'elite-contagion'
  | 'elite-gauntlet'
  | 'elite-bridge'
  | 'elite-relay'
  | 'boss-hunt'
  | 'boss-lockdown'
  | 'boss-bastion'
  | 'boss-executioner'
  | 'boss-fortress'
  | 'boss-predator'
  | 'survival'
  | 'survival-crossfire'
  | 'survival-rush'
  | 'survival-gauntlet'
  | 'survival-sieve'
  | 'survival-thread'
  | 'survival-closehold';
export type PhaseId = 'opening' | 'mid' | 'late' | 'finalPrep' | 'finalBattle' | 'ended';
export type RunStatus =
  | 'battle'
  | 'nodeChoice'
  | 'upgradeChoice'
  | 'eventChoice'
  | 'bossEnding'
  | 'battleRewardTransition'
  | 'phaseTransition'
  | 'result';
export type RunOutcome = 'victory' | 'defeat';
export type RouteBuildStage = 'unformed' | 'hinted' | 'committed' | 'matured';
export type RunEndingKind = 'victory' | 'hpDepleted' | 'timeOut';
export type AudioCue =
  | 'click'
  | 'confirm'
  | 'start'
  | 'resume'
  | 'upgrade'
  | 'levelUpReady'
  | 'upgradeEquipped'
  | 'anomaly'
  | 'boss'
  | 'abilityReady'
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
  | 'combo' // Kill streak combo sound
  | 'lowHpWarning'
  | 'routeMatured'
  | 'eliteSpawn'
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
  // 流派机制强化（暴击流）
  critOverdriveCritBonus?: number;  // 超频期间额外暴击率
  critSplashRadius?: number;        // 破绽溅射范围
  flawDurationBonus?: number;       // 破绽持续时间加成
  critOverdriveDurationBonus?: number; // 超频持续时间加成
  // 流派机制强化（穿透流）
  pierceEchoDamageBonus?: number;   // 回响伤害加成
  crackSpreadRadius?: number;       // 裂纹扩散范围
  pierceCooldownRefundBonus?: number; // 穿透冷却缩减加成
  // 流派机制强化（穿梭流）
  dashChargeSpeed?: number;         // 脉冲充能速度加成
  dashCounterDamageBonus?: number;  // 反击伤害加成
  dashGrazeRadiusBonus?: number;     // 擦伤半径加成
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
  gameplayLabel?: string;
  gainLabel?: string;
  costLabel?: string;
  routeId?: RouteReference;
  anomalyRole?: AnomalyRoleId;
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
  eventName?: string;
  optionId: string;
  optionLabel?: string;
  nodeIndex?: number;
  routeId?: RouteId;
  anomalyClass?: AnomalyClassId;
  anomalyRole?: AnomalyRoleId;
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
  // 流派机制属性（暴击流）
  critOverdriveCritBonus: number;
  critSplashRadius: number;
  flawDurationBonus: number;
  critOverdriveDurationBonus: number;
  // 流派机制属性（穿透流）
  pierceEchoDamageBonus: number;
  crackSpreadRadius: number;
  pierceCooldownRefundBonus: number;
  // 流派机制属性（穿梭流）
  dashChargeSpeed: number;
  dashCounterDamageBonus: number;
  dashGrazeRadiusBonus: number;
}

export type RouteHitKind = 'crit' | 'pierce' | 'dash';

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
  // 流派构筑第二轮：敌人状态标记
  critMarkSec: number;
  pierceMarkSec: number;
  dashMarkSec: number;
  lastHitWasCrit: boolean; // 最后一击是否暴击
  lastHitWasPierce: boolean; // 最后一击是否穿透
  lastHitWasDash: boolean; // 最后一击是否为Dash脉冲
  // 流派构筑第三轮：层数积累与命中反馈
  critMarkStacks?: number;
  critMarkBurstReady?: boolean;
  pierceMarkStacks?: number;
  pierceChainHits?: number;
  dashPulseStacks?: number;
  // 命中瞬间特效
  routeHitFlashSec?: number;
  routeHitKind?: RouteHitKind;
  // 流派构筑第四轮：关键牌机制接线状态
  pierceSeamkeepActive?: boolean; // pierce-seamkeep: 裂纹持续时间延长
  pierceFloodgateReady?: boolean; // pierce-floodgate: 裂纹扩散触发
  pierceRiftbloomActive?: boolean; // pierce-riftbloom/prism: 裂纹扩散范围增加
  // 裂纹扩散相关状态
  pierceEchoDamageTaken?: boolean; // 已受到 floodgate 追加伤害
  // Dash 回打窗口状态
  dashCounterWindowSec?: number; // 回打窗口持续时间
  dashMarkedForBonus?: boolean; // 是否被标记为可接受窗口额外伤害
  slowSec?: number; // 减速效果持续时间（Dash冲击波）
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

export interface DamageNumber {
  x: number;
  y: number;
  value: number;
  lifeSec: number;
  maxLifeSec: number;
  kind: 'normal' | 'crit' | 'pierce' | 'dash';
  velocityX: number;
  velocityY: number;
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
  killStreakCount: number;
  killStreakDecaySec: number;
  killStreakMultiplier: number;
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
  cameraShakeFrequency: number;
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
  dashCounterWindowSec: number;
  eliteCrackSeen: boolean;
  eliteCrackFollowThroughMoments: number;
  bossFirelineCoverage: number;
  bossSafeWindowMoments: number;
  bossSafeWindowGraceSec: number;
  outsideSafeDamageTimerSec: number;
  outsideSafeDamageTickCount: number;
  insideSafeProjectileClears: number;
  killPickupContinueMoments: number;
  monitorDashLateMomentCooldownSec: number;
  monitorDashCounterCooldownSec: number;
  monitorEliteCrackFollowThroughCooldownSec: number;
  monitorKillPickupContinueCooldownSec: number;
  // 流派构筑第四轮：路线关键牌机制状态
  pierceSeamkeepActive: boolean;
  pierceFloodgateReady: boolean;
  pierceRiftbloomActive: boolean;
  dashBrushActive: boolean;
  dashSidestepBankActive: boolean;
  dashZeroWindowReady: boolean;
  dashAfterimageReady: boolean;
  // Crit 关键牌机制状态
  critAfterglowActive: boolean;
  critEmbershardActive: boolean;
  critCrownfireReady: boolean;
  // Crit 破绽爆发后短收益窗口
  critBurstBonusSec: number;
  critBurstBonusRatio: number;
  critFocusTargetId: number | null;
  critFocusLockSec: number;
  // Crit路线独特被动状态
  critComboStacks: number; // 破绽累积层数（最多5层）
  critComboDecaySec: number; // 破绽累积衰减计时器
  critFinisherReady: boolean; // 终结打击就绪
  critBurstChainSec: number; // 爆发连锁窗口计时器
  critBurstChainCount: number; // 爆发连锁已触发次数
  // Pierce路线独特被动状态
  pierceFractureMark: Set<number>; // 裂纹标记的敌人ID集合
  pierceChainStacks: number; // 连锁反应层数（每次穿透+1，最多3层）
  pierceChainDecaySec: number; // 连锁反应衰减计时器
  // Dash路线独特被动状态
  dashAfterimages: Array<{ x: number; y: number; lifeSec: number; damage: number }>; // 残影炮塔列表
  dashConsecutiveCount: number; // 连续穿梭计数（3秒内）
  dashConsecutiveWindowSec: number; // 连续穿梭窗口计时器
  dashGhostStrikeReady: boolean; // 幽灵打击就绪（Dash后下次攻击穿透+额外伤害）
  dashMomentumStacks: number; // 动量层数（连续Dash叠加攻速和移速）
  dashMomentumDecaySec: number; // 动量衰减计时器
  damageNumbers: DamageNumber[];
  // 安全区检验机制
  safeZone: SafeZoneState | null;
  safeZoneHintSec: number;       // 战前提示剩余时间
  safeZoneTutorialSec: number;   // 教学文字剩余显示时间
  safeZoneTutorialText: string;  // 教学文字内容
}

export interface SafeZoneState {
  centerX: number;
  centerY: number;
  halfWidth: number;
  halfHeight: number;
  phase: 'warning' | 'active' | 'transition';
  timer: number;                // 当前阶段剩余时间
  warningDuration: number;      // 预警总时间（缓存）
  activeDuration: number;       // 存续总时间（缓存）
  transitionDuration: number;   // 过渡总时间（缓存）
  coverAttackDamage: number;    // 覆盖攻击基础伤害
  coverAttackMultiplier: number; // 覆盖攻击伤害倍率
  shiftMode: 'sweep' | 'edgeBounce' | 'centerReset';
  prevCenterX: number;
  prevCenterY: number;
  cycleCount: number;           // 当前战斗已循环次数
  difficultyTier: number;       // 0=教学 1=前期 2=中期 3=后期 4=狂暴
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
  eventHistory: PickedEventRecord[];
  replayPrompt: string;
  selectedUpgrades: UpgradeDefinition[];
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
  queuedRewardUpgrades: number;
  currentUpgradeIsReward: boolean;
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
  routeMomentText: string | null;
  routeMomentRouteId: RouteId | null;
  routeMomentSec: number;
  // Boss 战结束过渡
  bossEnding?: {
    outcome: 'victory' | 'defeat';
    label: string;
    elapsedSec: number;
    durationSec: number;
  } | null;
  battleRewardTransition?: {
    label: string;
    elapsedSec: number;
    durationSec: number;
  } | null;
  // 关卡结束过渡（战斗→关卡选择）
  phaseTransition?: {
    label: string;
    elapsedSec: number;
    durationSec: number;
  } | null;
  // 升级生效屏幕闪光
  upgradeFlashSec: number;
  // 战斗中升级时先播放短提示，再弹出选择面板，避免遮住升级反馈
  levelUpPanelDelaySec: number;
  // 升级能力变化显示
  lastUpgradeChanges: StatModifiers | null;
  // 流派构筑第四轮：路线关键牌激活状态
  activeRoutePerks?: {
    pierceSeamkeep?: boolean;
    pierceFloodgate?: boolean;
    pierceRiftbloom?: boolean;
    piercePrism?: boolean;
    pierceBreakthrough?: boolean;
    dashBrush?: boolean;
    dashSidestepBank?: boolean;
    dashZeroWindow?: boolean;
    dashAfterimage?: boolean;
    critBridgeFocus?: boolean;
    critAfterglow?: boolean;
    critEmbershard?: boolean;
    critCrownfire?: boolean;
    critLockProtocol?: boolean;
  };
  anomalyNodeSeen: boolean;
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
  hideBossPressureOverlay: boolean; // 隐藏Boss压力遮罩
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
  dashCounterWindowSec: number;
  eliteCrackSeen: boolean;
  eliteCrackFollowThroughMoments: number;
  bossFirelineCoverage: number;
  bossSafeWindowMoments: number;
  bossSafeWindowGraceSec: number;
  outsideSafeDamageTimerSec: number;
  outsideSafeDamageTickCount: number;
  insideSafeProjectileClears: number;
  killPickupContinueMoments: number;
  enemies: BattleDebugEnemySnapshot[];
  enemyProjectiles: BattleDebugProjectileSnapshot[];
  safeZone: {
    active: boolean;
    phase: string;
    centerX: number;
    centerY: number;
    halfWidth: number;
    halfHeight: number;
    timer: number;
    cycleCount: number;
  } | null;
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
  routeMomentText?: string;
  routeMomentRouteId?: RouteId | null;
  routeProgress: Array<{
    routeId: RouteId;
    label: string;
    value: number;
    color: string;
    active: boolean;
    /** 进度文本，如 "3/8" */
    progressText?: string;
    /** 下一个阶段的解锁描述，用于 hover tooltip */
    nextUnlockTooltip?: string;
  }>;
  statSummary: Array<{
    label: string;
    value: string;
    tone: 'offense' | 'survival' | 'mobility' | 'utility';
  }>;
  statusText: string;
  statusSubtext?: string;
  upgradeRewardLabel?: string;
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
  configLoader: import('../systems/ConfigLoader').ConfigLoader;
}

export type QaSmokeRouteId = 'crit' | 'pierce' | 'dash';

export type QaSmokeStageId = 'upgrade' | 'anomaly' | 'battle' | 'result';
export type QaSmokeBattleLevelId = 'bridge' | 'payoff';
export type QaSmokeResultModeId = 'victory' | 'defeat';

export interface QaSmokeScenarioConfig {
  routeId: QaSmokeRouteId;
  stage: QaSmokeStageId;
  anomalyRole?: AnomalyRoleId;
  battleLevel?: QaSmokeBattleLevelId;
  resultMode?: QaSmokeResultModeId;
}
