import type { EnemyArchetypeDefinition, EnemyArchetypeId } from '../game/types';
import { rng } from '../utils/rng';

const DEFAULT_REGULAR_ARCHETYPE_WEIGHTS: Record<EnemyArchetypeId, number> = {
  standard: 2.4,
  brute: 1.2,
  skirmisher: 1.2,
  ranged: 0.55,
};

const DEFAULT_ESCORT_ARCHETYPE_WEIGHTS: Record<EnemyArchetypeId, number> = {
  standard: 1.3,
  brute: 0.6,
  skirmisher: 1.4,
  ranged: 0.9,
};

export const ENEMY_ARCHETYPES: Record<EnemyArchetypeId, EnemyArchetypeDefinition> = {
  standard: {
    id: 'standard',
    name: '\u666e\u901a\u602a',
    hpMultiplier: 1,
    speedMultiplier: 1,
    radiusMultiplier: 1,
    contactDamageMultiplier: 1,
    experienceMultiplier: 1,
  },
  brute: {
    id: 'brute',
    name: '\u539a\u8840\u6162\u901f\u5927\u4f53\u578b\u602a',
    hpMultiplier: 1.85,
    speedMultiplier: 0.7,
    radiusMultiplier: 1.48,
    contactDamageMultiplier: 1.2,
    experienceMultiplier: 1.32,
  },
  skirmisher: {
    id: 'skirmisher',
    name: '\u9ad8\u901f\u8106\u76ae\u602a',
    hpMultiplier: 0.72,
    speedMultiplier: 1.28,
    radiusMultiplier: 0.88,
    contactDamageMultiplier: 0.92,
    experienceMultiplier: 0.95,
    strafeStrength: 0.34,
  },
  ranged: {
    id: 'ranged',
    name: '\u8fdc\u7a0b\u602a',
    hpMultiplier: 0.82,
    speedMultiplier: 0.86,
    radiusMultiplier: 1.02,
    contactDamageMultiplier: 0.74,
    experienceMultiplier: 1.12,
    preferredDistance: 210,
    strafeStrength: 0.24,
    shotIntervalSec: 2.35,
    projectileSpeed: 220,
    projectileDamageMultiplier: 0.76,
    projectileRadius: 5,
  },
};

function pickWeightedArchetype(weights: Record<EnemyArchetypeId, number>): EnemyArchetypeId {
  const entries = Object.entries(weights) as Array<[EnemyArchetypeId, number]>;
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = rng().next() * totalWeight;

  for (const [archetypeId, weight] of entries) {
    roll -= weight;
    if (roll <= 0) {
      return archetypeId;
    }
  }

  return entries[entries.length - 1][0];
}

export function getEnemyArchetype(archetypeId: EnemyArchetypeId): EnemyArchetypeDefinition {
  return ENEMY_ARCHETYPES[archetypeId];
}

export function pickEnemyArchetype(
  weights: Partial<Record<EnemyArchetypeId, number>> | undefined,
  role: 'regular' | 'escort',
): EnemyArchetypeId {
  const baseWeights = role === 'escort' ? DEFAULT_ESCORT_ARCHETYPE_WEIGHTS : DEFAULT_REGULAR_ARCHETYPE_WEIGHTS;
  const mergedWeights: Record<EnemyArchetypeId, number> = {
    standard: weights?.standard ?? baseWeights.standard,
    brute: weights?.brute ?? baseWeights.brute,
    skirmisher: weights?.skirmisher ?? baseWeights.skirmisher,
    ranged: weights?.ranged ?? baseWeights.ranged,
  };

  return pickWeightedArchetype(mergedWeights);
}
