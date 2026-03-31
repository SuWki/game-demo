export type RouteId = 'crit' | 'pierce' | 'dash';
export type NodeType = 'battle' | 'upgrade' | 'event';
export type BattleTemplateId = 'elimination' | 'elite' | 'survival';
export type PhaseId = 'opening' | 'mid' | 'late' | 'finalPrep' | 'finalBattle' | 'ended';
export type RunStatus = 'battle' | 'nodeChoice' | 'upgradeChoice' | 'eventChoice' | 'result';
export type RunOutcome = 'victory' | 'defeat';
export type AudioCue = 'click' | 'upgrade' | 'hit' | 'crit' | 'pressure' | 'result';

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
  targetKills: number;
  spawnIntervalSec: number;
  enemyHp: number;
  enemySpeed: number;
  accent: number;
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

export interface UpgradeDefinition {
  id: string;
  name: string;
  description: string;
  routeId?: RouteId;
  modifiers: StatModifiers;
}

export interface EventOption {
  id: string;
  label: string;
  description: string;
  routeId?: RouteId;
  modifiers?: StatModifiers;
  heal?: number;
}

export interface EventDefinition {
  id: string;
  name: string;
  description: string;
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
