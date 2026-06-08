import { ARENA_WIDTH, ARENA_HEIGHT, clamp, getSpawnBurstCount } from '../../data/balance';
import { getEnemyArchetype, pickEnemyArchetype } from '../../data/enemyArchetypes';
import type {
  BattleState,
  BattleTemplateDefinition,
  EnemyArchetypeId,
  EliteBehaviorId,
  RunState,
} from '../../game/types';

export interface SpawnParams {
  template: BattleTemplateDefinition;
  battle: BattleState;
  phase: RunState['phase'];
  round: number;
  difficultyScale: number;
  getRegularEnemyHp: (eliteMultiplier?: number) => number;
  getRegularEnemySpeed: (speedMultiplier?: number) => number;
  getContactDamage: (damageMultiplier?: number) => number;
}

export function getAdaptiveSpawnBurstCount(
  template: BattleTemplateDefinition,
  battle: BattleState,
  archetypeCounts: Record<EnemyArchetypeId, number>,
  regularEnemyCap: number | null,
): number {
  let burstCount = getSpawnBurstCount(template);
  if (battle.encounterType !== 'battle' || battle.eliteAlive || regularEnemyCap === null) {
    return burstCount;
  }

  const activeRegularCount = Object.values(archetypeCounts).reduce((sum, value) => sum + value, 0);
  if (regularEnemyCap - activeRegularCount <= burstCount) {
    return burstCount;
  }

  const pattern = template.spawnRule?.pattern ?? 'surround';
  const laneBias = template.spawnRule?.laneBias ?? 'horizontal';
  const isRangedHeavy = isRangedHeavyTemplate(template);
  const isBruteHeavy = isBruteHeavyTemplate(template);
  const isSkirmisherHeavy = isSkirmisherHeavyTemplate(template);
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

export function getAdaptiveSpawnArchetype(
  template: BattleTemplateDefinition,
  archetypeCounts: Record<EnemyArchetypeId, number>,
  activeRegularCount: number,
  burstIndex: number,
): EnemyArchetypeId | undefined {
  const pattern = template.spawnRule?.pattern ?? 'surround';
  const laneBias = template.spawnRule?.laneBias ?? 'horizontal';
  const isRangedHeavy = isRangedHeavyTemplate(template);
  const isBruteHeavy = isBruteHeavyTemplate(template);
  const isSkirmisherHeavy = isSkirmisherHeavyTemplate(template);
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

export function getSpawnPosition(
  battle: BattleState,
  template: BattleTemplateDefinition,
  burstIndex: number,
  view: { left: number; right: number; top: number; bottom: number; width: number; height: number },
): { x: number; y: number } {
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

export interface CreateEnemyOptions {
  hp?: number;
  speed?: number;
  damage?: number;
  radius?: number;
  archetype?: EnemyArchetypeId;
}

export function createArchetypedEnemy(
  battle: BattleState,
  template: BattleTemplateDefinition,
  role: 'regular' | 'escort',
  x: number,
  y: number,
  overrides: CreateEnemyOptions | undefined,
  getRegularEnemyHp: (eliteMultiplier?: number) => number,
  getRegularEnemySpeed: (speedMultiplier?: number) => number,
  getContactDamageFn: (damageMultiplier?: number) => number,
  getRangedShotIntervalSec: (archetypeDef: ReturnType<typeof getEnemyArchetype>, battle: BattleState) => number,
): BattleState['enemies'][number] {
  const baseHp =
    overrides?.hp ??
    getRegularEnemyHp();
  const baseSpeed =
    overrides?.speed ??
    getRegularEnemySpeed();
  const baseDamage =
    overrides?.damage ??
    getContactDamageFn();
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
    rangedCooldownSec: archetypeDef.shotIntervalSec ? 0.45 + Math.random() * getRangedShotIntervalSec(archetypeDef, battle) : 0,
    recoverySec: 0,
    hitFlashSec: 0,
    spawnFlashSec: role === 'escort' ? 0.28 : 0.22,
    pressurePulseSec: 0,
    tacticCooldownSec: 0,
    hitOffsetX: 0,
    hitOffsetY: 0,
    debugMoveVX: 0,
    debugMoveVY: 0,
    critMarkSec: 0,
    pierceMarkSec: 0,
    dashMarkSec: 0,
    lastHitWasCrit: false,
    lastHitWasPierce: false,
    lastHitWasDash: false,
    critMarkStacks: 0,
    pierceMarkStacks: 0,
    dashPulseStacks: 0,
    pierceEchoDamageTaken: false,
    dashCounterWindowSec: 0,
    dashMarkedForBonus: false,
  };
}

export function spawnEliteSupportEnemies(
  battle: BattleState,
  count: number,
  template: BattleTemplateDefinition,
  eliteEnemy: BattleState['enemies'][number] | null,
  activeBehavior: EliteBehaviorId,
  getRegularEnemyHp: (eliteMultiplier?: number) => number,
  getRegularEnemySpeed: (speedMultiplier?: number) => number,
  getContactDamageFn: (damageMultiplier?: number) => number,
  createArchetypedEnemyFn: (
    role: 'regular' | 'escort',
    x: number,
    y: number,
    overrides: CreateEnemyOptions | undefined,
  ) => BattleState['enemies'][number],
): void {
  if (count <= 0) {
    return;
  }

  const escortHp = Math.round(getRegularEnemyHp() * 0.82);
  const escortSpeed = Math.round(getRegularEnemySpeed(1.06));
  const escortDamage = Math.max(6, Math.round(getContactDamageFn(0.92)));
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
    const anchorX = eliteEnemy?.x ?? ARENA_WIDTH / 2;
    const anchorY = eliteEnemy?.y ?? -30;
    const offsetX = Math.cos(screenAngle) * distance;
    const offsetY = Math.sin(screenAngle) * distance;
    const strafeX = -Math.sin(screenAngle) * spread * lateralSpread;
    const strafeY = Math.cos(screenAngle) * spread * lateralSpread;

    const escort = createArchetypedEnemyFn(
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

function isRangedHeavyTemplate(template: BattleTemplateDefinition): boolean {
  return (template.regularArchetypes?.ranged ?? 0) > 0;
}

function isBruteHeavyTemplate(template: BattleTemplateDefinition): boolean {
  return (template.regularArchetypes?.brute ?? 0) > 0;
}

function isSkirmisherHeavyTemplate(template: BattleTemplateDefinition): boolean {
  return (template.regularArchetypes?.skirmisher ?? 0) > 0;
}
