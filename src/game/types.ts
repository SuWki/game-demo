export type RouteId = 'crit' | 'pierce' | 'dash';
export type RouteReference = RouteId | 'dominant';
export type NodeType = 'battle' | 'upgrade' | 'event';
export type BattleTemplateId =
  | 'elimination'
  | 'elite'
  | 'elite-lockdown'
  | 'survival'
  | 'survival-rush';
export type PhaseId = 'opening' | 'mid' | 'late' | 'finalPrep' | 'finalBattle' | 'ended';
export type RunStatus = 'battle' | 'nodeChoice' | 'upgradeChoice' | 'eventChoice' | 'result';
export type RunOutcome = 'victory' | 'defeat';
export type RouteBuildStage = 'unformed' | 'hinted' | 'committed' | 'matured';
export type RunEndingKind = 'victory' | 'hpDepleted' | 'timeOut';
export type AudioCue = 'click' | 'upgrade' | 'hit' | 'crit' | 'pressure' | 'result';
export type ToastTone = 'neutral' | 'accent' | 'route' | 'danger' | 'success';

export interface RouteDefinition {
  id: RouteId;
  name: string;
  shortHint: string;
  matureHint: string;
  color: string;
}

export interface BattleTemplateDefinition {
  id: BattleTemplateId;
  name: string;
  description: string;
  durationSec: number;
  spawnIntervalSec: number;
  enemyHp: number;
  enemySpeed: number;
  accent: number;
  winCondition: {
    type: 'kills' | 'elite' | 'survive';
    target?: number;
  };
  eliteRule?: {
    spawnAtSec: number;
    hpMultiplier: number;
    speedMultiplier: number;
    radius: number;
    regularEnemyCap: number;
  };
}

export interface StatModifiers {
  maxHp?: number;
  damage?: number;
  fireRate?: number;
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
  noDominantRouteBonus?: number;
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

export interface UpgradeDefinition {
  id: string;
  name: string;
  description: string;
  routeId?: RouteId;
  tags?: string[];
  selection?: ContentSelectionProfile;
  effects: ContentEffect[];
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
}

export interface PlayerStats {
  maxHp: number;
  hp: number;
  damage: number;
  fireRate: number;
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
  grazeCooldownSec: number;
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

export interface BattleState {
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
  nextEnemyId: number;
  nextBulletId: number;
  nextPulseId: number;
  enemySpawnTimerSec: number;
  fireCooldownSec: number;
  dashCooldownSec: number;
  invulnerableSec: number;
  enemies: EnemyState[];
  bullets: BulletState[];
  pulses: PulseState[];
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
  runDurationSec: number;
  nodesCleared: number;
  battleWins: number;
}

export interface RunState {
  status: RunStatus;
  phase: PhaseId;
  round: number;
  totalRounds: number;
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
  routeProgress: Array<{
    routeId: RouteId;
    label: string;
    value: number;
    color: string;
    active: boolean;
  }>;
  battleText: string;
}

export interface Services {
  overlay: import('../ui/OverlayController').OverlayController;
  metrics: import('../systems/MetricsTracker').MetricsTracker;
  meta: import('../systems/MetaProgression').MetaProgression;
  audio: import('../systems/PilotAudio').PilotAudio;
}
