import { estimateUpgradeValue, getUpgradeRarityMultiplier, getUpgradeValueBucket, RARITY_LABEL_MAP } from './balance';
import { ROUTE_NAME_MAP } from './routes';
import type { ContentEffect, StatModifiers, UpgradeArchetype, UpgradeDefinition, UpgradeRarity } from '../game/types';

const RARITY_LIMIT_SCALE: Record<UpgradeRarity, number> = {
  common: 1,
  uncommon: 1.18,
  rare: 1.38,
  epic: 1.62,
  legendary: 1.9,
};

const RARITY_RANK: Record<UpgradeRarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
};

const COUNT_RARITY_BONUS: Record<UpgradeRarity, number> = {
  common: 0,
  uncommon: 0.28,
  rare: 0.56,
  epic: 0.88,
  legendary: 1.24,
};

const CONTINUOUS_RARITY_BONUS: Record<UpgradeRarity, number> = {
  common: 0,
  uncommon: 0.04,
  rare: 0.08,
  epic: 0.13,
  legendary: 0.19,
};

const FINE_RARITY_BONUS: Record<UpgradeRarity, number> = {
  common: 0,
  uncommon: 0.01,
  rare: 0.02,
  epic: 0.03,
  legendary: 0.04,
};

const CONTINUOUS_STAT_KEYS = new Set<keyof StatModifiers>([
  'maxHp',
  'damage',
  'projectileSpeed',
  'moveSpeed',
  'dashPulseDamage',
]);

const COUNT_STAT_KEYS = new Set<keyof StatModifiers>(['pierce', 'multishot']);

function quantizeModifier(key: keyof StatModifiers, value: number, rarity: UpgradeRarity = 'common'): number {
  if (COUNT_STAT_KEYS.has(key)) {
    return Math.max(0, Math.round(value + COUNT_RARITY_BONUS[rarity]));
  }

  if (CONTINUOUS_STAT_KEYS.has(key)) {
    return Number((value + CONTINUOUS_RARITY_BONUS[rarity]).toFixed(1));
  }

  switch (key) {
    case 'critChance':
    case 'fireRate':
    case 'critMultiplier':
    case 'dashInterval':
    case 'dashInvulnerability':
    case 'regeneration':
      return Number((value + FINE_RARITY_BONUS[rarity]).toFixed(2));
    default:
      return Math.round(value + RARITY_RANK[rarity] * 0.06);
  }
}

function scaleEffects(effects: ContentEffect[], rarity: UpgradeRarity): ContentEffect[] {
  const multiplier = getUpgradeRarityMultiplier(rarity);
  return effects.map((effect) => {
    if (effect.type === 'stats') {
      const modifiers = Object.entries(effect.modifiers).reduce((result, [key, rawValue]) => {
        if (typeof rawValue !== 'number') {
          return result;
        }
        const value = quantizeModifier(key as keyof StatModifiers, rawValue * multiplier, rarity);
        if (value !== 0) {
          result[key as keyof StatModifiers] = value;
        }
        return result;
      }, {} as StatModifiers);
      return {
        type: 'stats',
        modifiers,
      };
    }

    if (effect.type === 'heal') {
      return {
        type: 'heal',
        amount: Math.round(effect.amount * multiplier),
      };
    }

    return effect;
  });
}

const GENERIC_PRIMARY_MODIFIER_MAP: Partial<Record<string, keyof StatModifiers>> = {
  'generic-firepower': 'damage',
  'generic-cadence': 'fireRate',
  'generic-ballistics': 'projectileSpeed',
  'generic-optics': 'critChance',
  'generic-reactor': 'critMultiplier',
  'generic-frame': 'maxHp',
  'generic-thrusters': 'moveSpeed',
  'generic-overclock': 'regeneration',
  'generic-vector-buffer': 'moveSpeed',
  'generic-pressure-bypass': 'regeneration',
  'generic-sideband-cache': 'fireRate',
  'generic-open-loop': 'maxHp',
  'generic-crossfeed': 'fireRate',
  'generic-reroute-buffer': 'moveSpeed',
  'generic-relay-throttle': 'fireRate',
  'generic-terminal-weave': 'damage',
  'generic-sightline-cache': 'projectileSpeed',
  'generic-terminal-baffle': 'maxHp',
  'generic-salvo-cache': 'damage',
  'generic-drift-anchor': 'moveSpeed',
  'generic-branch-buffer': 'moveSpeed',
  'generic-last-mile': 'damage',
  'generic-mirror-lattice': 'critChance',
  'generic-borrowed-tail': 'multishot',
  'generic-crown-pocket': 'maxHp',
  'generic-tailfold': 'damage',
  'generic-echo-stow': 'regeneration',
};

const ROUTE_PRIMARY_MODIFIER_PRIORITY: Record<NonNullable<UpgradeArchetype['routeId']>, Array<keyof StatModifiers>> = {
  crit: ['critChance', 'critMultiplier', 'fireRate', 'damage', 'projectileSpeed', 'regeneration', 'moveSpeed'],
  pierce: ['pierce', 'projectileSpeed', 'multishot', 'damage', 'fireRate', 'moveSpeed', 'regeneration'],
  dash: ['dashInterval', 'dashPulseDamage', 'dashInvulnerability', 'moveSpeed', 'regeneration', 'fireRate'],
};

const SINGLE_PRIMARY_MODIFIER_LIMITS: Partial<Record<keyof StatModifiers, number>> = {
  maxHp: 36,
  damage: 7,
  fireRate: 0.42,
  projectileSpeed: 120,
  critChance: 0.12,
  critMultiplier: 0.85,
  pierce: 3,
  multishot: 3,
  moveSpeed: 56,
  dashInterval: 0.78,
  dashPulseDamage: 12,
  dashInvulnerability: 0.18,
  regeneration: 0.24,
};

function estimateStatsOnlyValue(modifiers: StatModifiers): number {
  return estimateUpgradeValue([
    {
      type: 'stats',
      modifiers,
    },
  ]).total;
}

function pickGenericPrimaryModifier(sourceId: string, modifiers: StatModifiers): keyof StatModifiers {
  const preferred = GENERIC_PRIMARY_MODIFIER_MAP[sourceId];
  if (preferred && typeof modifiers[preferred] === 'number' && modifiers[preferred] !== 0) {
    return preferred;
  }

  let bestKey: keyof StatModifiers | null = null;
  let bestValue = Number.NEGATIVE_INFINITY;
  for (const [rawKey, rawValue] of Object.entries(modifiers)) {
    if (typeof rawValue !== 'number' || rawValue === 0) {
      continue;
    }
    const key = rawKey as keyof StatModifiers;
    const valueScore = estimateStatsOnlyValue({ [key]: rawValue } as StatModifiers);
    if (valueScore > bestValue) {
      bestKey = key;
      bestValue = valueScore;
    }
  }

  return bestKey ?? 'damage';
}

function pickRoutePriorityModifier(
  routeId: UpgradeArchetype['routeId'] | 'dominant' | undefined,
  modifiers: StatModifiers,
): keyof StatModifiers | null {
  if (!routeId || routeId === 'dominant') {
    return null;
  }

  for (const key of ROUTE_PRIMARY_MODIFIER_PRIORITY[routeId]) {
    if (typeof modifiers[key] === 'number' && modifiers[key] !== 0) {
      return key;
    }
  }

  return null;
}

function fitSingleModifierToValue(
  key: keyof StatModifiers,
  seedValue: number,
  targetValue: number,
  rarity: UpgradeRarity,
): number {
  if (targetValue <= 0 || seedValue === 0) {
    return seedValue;
  }

  const direction = seedValue < 0 ? -1 : 1;
  const evaluate = (magnitude: number): number =>
    estimateStatsOnlyValue({
      [key]: quantizeModifier(key, direction * magnitude, rarity),
    } as StatModifiers);

  let low = 0;
  let high = Math.max(Math.abs(seedValue), 0.01);
  let highValue = evaluate(high);
  let guard = 0;
  while (highValue < targetValue && guard < 24) {
    high *= 1.35;
    highValue = evaluate(high);
    guard += 1;
  }

  for (let iteration = 0; iteration < 18; iteration += 1) {
    const mid = (low + high) * 0.5;
    const midValue = evaluate(mid);
    if (midValue < targetValue) {
      low = mid;
    } else {
      high = mid;
    }
  }

  const lowModifier = quantizeModifier(key, direction * low, rarity);
  const highModifier = quantizeModifier(key, direction * high, rarity);
  const lowDiff = Math.abs(estimateStatsOnlyValue({ [key]: lowModifier } as StatModifiers) - targetValue);
  const highDiff = Math.abs(estimateStatsOnlyValue({ [key]: highModifier } as StatModifiers) - targetValue);
  const pickedModifier = lowDiff <= highDiff ? lowModifier : highModifier;

  if (pickedModifier === 0) {
    return quantizeModifier(key, seedValue, rarity);
  }
  return pickedModifier;
}

function capSingleModifierValue(key: keyof StatModifiers, value: number, rarity: UpgradeRarity): number {
  const limit = SINGLE_PRIMARY_MODIFIER_LIMITS[key];
  if (typeof limit !== 'number') {
    return value;
  }
  const scaledLimit = limit * RARITY_LIMIT_SCALE[rarity];
  if (value < 0) {
    return quantizeModifier(key, Math.max(value, -scaledLimit));
  }
  return quantizeModifier(key, Math.min(value, scaledLimit));
}

function collectStatModifiers(effects: ContentEffect[]): StatModifiers {
  const modifiers: StatModifiers = {};
  for (const effect of effects) {
    if (effect.type !== 'stats') {
      continue;
    }
    for (const [rawKey, rawValue] of Object.entries(effect.modifiers)) {
      if (typeof rawValue !== 'number' || rawValue === 0) {
        continue;
      }
      const key = rawKey as keyof StatModifiers;
      modifiers[key] = (modifiers[key] ?? 0) + rawValue;
    }
  }
  return modifiers;
}

export function normalizeEffectsToSingleStat(
  sourceId: string,
  effects: ContentEffect[],
  routeId?: UpgradeArchetype['routeId'] | 'dominant',
  rarity: UpgradeRarity = 'common',
): ContentEffect[] {
  const modifiers = collectStatModifiers(effects);
  const modifierEntries = Object.entries(modifiers).filter(([, rawValue]) => typeof rawValue === 'number' && rawValue !== 0);
  if (modifierEntries.length === 0) {
    return effects;
  }

  if (modifierEntries.length <= 1) {
    return effects;
  }

  const primaryKey = pickRoutePriorityModifier(routeId, modifiers) ?? pickGenericPrimaryModifier(sourceId, modifiers);
  const seedValue = modifiers[primaryKey] ?? 0;
  if (seedValue === 0) {
    return effects;
  }

  const statsOnlyEffects = effects.filter((effect): effect is Extract<ContentEffect, { type: 'stats' }> => effect.type === 'stats');
  const targetValue = estimateUpgradeValue(statsOnlyEffects).total;
  const fittedValue = capSingleModifierValue(
    primaryKey,
    fitSingleModifierToValue(primaryKey, seedValue, targetValue, rarity),
    rarity,
  );
  const normalizedStatsEffect: Extract<ContentEffect, { type: 'stats' }> = {
    type: 'stats',
    modifiers: {
      [primaryKey]: fittedValue,
    },
  };

  let inserted = false;
  const normalizedEffects: ContentEffect[] = [];
  for (const effect of effects) {
    if (effect.type === 'stats') {
      if (!inserted) {
        normalizedEffects.push(normalizedStatsEffect);
        inserted = true;
      }
      continue;
    }

    if (effect.type === 'heal') {
      normalizedEffects.push({
        type: 'heal',
        amount: effect.amount,
      });
      continue;
    }

    normalizedEffects.push({
      ...effect,
    });
  }

  return normalizedEffects;
}

function formatModifierLabel(key: keyof StatModifiers, value: number): string {
  const sign = value > 0 ? '+' : '';
  const seconds = (amount: number) => `${sign}${amount.toFixed(1)}秒`;
  switch (key) {
    case 'maxHp':
      return `生命上限 ${sign}${Math.round(value)}`;
    case 'damage':
      return `伤害 ${sign}${Math.round(value)}`;
    case 'fireRate':
      return `射速 ${sign}${Math.round(value * 60)}/分`;
    case 'projectileSpeed':
      return `弹速 ${sign}${Math.round(value)}`;
    case 'critChance':
      return `暴击率 ${sign}${Math.round(value * 100)}%（每次命中概率触发更高伤害）`;
    case 'critMultiplier':
      return `暴击伤害 ${sign}${Math.round(value * 100)}%`;
    case 'pierce':
      return `穿透 ${sign}${Math.round(value)}（命中后继续打击后方敌人）`;
    case 'multishot':
      return `额外弹道 ${sign}${Math.round(value)}`;
    case 'moveSpeed':
      return `移速 ${sign}${Math.round(value)}`;
    case 'dashInterval':
      return `穿梭冷却 ${seconds(value)}（缩短下一次自动脉冲的等待时间）`;
    case 'dashPulseDamage':
      return `脉冲伤害 ${sign}${Math.round(value)}`;
    case 'dashInvulnerability':
      return `无伤窗口 ${seconds(value)}（穿梭触发后短时间不受伤害）`;
    case 'regeneration':
      return `每10秒回复 ${sign}${Math.round(value * 10)}`;
    default:
      return `${key} ${sign}${Math.round(value)}`;
  }
}

export function describeContentEffects(
  effects: ContentEffect[],
  routeId?: UpgradeArchetype['routeId'],
  options?: {
    includeRouteProgress?: boolean;
  },
): string {
  const segments: string[] = [];

  for (const effect of effects) {
    if (effect.type === 'stats') {
      segments.push(
        ...Object.entries(effect.modifiers).map(([key, value]) => formatModifierLabel(key as keyof StatModifiers, value as number)),
      );
      continue;
    }

    if (effect.type === 'heal') {
      if (effect.amount > 0) {
        segments.push(`恢复 ${effect.amount} 点耐久`);
      } else {
        segments.push(`承受 ${Math.abs(effect.amount)} 点压力伤害`);
      }
      continue;
    }

    if (effect.routeId !== 'dominant') {
      segments.push(`${ROUTE_NAME_MAP[effect.routeId]}路线推进 +1`);
    }
  }

  if (routeId && !segments.some((segment) => segment.includes('路线推进'))) {
    segments.push(`${ROUTE_NAME_MAP[routeId]}路线推进 +1`);
  }

  return segments.join('，');
}

export const UPGRADE_ARCHETYPES: UpgradeArchetype[] = [
  {
    id: 'generic-firepower',
    name: '火控强化',
    description: '提升武器火力输出',
    category: 'generic',
    repeatable: true,
    tags: ['stabilizer'],
    selection: {
      baseWeight: 4,
      noDominantRouteBonus: 2,
      finalPrepBonus: 2,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          damage: 3,
        },
      },
    ],
  },
  {
    id: 'generic-cadence',
    name: '压缩射频',
    description: '加快武器射击频率',
    category: 'generic',
    repeatable: true,
    tags: ['stabilizer'],
    selection: {
      baseWeight: 4,
      noDominantRouteBonus: 2,
      finalPrepBonus: 3,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          fireRate: 0.22,
        },
      },
    ],
  },
  {
    id: 'generic-ballistics',
    name: '弹道校正',
    description: '提升弹速与火力',
    category: 'generic',
    repeatable: true,
    tags: ['stabilizer'],
    selection: {
      baseWeight: 3,
      minRound: 1,
      finalPrepBonus: 2,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          projectileSpeed: 26,
          damage: 1.5,
        },
      },
    ],
  },
  {
    id: 'generic-optics',
    name: '精密镜组',
    description: '提高暴击命中率',
    category: 'generic',
    repeatable: true,
    tags: ['stabilizer'],
    selection: {
      baseWeight: 3,
      maxRound: 3,
      noDominantRouteBonus: 3,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          critChance: 0.05,
        },
      },
    ],
  },
  {
    id: 'generic-reactor',
    name: '爆伤蓄能',
    description: '增强暴击伤害',
    category: 'generic',
    repeatable: true,
    tags: ['stabilizer'],
    selection: {
      baseWeight: 3,
      minRound: 2,
      finalPrepBonus: 3,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          critMultiplier: 0.22,
        },
      },
    ],
  },
  {
    id: 'generic-frame',
    name: '强化骨架',
    description: '提升耐久上限并修复损伤',
    category: 'generic',
    repeatable: true,
    tags: ['stabilizer'],
    selection: {
      baseWeight: 4,
      noDominantRouteBonus: 2,
      finalPrepBonus: 4,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          maxHp: 12,
        },
      },
      {
        type: 'heal',
        amount: 12,
      },
    ],
  },
  {
    id: 'generic-thrusters',
    name: '矢量喷口',
    description: '提升机动速度',
    category: 'generic',
    repeatable: true,
    tags: ['stabilizer'],
    selection: {
      baseWeight: 3,
      noDominantRouteBonus: 2,
      finalPrepBonus: 2,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          moveSpeed: 15,
        },
      },
    ],
  },
  {
    id: 'generic-overclock',
    name: '循环稳态',
    description: '增强自我修复能力',
    category: 'generic',
    repeatable: true,
    tags: ['stabilizer', 'bridge'],
    selection: {
      baseWeight: 2,
      minRound: 2,
      finalPrepBonus: 4,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          regeneration: 0.12,
          fireRate: 0.09,
        },
      },
    ],
  },
  {
    id: 'generic-vector-buffer',
    name: '矢量缓冲',
    description: '平衡提升射速、移速与弹速',
    category: 'generic',
    repeatable: true,
    tags: ['stabilizer', 'bridge'],
    selection: {
      baseWeight: 3.4,
      minRound: 1,
      maxRound: 3,
      phaseBonuses: {
        opening: 0.8,
        mid: 1.2,
      },
      noDominantRouteBonus: 2.4,
      finalPrepBonus: 1.2,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          fireRate: 0.12,
          moveSpeed: 12,
          projectileSpeed: 14,
        },
      },
    ],
  },
  {
    id: 'generic-pressure-bypass',
    name: '压差旁路',
    description: '强化生存能力并修复损伤',
    category: 'generic',
    repeatable: true,
    tags: ['stabilizer', 'bridge'],
    selection: {
      baseWeight: 3.1,
      minRound: 2,
      phaseBonuses: {
        mid: 1.2,
        late: 0.8,
        finalPrep: 0.8,
      },
      finalPrepBonus: 2.6,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          maxHp: 8,
          regeneration: 0.09,
          moveSpeed: 8,
        },
      },
      {
        type: 'heal',
        amount: 10,
      },
    ],
  },
  {
    id: 'generic-sideband-cache',
    name: '侧频缓存',
    description: '综合提升射速、弹速与机动',
    category: 'generic',
    repeatable: true,
    tags: ['stabilizer', 'bridge', 'hybrid'],
    selection: {
      baseWeight: 2.6,
      minRound: 2,
      maxRound: 4,
      phaseBonuses: {
        mid: 1.4,
        late: 1,
        finalPrep: 0.8,
      },
      noDominantRouteBonus: 1.4,
      finalPrepBonus: 1.4,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          fireRate: 0.1,
          projectileSpeed: 18,
          moveSpeed: 9,
        },
      },
    ],
  },
  {
    id: 'generic-open-loop',
    name: '开环余量',
    description: '提升耐久与恢复能力',
    category: 'generic',
    repeatable: true,
    tags: ['stabilizer', 'bridge', 'hybrid'],
    selection: {
      baseWeight: 2.4,
      minRound: 2,
      maxRound: 4,
      phaseBonuses: {
        mid: 1.3,
        late: 1,
        finalPrep: 1,
      },
      finalPrepBonus: 1.6,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          maxHp: 6,
          regeneration: 0.07,
          moveSpeed: 7,
        },
      },
      {
        type: 'heal',
        amount: 8,
      },
    ],
  },
  {
    id: 'generic-crossfeed',
    name: '交叉回授',
    description: '全面提升性能并修复损伤',
    category: 'generic',
    repeatable: true,
    tags: ['stabilizer', 'bridge', 'hybrid'],
    selection: {
      baseWeight: 2.7,
      minRound: 2,
      maxRound: 4,
      phaseBonuses: {
        mid: 1.6,
        late: 1.1,
      },
      noDominantRouteBonus: 0.8,
      finalPrepBonus: 0.8,
      excludeFromFinalPrep: true,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          fireRate: 0.09,
          projectileSpeed: 15,
          moveSpeed: 9,
        },
      },
      {
        type: 'heal',
        amount: 6,
      },
    ],
  },
  {
    id: 'generic-reroute-buffer',
    name: '改道缓冲',
    description: '均衡强化生存与机动',
    category: 'generic',
    repeatable: true,
    tags: ['stabilizer', 'bridge', 'hybrid'],
    selection: {
      baseWeight: 2.7,
      minRound: 2,
      maxRound: 4,
      phaseBonuses: {
        mid: 1.5,
        late: 0.8,
      },
      noDominantRouteBonus: 1.1,
      finalPrepBonus: 0.8,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          maxHp: 4.5,
          regeneration: 0.06,
          moveSpeed: 9,
          projectileSpeed: 12,
        },
      },
      {
        type: 'heal',
        amount: 10,
      },
    ],
  },
  {
    id: 'generic-relay-throttle',
    name: '并线节流',
    description: '提升射速与弹道性能',
    category: 'generic',
    repeatable: true,
    tags: ['stabilizer', 'bridge', 'hybrid'],
    selection: {
      baseWeight: 2.6,
      minRound: 2,
      maxRound: 4,
      phaseBonuses: {
        mid: 1.4,
        late: 0.9,
      },
      finalPrepBonus: 0.9,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          damage: 2.2,
          fireRate: 0.1,
          projectileSpeed: 12,
          moveSpeed: 6,
        },
      },
    ],
  },
  {
    id: 'generic-terminal-weave',
    name: '终段并轨',
    description: '全面强化战斗性能',
    category: 'generic',
    contentTier: 'rare',
    repeatable: true,
    tags: ['bridge', 'payoff', 'hybrid', 'rare'],
    selection: {
      baseWeight: 0.94,
      minRound: 3,
      phaseBonuses: {
        late: 1.6,
        finalPrep: 2.2,
        finalBattle: 1.2,
      },
      finalPrepBonus: 2.2,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          damage: 3,
          fireRate: 0.16,
          projectileSpeed: 24,
          moveSpeed: 14,
          regeneration: 0.12,
        },
      },
    ],
  },
  {
    id: 'generic-sightline-cache',
    name: '视界缓存',
    description: '提升火力与弹道精度',
    category: 'generic',
    repeatable: true,
    tags: ['bridge', 'stabilizer'],
    selection: {
      baseWeight: 2.8,
      minRound: 2,
      maxRound: 4,
      phaseBonuses: {
        mid: 1.3,
        late: 1.1,
        finalPrep: 0.9,
      },
      noDominantRouteBonus: 1.2,
      finalPrepBonus: 1.4,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          damage: 1.5,
          projectileSpeed: 21,
          moveSpeed: 8,
        },
      },
    ],
  },
  {
    id: 'generic-terminal-baffle',
    name: '终端护幕',
    description: '大幅强化生存与火力',
    category: 'generic',
    contentTier: 'rare',
    repeatable: true,
    tags: ['bridge', 'payoff', 'rare'],
    selection: {
      baseWeight: 0.92,
      minRound: 3,
      phaseBonuses: {
        late: 1.3,
        finalPrep: 2.3,
        finalBattle: 1.1,
      },
      finalPrepBonus: 2.4,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          maxHp: 9,
          regeneration: 0.09,
          damage: 2.2,
          projectileSpeed: 14,
        },
      },
      {
        type: 'heal',
        amount: 10,
      },
    ],
  },
  {
    id: 'generic-salvo-cache',
    name: '齐射缓存',
    description: '强化火力与射速',
    category: 'generic',
    repeatable: true,
    tags: ['stabilizer', 'bridge'],
    selection: {
      baseWeight: 3.3,
      minRound: 1,
      maxRound: 3,
      phaseBonuses: {
        opening: 0.9,
        mid: 1.1,
      },
      noDominantRouteBonus: 1.8,
      finalPrepBonus: 1.2,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          damage: 2.2,
          fireRate: 0.09,
          projectileSpeed: 14,
        },
      },
    ],
  },
  {
    id: 'generic-drift-anchor',
    name: '漂移定舵',
    description: '均衡提升生存与机动',
    category: 'generic',
    repeatable: true,
    tags: ['stabilizer', 'bridge', 'hybrid'],
    selection: {
      baseWeight: 2.6,
      minRound: 2,
      maxRound: 4,
      phaseBonuses: {
        mid: 1.5,
        late: 0.9,
        finalPrep: 0.7,
      },
      noDominantRouteBonus: 1.3,
      finalPrepBonus: 1.1,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          maxHp: 4.5,
          moveSpeed: 10,
          fireRate: 0.06,
          regeneration: 0.06,
        },
      },
      {
        type: 'heal',
        amount: 6,
      },
    ],
  },
  {
    id: 'generic-branch-buffer',
    name: '支路缓冲',
    description: '提升火力、弹速与机动',
    category: 'generic',
    repeatable: true,
    tags: ['bridge', 'hybrid'],
    selection: {
      baseWeight: 2.5,
      minRound: 2,
      maxRound: 4,
      phaseBonuses: {
        mid: 1.4,
        late: 1,
        finalPrep: 0.8,
      },
      noDominantRouteBonus: 1.5,
      finalPrepBonus: 1.2,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          damage: 1.5,
          projectileSpeed: 15,
          moveSpeed: 9,
        },
      },
    ],
  },
  {
    id: 'generic-last-mile',
    name: '终段余量',
    description: '大幅提升生存与火力',
    category: 'generic',
    contentTier: 'rare',
    repeatable: true,
    tags: ['bridge', 'payoff', 'rare'],
    selection: {
      baseWeight: 0.94,
      minRound: 3,
      phaseBonuses: {
        late: 1.45,
        finalPrep: 2.15,
        finalBattle: 1.2,
      },
      finalPrepBonus: 2.2,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          maxHp: 7.5,
          damage: 3,
          fireRate: 0.08,
          regeneration: 0.11,
        },
      },
      {
        type: 'heal',
        amount: 6,
      },
    ],
  },
  {
    id: 'generic-mirror-lattice',
    name: '镜格并流',
    description: '提升火力与暴击精度',
    category: 'generic',
    repeatable: true,
    tags: ['bridge', 'hybrid'],
    selection: {
      baseWeight: 2.45,
      minRound: 2,
      maxRound: 4,
      phaseBonuses: {
        mid: 1.35,
        late: 1.05,
        finalPrep: 0.78,
      },
      noDominantRouteBonus: 0.9,
      finalPrepBonus: 1,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          damage: 1.5,
          critChance: 0.04,
          projectileSpeed: 14,
          moveSpeed: 8,
        },
      },
    ],
  },
  {
    id: 'generic-borrowed-tail',
    name: '借尾并幅',
    description: '大幅强化火力与弹幕',
    category: 'generic',
    contentTier: 'rare',
    repeatable: true,
    tags: ['bridge', 'payoff', 'hybrid', 'rare'],
    selection: {
      baseWeight: 0.9,
      minRound: 3,
      phaseBonuses: {
        late: 1.75,
        finalPrep: 2.1,
        finalBattle: 1.2,
      },
      finalPrepBonus: 2.2,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          damage: 3,
          fireRate: 0.11,
          multishot: 1,
          moveSpeed: 8,
        },
      },
    ],
  },
  {
    id: 'generic-crown-pocket',
    name: '余波护仓',
    description: '强化生存与恢复能力',
    category: 'generic',
    contentTier: 'rare',
    repeatable: true,
    tags: ['payoff', 'rare'],
    selection: {
      baseWeight: 0.88,
      minRound: 3,
      phaseBonuses: {
        late: 1.42,
        finalPrep: 2.05,
        finalBattle: 1.05,
      },
      finalPrepBonus: 2.1,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          maxHp: 7.5,
          regeneration: 0.12,
          projectileSpeed: 14,
          moveSpeed: 6,
        },
      },
      {
        type: 'heal',
        amount: 10,
      },
    ],
  },
  {
    id: 'generic-tailfold',
    name: '尾流归并',
    description: '全面提升火力与射速',
    category: 'generic',
    contentTier: 'rare',
    repeatable: true,
    tags: ['bridge', 'payoff', 'hybrid', 'rare'],
    selection: {
      baseWeight: 0.86,
      minRound: 3,
      phaseBonuses: {
        late: 1.72,
        finalPrep: 2.12,
        finalBattle: 1.12,
      },
      finalPrepBonus: 2.25,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          damage: 2,
          fireRate: 0.09,
          projectileSpeed: 14,
          moveSpeed: 9,
        },
      },
    ],
  },
  {
    id: 'generic-echo-stow',
    name: '余响备压',
    description: '提升生存与恢复能力',
    category: 'generic',
    contentTier: 'rare',
    repeatable: true,
    tags: ['payoff', 'rare'],
    selection: {
      baseWeight: 0.84,
      minRound: 3,
      phaseBonuses: {
        late: 1.48,
        finalPrep: 2.08,
        finalBattle: 1.05,
      },
      finalPrepBonus: 2.15,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          maxHp: 6,
          regeneration: 0.12,
          projectileSpeed: 15,
          moveSpeed: 7.5,
        },
      },
      {
        type: 'heal',
        amount: 8,
      },
    ],
  },
  {
    id: 'generic-last-lock',
    name: '终段封板',
    description: '大幅强化火力输出',
    category: 'generic',
    contentTier: 'rare',
    repeatable: true,
    tags: ['payoff', 'rare'],
    selection: {
      baseWeight: 0.92,
      minRound: 3,
      phaseBonuses: {
        late: 1.56,
        finalPrep: 2.36,
        finalBattle: 1.08,
      },
      finalPrepBonus: 2.45,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          maxHp: 8,
          damage: 2.2,
          regeneration: 0.08,
          projectileSpeed: 12,
        },
      },
      {
        type: 'heal',
        amount: 8,
      },
    ],
  },
  {
    id: 'crit-aim',
    name: '聚焦瞄准',
    description: '命中时概率触发高伤，适合抓短窗爆发',
    category: 'route',
    routeId: 'crit',
    tags: ['starter'],
    selection: {
      baseWeight: 6,
      maxRound: 2,
      phaseBonuses: {
        opening: 1.5,
        mid: 0.4,
      },
      noDominantRouteBonus: 8,
      hintedRouteBonus: 1.8,
      dominantRouteBonus: 2.8,
      offRouteMultiplier: 0.22,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          critChance: 0.05,
          critMultiplier: 0.15,
        },
      },
      {
        type: 'route',
        routeId: 'crit',
      },
    ],
  },
  {
    id: 'crit-primer',
    name: '升温预热',
    description: '命中时概率触发高伤，适合抓短窗爆发',
    category: 'route',
    routeId: 'crit',
    tags: ['starter'],
    selection: {
      baseWeight: 5.4,
      maxRound: 2,
      phaseBonuses: {
        opening: 1.6,
        mid: 0.5,
      },
      noDominantRouteBonus: 7.5,
      hintedRouteBonus: 1.8,
      dominantRouteBonus: 2.6,
      offRouteMultiplier: 0.22,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          critChance: 0.045,
          critMultiplier: 0.18,
        },
      },
      {
        type: 'route',
        routeId: 'crit',
      },
    ],
  },
  {
    id: 'crit-afterglow',
    name: '余热描边',
    description: '暴击与弹速强化',
    category: 'route',
    routeId: 'crit',
    tags: ['bridge'],
    selection: {
      baseWeight: 3.96,
      minRound: 2,
      maxRound: 3,
      phaseBonuses: {
        mid: 1.54,
        late: 0.4,
      },
      hintedRouteBonus: 2.42,
      dominantRouteBonus: 3.98,
      committedRouteBonus: 1.8,
      offRouteMultiplier: 0.38,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          critChance: 0.038,
          projectileSpeed: 18,
        },
      },
      {
        type: 'route',
        routeId: 'crit',
      },
      {
        type: 'route',
        routeId: 'crit',
      },
      {
        type: 'route',
        routeId: 'crit',
      },
    ],
  },
  {
    id: 'crit-heat-latch',
    name: '续热点火',
    description: '暴击与暴伤核心提升',
    category: 'route',
    routeId: 'crit',
    tags: ['bridge'],
    selection: {
      baseWeight: 3.94,
      minRound: 2,
      maxRound: 3,
      phaseBonuses: {
        mid: 1.58,
        late: 0.42,
      },
      hintedRouteBonus: 2.5,
      dominantRouteBonus: 4.22,
      committedRouteBonus: 1.98,
      offRouteMultiplier: 0.36,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          critChance: 0.032,
          critMultiplier: 0.22,
        },
      },
      {
        type: 'route',
        routeId: 'crit',
      },
      {
        type: 'route',
        routeId: 'crit',
      },
      {
        type: 'route',
        routeId: 'crit',
      },
    ],
  },
  {
    id: 'crit-flare-path',
    name: '灼迹导火',
    description: '暴击与弹速强化',
    category: 'route',
    routeId: 'crit',
    tags: ['bridge', 'payoff'],
    selection: {
      baseWeight: 3.1,
      minRound: 2,
      phaseBonuses: {
        mid: 1.2,
        late: 1,
        finalPrep: 0.5,
      },
      hintedRouteBonus: 1.1,
      dominantRouteBonus: 4.1,
      committedRouteBonus: 2.8,
      maturedRouteBonus: 1.1,
      finalPrepBonus: 1.2,
      offRouteMultiplier: 0.34,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          critChance: 0.042,
          critMultiplier: 0.16,
          projectileSpeed: 18,
        },
      },
      {
        type: 'route',
        routeId: 'crit',
      },
    ],
  },
  {
    id: 'crit-sidechannel',
    name: '旁路升温',
    description: '暴击与弹速提升',
    category: 'route',
    routeId: 'crit',
    tags: ['bridge', 'redirect'],
    selection: {
      baseWeight: 2.25,
      minRound: 2,
      maxRound: 4,
      phaseBonuses: {
        mid: 2.1,
        late: 1,
      },
      hintedRouteBonus: 0.05,
      dominantRouteBonus: 0.15,
      committedRouteBonus: 0.1,
      offRouteMultiplier: 2.05,
      excludeFromFinalPrep: true,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          critChance: 0.045,
          projectileSpeed: 18,
        },
      },
      {
        type: 'route',
        routeId: 'crit',
      },
      {
        type: 'route',
        routeId: 'crit',
      },
    ],
  },
  {
    id: 'crit-reroute-spark',
    name: '借火切入',
    description: '火力、暴击与弹速提升，并修复损伤',
    category: 'route',
    routeId: 'crit',
    tags: ['bridge', 'redirect'],
    selection: {
      baseWeight: 1.95,
      minRound: 2,
      maxRound: 4,
      phaseBonuses: {
        mid: 1.9,
        late: 0.85,
      },
      hintedRouteBonus: 0.04,
      dominantRouteBonus: 0.12,
      committedRouteBonus: 0.08,
      offRouteMultiplier: 2.3,
      excludeFromFinalPrep: true,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          critChance: 0.045,
          critMultiplier: 0.14,
          projectileSpeed: 16,
        },
      },
      {
        type: 'heal',
        amount: 6,
      },
      {
        type: 'route',
        routeId: 'crit',
      },
      {
        type: 'route',
        routeId: 'crit',
      },
    ],
  },
  {
    id: 'crit-reroute-feed',
    name: '借焰续拍',
    description: '暴击提升，并修复损伤',
    category: 'route',
    routeId: 'crit',
    tags: ['bridge', 'redirect'],
    selection: {
      baseWeight: 1.78,
      minRound: 2,
      maxRound: 4,
      phaseBonuses: {
        mid: 1.82,
        late: 0.92,
      },
      hintedRouteBonus: 0.04,
      dominantRouteBonus: 0.12,
      committedRouteBonus: 0.08,
      offRouteMultiplier: 2.34,
      excludeFromFinalPrep: true,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          critChance: 0.055,
          critMultiplier: 0.22,
        },
      },
      {
        type: 'heal',
        amount: 6,
      },
      {
        type: 'route',
        routeId: 'crit',
      },
      {
        type: 'route',
        routeId: 'crit',
      },
    ],
  },
  {
    id: 'crit-branch-ignite',
    name: '借爆并焰',
    description: '暴击、射速与机动提升，并修复损伤',
    category: 'route',
    routeId: 'crit',
    tags: ['bridge', 'redirect'],
    selection: {
      baseWeight: 1.88,
      minRound: 2,
      maxRound: 4,
      phaseBonuses: {
        mid: 1.75,
        late: 1,
      },
      hintedRouteBonus: 0.04,
      dominantRouteBonus: 0.12,
      committedRouteBonus: 0.08,
      offRouteMultiplier: 2.26,
      excludeFromFinalPrep: true,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          critChance: 0.065,
          critMultiplier: 0.25,
        },
      },
      {
        type: 'heal',
        amount: 6,
      },
      {
        type: 'route',
        routeId: 'crit',
      },
      {
        type: 'route',
        routeId: 'crit',
      },
    ],
  },
  {
    id: 'crit-embershard',
    name: '余烬爆点',
    description: '火力、暴击系统与机动的极限强化',
    category: 'route',
    contentTier: 'rare',
    routeId: 'crit',
    tags: ['payoff', 'finisher', 'rare'],
    selection: {
      baseWeight: 1.02,
      minRound: 3,
      phaseBonuses: {
        late: 1.45,
        finalPrep: 2.1,
        finalBattle: 2.2,
      },
      hintedRouteBonus: 0.2,
      dominantRouteBonus: 3.9,
      committedRouteBonus: 3.5,
      maturedRouteBonus: 2.3,
      finalPrepBonus: 2.3,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          critChance: 0.045,
          critMultiplier: 0.28,
        },
      },
      {
        type: 'route',
        routeId: 'crit',
      },
    ],
  },
  {
    id: 'crit-burst',
    name: '连发校准',
    description: '暴击率与暴伤提升',
    category: 'route',
    routeId: 'crit',
    tags: ['bridge'],
    selection: {
      baseWeight: 4,
      minRound: 2,
      phaseBonuses: {
        mid: 1.4,
        late: 0.6,
      },
      hintedRouteBonus: 2.1,
      dominantRouteBonus: 4.2,
      committedRouteBonus: 2.2,
      finalPrepBonus: 2,
      offRouteMultiplier: 0.42,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          critChance: 0.055,
          critMultiplier: 0.22,
        },
      },
      {
        type: 'route',
        routeId: 'crit',
      },
    ],
  },
  {
    id: 'crit-sparkline',
    name: '火迹预压',
    description: '暴击率与暴伤双重提升',
    category: 'route',
    routeId: 'crit',
    tags: ['bridge'],
    selection: {
      baseWeight: 3.6,
      minRound: 2,
      maxRound: 4,
      phaseBonuses: {
        mid: 1.5,
        late: 0.7,
      },
      hintedRouteBonus: 2.2,
      dominantRouteBonus: 3.9,
      committedRouteBonus: 1.8,
      offRouteMultiplier: 0.38,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          critChance: 0.042,
          critMultiplier: 0.18,
        },
      },
      {
        type: 'route',
        routeId: 'crit',
      },
    ],
  },
  {
    id: 'crit-linekeep',
    name: '压线留焰',
    description: '暴击与弹道强化',
    category: 'route',
    routeId: 'crit',
    tags: ['bridge'],
    selection: {
      baseWeight: 3.78,
      minRound: 2,
      maxRound: 4,
      phaseBonuses: {
        mid: 1.58,
        late: 0.92,
        finalPrep: 0.28,
      },
      hintedRouteBonus: 1.82,
      dominantRouteBonus: 4.52,
      committedRouteBonus: 3.88,
      maturedRouteBonus: 1.56,
      finalPrepBonus: 0.72,
      offRouteMultiplier: 0.28,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          critChance: 0.042,
          projectileSpeed: 18,
          critMultiplier: 0.16,
        },
      },
      {
        type: 'route',
        routeId: 'crit',
      },
    ],
  },
  {
    id: 'crit-crownfire',
    name: '冠火收束',
    description: '火力、暴击系统与机动的终极强化',
    category: 'route',
    contentTier: 'rare',
    routeId: 'crit',
    tags: ['payoff', 'finisher', 'rare'],
    selection: {
      baseWeight: 1.01,
      minRound: 3,
      phaseBonuses: {
        late: 1.5,
        finalPrep: 2.15,
        finalBattle: 2.2,
      },
      hintedRouteBonus: 0.2,
      dominantRouteBonus: 4,
      committedRouteBonus: 3.7,
      maturedRouteBonus: 2.5,
      finalPrepBonus: 2.3,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          critChance: 0.038,
          critMultiplier: 0.32,
        },
      },
      {
        type: 'route',
        routeId: 'crit',
      },
    ],
  },
  {
    id: 'crit-ember-rail',
    name: '灼链追爆',
    description: '暴击与暴伤的强力组合',
    category: 'route',
    routeId: 'crit',
    tags: ['bridge', 'payoff'],
    selection: {
      baseWeight: 3.05,
      minRound: 3,
      phaseBonuses: {
        late: 1.65,
        finalPrep: 0.95,
        finalBattle: 0.72,
      },
      hintedRouteBonus: 0.45,
      dominantRouteBonus: 4.7,
      committedRouteBonus: 4.1,
      maturedRouteBonus: 2.1,
      finalPrepBonus: 1.9,
      offRouteMultiplier: 0.3,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          critChance: 0.038,
          critMultiplier: 0.22,
        },
      },
      {
        type: 'route',
        routeId: 'crit',
      },
    ],
  },
  {
    id: 'crit-redline',
    name: '热区压缩',
    description: '暴击与射速的极限压榨',
    category: 'route',
    routeId: 'crit',
    tags: ['bridge', 'payoff'],
    selection: {
      baseWeight: 2.9,
      minRound: 2,
      phaseBonuses: {
        mid: 1.1,
        late: 1.3,
        finalPrep: 0.6,
      },
      hintedRouteBonus: 1.2,
      dominantRouteBonus: 4.4,
      committedRouteBonus: 3.2,
      maturedRouteBonus: 1.4,
      finalPrepBonus: 1.4,
      offRouteMultiplier: 0.34,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          critChance: 0.055,
          critMultiplier: 0.28,
        },
      },
      {
        type: 'route',
        routeId: 'crit',
      },
    ],
  },
  {
    id: 'crit-heat-rake',
    name: '续热压线',
    description: '暴击与弹道强化',
    category: 'route',
    routeId: 'crit',
    tags: ['bridge', 'payoff'],
    selection: {
      baseWeight: 3.08,
      minRound: 2,
      maxRound: 4,
      phaseBonuses: {
        mid: 1.32,
        late: 1.28,
        finalPrep: 0.5,
      },
      hintedRouteBonus: 1.18,
      dominantRouteBonus: 4.48,
      committedRouteBonus: 3.46,
      maturedRouteBonus: 1.72,
      finalPrepBonus: 1.32,
      offRouteMultiplier: 0.32,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          critChance: 0.045,
          critMultiplier: 0.18,
          projectileSpeed: 18,
        },
      },
      {
        type: 'route',
        routeId: 'crit',
      },
    ],
  },
  {
    id: 'crit-heat',
    name: '热区追击',
    description: '暴击伤害的强力爆发',
    category: 'route',
    routeId: 'crit',
    tags: ['bridge', 'payoff'],
    selection: {
      baseWeight: 3,
      minRound: 3,
      phaseBonuses: {
        late: 1.7,
        finalPrep: 1,
      },
      hintedRouteBonus: 0.4,
      dominantRouteBonus: 4.6,
      committedRouteBonus: 4,
      maturedRouteBonus: 2,
      finalPrepBonus: 2,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          critMultiplier: 0.32,
        },
      },
      {
        type: 'route',
        routeId: 'crit',
      },
    ],
  },
  {
    id: 'crit-cascade',
    name: '爆链灼流',
    description: '暴击伤害的连锁爆发',
    category: 'route',
    routeId: 'crit',
    tags: ['bridge', 'payoff'],
    selection: {
      baseWeight: 3.2,
      minRound: 3,
      phaseBonuses: {
        late: 1.5,
        finalPrep: 1,
      },
      hintedRouteBonus: 0.4,
      dominantRouteBonus: 4.8,
      committedRouteBonus: 4.2,
      maturedRouteBonus: 2.2,
      finalPrepBonus: 2.2,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          critChance: 0.038,
          critMultiplier: 0.26,
        },
      },
      {
        type: 'route',
        routeId: 'crit',
      },
    ],
  },
  {
    id: 'crit-finish',
    name: '终端爆发',
    description: '暴击路线的终极封板强化',
    category: 'route',
    routeId: 'crit',
    tags: ['finisher'],
    selection: {
      baseWeight: 3,
      minRound: 3,
      phaseBonuses: {
        late: 1.6,
        finalPrep: 1.2,
      },
      dominantRouteBonus: 5,
      committedRouteBonus: 4,
      maturedRouteBonus: 3,
      finalPrepBonus: 3,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          critChance: 0.040,
          critMultiplier: 0.24,
        },
      },
      {
        type: 'route',
        routeId: 'crit',
      },
    ],
  },
  {
    id: 'pierce-core',
    name: '穿甲校正',
    description: '弹体穿过多个目标时获得拆线收益，依赖站位和敌线',
    category: 'route',
    routeId: 'pierce',
    tags: ['starter'],
    selection: {
      baseWeight: 4.8,
      maxRound: 2,
      phaseBonuses: {
        opening: 1.62,
        mid: 0.5,
      },
      noDominantRouteBonus: 6.5,
      hintedRouteBonus: 1.98,
      dominantRouteBonus: 2.94,
      offRouteMultiplier: 0.22,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          pierce: 1,
          projectileSpeed: 16,
        },
      },
      {
        type: 'route',
        routeId: 'pierce',
      },
    ],
  },
  {
    id: 'pierce-rail',
    name: '贯穿轨校',
    description: '弹体穿过多个目标时获得拆线收益，依赖站位和敌线',
    category: 'route',
    routeId: 'pierce',
    tags: ['starter'],
    selection: {
      baseWeight: 4.4,
      maxRound: 2,
      phaseBonuses: {
        opening: 1.62,
        mid: 0.6,
      },
      noDominantRouteBonus: 6.2,
      hintedRouteBonus: 2.08,
      dominantRouteBonus: 2.76,
      offRouteMultiplier: 0.22,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          pierce: 1,
          projectileSpeed: 14,
        },
      },
      {
        type: 'route',
        routeId: 'pierce',
      },
    ],
  },
  {
    id: 'pierce-seamline',
    name: '拆线起幅',
    description: '弹体穿过多个目标时获得拆线收益，依赖站位和敌线',
    category: 'route',
    routeId: 'pierce',
    tags: ['starter'],
    selection: {
      baseWeight: 4.2,
      maxRound: 2,
      phaseBonuses: {
        opening: 1.74,
        mid: 0.62,
      },
      noDominantRouteBonus: 6.4,
      hintedRouteBonus: 2.12,
      dominantRouteBonus: 2.94,
      offRouteMultiplier: 0.22,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          pierce: 1,
          projectileSpeed: 12,
        },
      },
      {
        type: 'route',
        routeId: 'pierce',
      },
    ],
  },
  {
    id: 'pierce-vector',
    name: '折线导程',
    description: '穿透与弹道精准强化',
    category: 'route',
    routeId: 'pierce',
    tags: ['bridge'],
    selection: {
      baseWeight: 3.86,
      minRound: 2,
      maxRound: 3,
      phaseBonuses: {
        mid: 1.48,
        late: 0.4,
      },
      hintedRouteBonus: 2.34,
      dominantRouteBonus: 3.92,
      committedRouteBonus: 1.8,
      offRouteMultiplier: 0.38,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          pierce: 1,
          projectileSpeed: 16,
        },
      },
      {
        type: 'route',
        routeId: 'pierce',
      },
      {
        type: 'route',
        routeId: 'pierce',
      },
      {
        type: 'route',
        routeId: 'pierce',
      },
    ],
  },
  {
    id: 'pierce-seamkeep',
    name: '拆缝续程',
    description: '穿透与弹道强化',
    category: 'route',
    routeId: 'pierce',
    tags: ['bridge'],
    selection: {
      baseWeight: 3.84,
      minRound: 2,
      maxRound: 3,
      phaseBonuses: {
        mid: 1.58,
        late: 0.44,
      },
      hintedRouteBonus: 2.36,
      dominantRouteBonus: 4.08,
      committedRouteBonus: 2.02,
      offRouteMultiplier: 0.36,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          pierce: 1,
          projectileSpeed: 14,
        },
      },
      {
        type: 'route',
        routeId: 'pierce',
      },
      {
        type: 'route',
        routeId: 'pierce',
      },
      {
        type: 'route',
        routeId: 'pierce',
      },
    ],
  },
  {
    id: 'pierce-shearline',
    name: '切层折返',
    description: '穿透与弹道强化',
    category: 'route',
    routeId: 'pierce',
    tags: ['bridge', 'payoff'],
    selection: {
      baseWeight: 3.1,
      minRound: 2,
      phaseBonuses: {
        mid: 1.2,
        late: 1,
        finalPrep: 0.5,
      },
      hintedRouteBonus: 1.1,
      dominantRouteBonus: 4.1,
      committedRouteBonus: 2.8,
      maturedRouteBonus: 1.1,
      finalPrepBonus: 1.2,
      offRouteMultiplier: 0.34,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          pierce: 1,
          projectileSpeed: 16,
        },
      },
      {
        type: 'route',
        routeId: 'pierce',
      },
    ],
  },
  {
    id: 'pierce-sidechannel',
    name: '侧轨借线',
    description: '穿透与弹道强化',
    category: 'route',
    routeId: 'pierce',
    tags: ['bridge', 'redirect'],
    selection: {
      baseWeight: 2.25,
      minRound: 2,
      maxRound: 4,
      phaseBonuses: {
        mid: 2.1,
        late: 1,
      },
      hintedRouteBonus: 0.05,
      dominantRouteBonus: 0.15,
      committedRouteBonus: 0.1,
      offRouteMultiplier: 2.05,
      excludeFromFinalPrep: true,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          projectileSpeed: 16,
          pierce: 1,
        },
      },
      {
        type: 'route',
        routeId: 'pierce',
      },
      {
        type: 'route',
        routeId: 'pierce',
      },
    ],
  },
  {
    id: 'pierce-reroute-seam',
    name: '借线破层',
    description: '穿透与弹道强化',
    category: 'route',
    routeId: 'pierce',
    tags: ['bridge', 'redirect'],
    selection: {
      baseWeight: 1.95,
      minRound: 2,
      maxRound: 4,
      phaseBonuses: {
        mid: 1.9,
        late: 0.85,
      },
      hintedRouteBonus: 0.04,
      dominantRouteBonus: 0.12,
      committedRouteBonus: 0.08,
      offRouteMultiplier: 2.3,
      excludeFromFinalPrep: true,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          pierce: 1,
          projectileSpeed: 14,
        },
      },
      {
        type: 'route',
        routeId: 'pierce',
      },
      {
        type: 'route',
        routeId: 'pierce',
      },
    ],
  },
  {
    id: 'pierce-reroute-ledger',
    name: '借层回收',
    description: '穿透与弹道强化',
    category: 'route',
    routeId: 'pierce',
    tags: ['bridge', 'redirect'],
    selection: {
      baseWeight: 1.78,
      minRound: 2,
      maxRound: 4,
      phaseBonuses: {
        mid: 1.82,
        late: 0.92,
      },
      hintedRouteBonus: 0.04,
      dominantRouteBonus: 0.12,
      committedRouteBonus: 0.08,
      offRouteMultiplier: 2.34,
      excludeFromFinalPrep: true,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          pierce: 1,
          projectileSpeed: 14,
        },
      },
      {
        type: 'route',
        routeId: 'pierce',
      },
      {
        type: 'route',
        routeId: 'pierce',
      },
    ],
  },
  {
    id: 'pierce-sidestitch',
    name: '借层并轨',
    description: '穿透与弹道强化',
    category: 'route',
    routeId: 'pierce',
    tags: ['bridge', 'redirect'],
    selection: {
      baseWeight: 1.88,
      minRound: 2,
      maxRound: 4,
      phaseBonuses: {
        mid: 1.75,
        late: 1,
      },
      hintedRouteBonus: 0.04,
      dominantRouteBonus: 0.12,
      committedRouteBonus: 0.08,
      offRouteMultiplier: 2.26,
      excludeFromFinalPrep: true,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          pierce: 1,
          projectileSpeed: 16,
        },
      },
      {
        type: 'route',
        routeId: 'pierce',
      },
      {
        type: 'route',
        routeId: 'pierce',
      },
    ],
  },
  {
    id: 'pierce-riftbloom',
    name: '裂面回响',
    description: '穿透与弹道的终极强化',
    category: 'route',
    contentTier: 'rare',
    routeId: 'pierce',
    tags: ['payoff', 'finisher', 'rare'],
    selection: {
      baseWeight: 1.02,
      minRound: 3,
      phaseBonuses: {
        late: 1.45,
        finalPrep: 2.1,
        finalBattle: 2.2,
      },
      hintedRouteBonus: 0.2,
      dominantRouteBonus: 3.9,
      committedRouteBonus: 3.5,
      maturedRouteBonus: 2.3,
      finalPrepBonus: 2.3,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          pierce: 1,
          projectileSpeed: 18,
        },
      },
      {
        type: 'route',
        routeId: 'pierce',
      },
    ],
  },
  {
    id: 'crit-superheat',
    name: '灼区归档',
    description: '暴击与暴伤的极限爆发',
    category: 'route',
    contentTier: 'rare',
    routeId: 'crit',
    tags: ['payoff', 'finisher', 'rare'],
    selection: {
      baseWeight: 1.05,
      minRound: 3,
      phaseBonuses: {
        late: 1.4,
        finalPrep: 2,
        finalBattle: 2.2,
      },
      hintedRouteBonus: 0.2,
      dominantRouteBonus: 3.8,
      committedRouteBonus: 3.6,
      maturedRouteBonus: 2.4,
      finalPrepBonus: 2.4,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          critChance: 0.045,
          critMultiplier: 0.32,
        },
      },
      {
        type: 'route',
        routeId: 'crit',
      },
    ],
  },
  {
    id: 'dash-phasebank',
    name: '相位蓄返',
    description: '穿梭脉冲与冷却强化',
    category: 'route',
    routeId: 'dash',
    tags: ['bridge', 'payoff'],
    selection: {
      baseWeight: 3.34,
      minRound: 2,
      phaseBonuses: {
        mid: 1.2,
        late: 1,
        finalPrep: 0.5,
      },
      hintedRouteBonus: 1.1,
      dominantRouteBonus: 4.1,
      committedRouteBonus: 2.8,
      maturedRouteBonus: 1.1,
      finalPrepBonus: 1.2,
      offRouteMultiplier: 0.34,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          dashInterval: -0.28,
          dashPulseDamage: 5.5,
          dashInvulnerability: 0.06,
        },
      },
      {
        type: 'route',
        routeId: 'dash',
      },
    ],
  },
  {
    id: 'pierce-fan',
    name: '裂轨分束',
    description: '穿透与弹道强化',
    category: 'route',
    routeId: 'pierce',
    tags: ['bridge'],
    selection: {
      baseWeight: 4,
      minRound: 2,
      phaseBonuses: {
        mid: 1.3,
        late: 0.6,
      },
      hintedRouteBonus: 2.18,
      dominantRouteBonus: 4.28,
      committedRouteBonus: 2,
      offRouteMultiplier: 0.42,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          pierce: 1,
          projectileSpeed: 22,
        },
      },
      {
        type: 'route',
        routeId: 'pierce',
      },
      {
        type: 'route',
        routeId: 'pierce',
      },
    ],
  },
  {
    id: 'pierce-relay-spine',
    name: '并轨穿脊',
    description: '穿透与弹道的核心强化',
    category: 'route',
    routeId: 'pierce',
    tags: ['bridge'],
    selection: {
      baseWeight: 3.6,
      minRound: 2,
      maxRound: 4,
      phaseBonuses: {
        mid: 1.5,
        late: 0.7,
      },
      hintedRouteBonus: 2.28,
      dominantRouteBonus: 4.06,
      committedRouteBonus: 1.8,
      offRouteMultiplier: 0.38,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          pierce: 1,
          projectileSpeed: 16,
        },
      },
      {
        type: 'route',
        routeId: 'pierce',
      },
      {
        type: 'route',
        routeId: 'pierce',
      },
    ],
  },
  {
    id: 'pierce-ledger-fanout',
    name: '拆账铺面',
    description: '穿透与弹道平衡提升',
    category: 'route',
    routeId: 'pierce',
    tags: ['bridge'],
    selection: {
      baseWeight: 3.82,
      minRound: 2,
      maxRound: 4,
      phaseBonuses: {
        mid: 1.6,
        late: 0.94,
        finalPrep: 0.26,
      },
      hintedRouteBonus: 1.86,
      dominantRouteBonus: 4.5,
      committedRouteBonus: 3.92,
      maturedRouteBonus: 1.58,
      finalPrepBonus: 0.68,
      offRouteMultiplier: 0.28,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          pierce: 1,
          projectileSpeed: 14,
        },
      },
      {
        type: 'route',
        routeId: 'pierce',
      },
    ],
  },
  {
    id: 'pierce-floodgate',
    name: '裂层清账',
    description: '穿透与弹道的终极爆发',
    category: 'route',
    contentTier: 'rare',
    routeId: 'pierce',
    tags: ['payoff', 'finisher', 'rare'],
    selection: {
      baseWeight: 1.01,
      minRound: 3,
      phaseBonuses: {
        late: 1.5,
        finalPrep: 2.15,
        finalBattle: 2.2,
      },
      hintedRouteBonus: 0.2,
      dominantRouteBonus: 4,
      committedRouteBonus: 3.7,
      maturedRouteBonus: 2.5,
      finalPrepBonus: 2.3,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          pierce: 2,
          projectileSpeed: 25,
        },
      },
      {
        type: 'route',
        routeId: 'pierce',
      },
    ],
  },
  {
    id: 'pierce-seam-ledger',
    name: '裂幕归账',
    description: '穿透与弹道强化',
    category: 'route',
    routeId: 'pierce',
    tags: ['bridge', 'payoff'],
    selection: {
      baseWeight: 3,
      minRound: 3,
      phaseBonuses: {
        late: 1.62,
        finalPrep: 0.92,
        finalBattle: 0.72,
      },
      hintedRouteBonus: 0.45,
      dominantRouteBonus: 4.65,
      committedRouteBonus: 4.15,
      maturedRouteBonus: 2.15,
      finalPrepBonus: 1.9,
      offRouteMultiplier: 0.3,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          pierce: 1,
          projectileSpeed: 16,
        },
      },
      {
        type: 'route',
        routeId: 'pierce',
      },
    ],
  },
  {
    id: 'dash-cutback',
    name: '回切留影',
    description: '穿梭系统的终极强化',
    category: 'route',
    contentTier: 'rare',
    routeId: 'dash',
    tags: ['payoff', 'finisher', 'rare'],
    selection: {
      baseWeight: 1.02,
      minRound: 3,
      phaseBonuses: {
        late: 1.45,
        finalPrep: 2.1,
        finalBattle: 2.2,
      },
      hintedRouteBonus: 0.2,
      dominantRouteBonus: 3.9,
      committedRouteBonus: 3.5,
      maturedRouteBonus: 2.3,
      finalPrepBonus: 2.3,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          dashInterval: -0.28,
          dashInvulnerability: 0.12,
          dashPulseDamage: 8.5,
        },
      },
      {
        type: 'route',
        routeId: 'dash',
      },
    ],
  },
  {
    id: 'pierce-echo',
    name: '贯层回响',
    description: '穿透强化',
    category: 'route',
    routeId: 'pierce',
    tags: ['bridge', 'payoff'],
    selection: {
      baseWeight: 2.9,
      minRound: 2,
      phaseBonuses: {
        mid: 1.1,
        late: 1.3,
        finalPrep: 0.6,
      },
      hintedRouteBonus: 1.2,
      dominantRouteBonus: 4.4,
      committedRouteBonus: 3.2,
      maturedRouteBonus: 1.4,
      finalPrepBonus: 1.4,
      offRouteMultiplier: 0.34,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          pierce: 1,
        },
      },
      {
        type: 'route',
        routeId: 'pierce',
      },
    ],
  },
  {
    id: 'pierce-ripple',
    name: '回响切层',
    description: '穿透与弹道强化',
    category: 'route',
    routeId: 'pierce',
    tags: ['bridge', 'payoff'],
    selection: {
      baseWeight: 3,
      minRound: 3,
      phaseBonuses: {
        late: 1.6,
        finalPrep: 0.9,
      },
      hintedRouteBonus: 0.4,
      dominantRouteBonus: 4.6,
      committedRouteBonus: 4,
      maturedRouteBonus: 2,
      finalPrepBonus: 2,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          pierce: 1,
          projectileSpeed: 16,
        },
      },
      {
        type: 'route',
        routeId: 'pierce',
      },
    ],
  },
  {
    id: 'pierce-ledger-line',
    name: '拆线归账',
    description: '穿透与弹道强化',
    category: 'route',
    routeId: 'pierce',
    tags: ['bridge', 'payoff'],
    selection: {
      baseWeight: 3.06,
      minRound: 2,
      maxRound: 4,
      phaseBonuses: {
        mid: 1.26,
        late: 1.34,
        finalPrep: 0.48,
      },
      hintedRouteBonus: 1.12,
      dominantRouteBonus: 4.46,
      committedRouteBonus: 3.42,
      maturedRouteBonus: 1.74,
      finalPrepBonus: 1.28,
      offRouteMultiplier: 0.32,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          pierce: 1,
          projectileSpeed: 16,
        },
      },
      {
        type: 'route',
        routeId: 'pierce',
      },
    ],
  },
  {
    id: 'pierce-bloom',
    name: '扇裂扩面',
    description: '穿透强化',
    category: 'route',
    routeId: 'pierce',
    tags: ['bridge', 'payoff'],
    selection: {
      baseWeight: 3.2,
      minRound: 3,
      phaseBonuses: {
        late: 1.4,
        finalPrep: 0.8,
      },
      hintedRouteBonus: 0.4,
      dominantRouteBonus: 4.8,
      committedRouteBonus: 4.2,
      maturedRouteBonus: 2.2,
      finalPrepBonus: 1.8,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          pierce: 1,
        },
      },
      {
        type: 'route',
        routeId: 'pierce',
      },
    ],
  },
  {
    id: 'pierce-chain',
    name: '续链增程',
    description: '穿透与弹道的极限延伸',
    category: 'route',
    routeId: 'pierce',
    tags: ['finisher'],
    selection: {
      baseWeight: 3,
      minRound: 3,
      phaseBonuses: {
        late: 1.6,
        finalPrep: 1,
      },
      dominantRouteBonus: 5,
      committedRouteBonus: 4,
      maturedRouteBonus: 3,
      finalPrepBonus: 2,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          pierce: 1,
          projectileSpeed: 22,
        },
      },
      {
        type: 'route',
        routeId: 'pierce',
      },
    ],
  },
  {
    id: 'dash-brush',
    name: '擦身推进',
    description: '快速换位、擦身或回切时触发短暂脉冲收益',
    category: 'route',
    routeId: 'dash',
    tags: ['starter'],
    selection: {
      baseWeight: 6,
      maxRound: 2,
      phaseBonuses: {
        opening: 1.5,
        mid: 0.4,
      },
      noDominantRouteBonus: 8,
      hintedRouteBonus: 1.8,
      dominantRouteBonus: 2.8,
      offRouteMultiplier: 0.22,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          dashPulseDamage: 6,
          dashInterval: -0.36,
        },
      },
      {
        type: 'route',
        routeId: 'dash',
      },
    ],
  },
  {
    id: 'dash-feint',
    name: '侧滑取样',
    description: '快速换位、擦身或回切时触发短暂脉冲收益',
    category: 'route',
    routeId: 'dash',
    tags: ['starter'],
    selection: {
      baseWeight: 5.4,
      maxRound: 2,
      phaseBonuses: {
        opening: 1.5,
        mid: 0.5,
      },
      noDominantRouteBonus: 7.5,
      hintedRouteBonus: 1.8,
      dominantRouteBonus: 2.6,
      offRouteMultiplier: 0.22,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          moveSpeed: 16,
          dashInvulnerability: 0.08,
          dashInterval: -0.34,
        },
      },
      {
        type: 'route',
        routeId: 'dash',
      },
    ],
  },
  {
    id: 'dash-lanebreak',
    name: '换边破窗',
    description: '快速换位、擦身或回切时触发短暂脉冲收益',
    category: 'route',
    routeId: 'dash',
    tags: ['starter'],
    selection: {
      baseWeight: 5.68,
      maxRound: 2,
      phaseBonuses: {
        opening: 1.56,
        mid: 0.54,
      },
      noDominantRouteBonus: 7.8,
      hintedRouteBonus: 1.92,
      dominantRouteBonus: 2.72,
      offRouteMultiplier: 0.22,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          dashInterval: -0.48,
          dashPulseDamage: 5.5,
        },
      },
      {
        type: 'route',
        routeId: 'dash',
      },
    ],
  },
  {
    id: 'dash-slipstream',
    name: '换位余程',
    description: '穿梭冷却与无伤窗口强化',
    category: 'route',
    routeId: 'dash',
    tags: ['bridge'],
    selection: {
      baseWeight: 4.02,
      minRound: 2,
      maxRound: 3,
      phaseBonuses: {
        mid: 1.4,
        late: 0.4,
      },
      hintedRouteBonus: 2.2,
      dominantRouteBonus: 3.8,
      committedRouteBonus: 1.8,
      offRouteMultiplier: 0.38,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          dashInterval: -0.32,
          dashInvulnerability: 0.08,
          dashPulseDamage: 4,
        },
      },
      {
        type: 'route',
        routeId: 'dash',
      },
      {
        type: 'route',
        routeId: 'dash',
      },
      {
        type: 'route',
        routeId: 'dash',
      },
    ],
  },
  {
    id: 'dash-sidechannel',
    name: '错位取样',
    description: '跨路线的灵活切换，附带生命恢复',
    category: 'route',
    routeId: 'dash',
    tags: ['bridge', 'redirect'],
    selection: {
      baseWeight: 2.25,
      minRound: 2,
      maxRound: 4,
      phaseBonuses: {
        mid: 2.1,
        late: 1,
      },
      hintedRouteBonus: 0.05,
      dominantRouteBonus: 0.15,
      committedRouteBonus: 0.1,
      offRouteMultiplier: 2.05,
      excludeFromFinalPrep: true,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          moveSpeed: 14,
          dashInterval: -0.28,
          dashInvulnerability: 0.05,
          dashPulseDamage: 4,
        },
      },
      {
        type: 'heal',
        amount: 8,
      },
      {
        type: 'route',
        routeId: 'dash',
      },
      {
        type: 'route',
        routeId: 'dash',
      },
    ],
  },
  {
    id: 'dash-reroute-cutin',
    name: '偏帧切入',
    description: '跨路线的灵活切换，附带生命恢复',
    category: 'route',
    routeId: 'dash',
    tags: ['bridge', 'redirect'],
    selection: {
      baseWeight: 1.95,
      minRound: 2,
      maxRound: 4,
      phaseBonuses: {
        mid: 1.9,
        late: 0.85,
      },
      hintedRouteBonus: 0.04,
      dominantRouteBonus: 0.12,
      committedRouteBonus: 0.08,
      offRouteMultiplier: 2.3,
      excludeFromFinalPrep: true,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          moveSpeed: 12,
          dashInterval: -0.22,
          dashInvulnerability: 0.04,
        },
      },
      {
        type: 'heal',
        amount: 6,
      },
      {
        type: 'route',
        routeId: 'dash',
      },
      {
        type: 'route',
        routeId: 'dash',
      },
    ],
  },
  {
    id: 'dash-reroute-recall',
    name: '借位追回',
    description: '跨路线的灵活切换，附带生命恢复',
    category: 'route',
    routeId: 'dash',
    tags: ['bridge', 'redirect'],
    selection: {
      baseWeight: 1.78,
      minRound: 2,
      maxRound: 4,
      phaseBonuses: {
        mid: 1.82,
        late: 0.92,
      },
      hintedRouteBonus: 0.04,
      dominantRouteBonus: 0.12,
      committedRouteBonus: 0.08,
      offRouteMultiplier: 2.34,
      excludeFromFinalPrep: true,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          moveSpeed: 12,
          dashInterval: -0.35,
          dashPulseDamage: 5.5,
        },
      },
      {
        type: 'heal',
        amount: 6,
      },
      {
        type: 'route',
        routeId: 'dash',
      },
      {
        type: 'route',
        routeId: 'dash',
      },
    ],
  },
  {
    id: 'pierce-prism',
    name: '棱镜破轨',
    description: '穿透与弹道的终极强化',
    category: 'route',
    contentTier: 'rare',
    routeId: 'pierce',
    tags: ['payoff', 'finisher', 'rare'],
    selection: {
      baseWeight: 1.05,
      minRound: 3,
      phaseBonuses: {
        late: 1.4,
        finalPrep: 2,
        finalBattle: 2.2,
      },
      hintedRouteBonus: 0.2,
      dominantRouteBonus: 3.8,
      committedRouteBonus: 3.6,
      maturedRouteBonus: 2.4,
      finalPrepBonus: 2.4,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          pierce: 1,
          projectileSpeed: 20,
        },
      },
      {
        type: 'route',
        routeId: 'pierce',
      },
    ],
  },
  {
    id: 'dash-loop',
    name: '净帧循环',
    description: '穿梭脉冲与冷却强化',
    category: 'route',
    routeId: 'dash',
    tags: ['bridge'],
    selection: {
      baseWeight: 4,
      minRound: 2,
      phaseBonuses: {
        mid: 1.4,
        late: 0.6,
      },
      hintedRouteBonus: 2.1,
      dominantRouteBonus: 4.2,
      committedRouteBonus: 2.2,
      finalPrepBonus: 2,
      offRouteMultiplier: 0.42,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          dashPulseDamage: 6,
          dashInterval: -0.36,
          dashInvulnerability: 0.08,
        },
      },
      {
        type: 'route',
        routeId: 'dash',
      },
    ],
  },
  {
    id: 'dash-sidestep-bank',
    name: '侧返蓄窗',
    description: '机动、冲刺与无敌的平衡提升',
    category: 'route',
    routeId: 'dash',
    tags: ['bridge'],
    selection: {
      baseWeight: 3.6,
      minRound: 2,
      maxRound: 4,
      phaseBonuses: {
        mid: 1.5,
        late: 0.7,
      },
      hintedRouteBonus: 2.2,
      dominantRouteBonus: 3.9,
      committedRouteBonus: 1.8,
      offRouteMultiplier: 0.38,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          moveSpeed: 14,
          dashInterval: -0.24,
          dashInvulnerability: 0.06,
        },
      },
      {
        type: 'route',
        routeId: 'dash',
      },
    ],
  },
  {
    id: 'dash-return-hold',
    name: '回线留窗',
    description: '穿梭冷却与无伤窗口强化',
    category: 'route',
    routeId: 'dash',
    tags: ['bridge'],
    selection: {
      baseWeight: 3.18,
      minRound: 2,
      maxRound: 4,
      phaseBonuses: {
        mid: 1.34,
        late: 0.82,
        finalPrep: 0.22,
      },
      hintedRouteBonus: 1.18,
      dominantRouteBonus: 3.92,
      committedRouteBonus: 2.78,
      maturedRouteBonus: 1.18,
      finalPrepBonus: 0.56,
      offRouteMultiplier: 0.34,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          dashInterval: -0.22,
          dashInvulnerability: 0.08,
          dashPulseDamage: 4.5,
        },
      },
      {
        type: 'route',
        routeId: 'dash',
      },
    ],
  },
  {
    id: 'dash-afterimage',
    name: '残影回切',
    description: '穿梭脉冲与无伤窗口的终极强化',
    category: 'route',
    contentTier: 'rare',
    routeId: 'dash',
    tags: ['payoff', 'finisher', 'rare'],
    selection: {
      baseWeight: 1.01,
      minRound: 3,
      phaseBonuses: {
        late: 1.5,
        finalPrep: 2.15,
        finalBattle: 2.2,
      },
      hintedRouteBonus: 0.2,
      dominantRouteBonus: 4,
      committedRouteBonus: 3.7,
      maturedRouteBonus: 2.5,
      finalPrepBonus: 2.3,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          dashPulseDamage: 12,
          dashInvulnerability: 0.14,
        },
      },
      {
        type: 'route',
        routeId: 'dash',
      },
    ],
  },
  {
    id: 'dash-retrace-beat',
    name: '回线追拍',
    description: '穿梭脉冲与无伤窗口强化',
    category: 'route',
    routeId: 'dash',
    tags: ['bridge', 'payoff'],
    selection: {
      baseWeight: 3.02,
      minRound: 3,
      phaseBonuses: {
        late: 1.64,
        finalPrep: 0.92,
        finalBattle: 0.72,
      },
      hintedRouteBonus: 0.45,
      dominantRouteBonus: 4.7,
      committedRouteBonus: 4.1,
      maturedRouteBonus: 2.1,
      finalPrepBonus: 1.92,
      offRouteMultiplier: 0.3,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          dashInterval: -0.26,
          dashPulseDamage: 7.5,
          dashInvulnerability: 0.08,
        },
      },
      {
        type: 'route',
        routeId: 'dash',
      },
    ],
  },
  {
    id: 'dash-counterline',
    name: '回切反打',
    description: '穿梭脉冲与冷却强化',
    category: 'route',
    routeId: 'dash',
    tags: ['bridge', 'payoff'],
    selection: {
      baseWeight: 2.9,
      minRound: 2,
      phaseBonuses: {
        mid: 1.1,
        late: 1.3,
        finalPrep: 0.6,
      },
      hintedRouteBonus: 1.2,
      dominantRouteBonus: 4.4,
      committedRouteBonus: 3.2,
      maturedRouteBonus: 1.4,
      finalPrepBonus: 1.4,
      offRouteMultiplier: 0.34,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          dashPulseDamage: 7.5,
          dashInterval: -0.18,
        },
      },
      {
        type: 'route',
        routeId: 'dash',
      },
    ],
  },
  {
    id: 'dash-return-snap',
    name: '回摆取窗',
    description: '穿梭冷却与无伤窗口强化',
    category: 'route',
    routeId: 'dash',
    tags: ['bridge', 'payoff'],
    selection: {
      baseWeight: 3.04,
      minRound: 2,
      maxRound: 4,
      phaseBonuses: {
        mid: 1.34,
        late: 1.24,
        finalPrep: 0.46,
      },
      hintedRouteBonus: 1.14,
      dominantRouteBonus: 4.44,
      committedRouteBonus: 3.38,
      maturedRouteBonus: 1.68,
      finalPrepBonus: 1.24,
      offRouteMultiplier: 0.32,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          dashInterval: -0.22,
          dashInvulnerability: 0.08,
        },
      },
      {
        type: 'route',
        routeId: 'dash',
      },
    ],
  },
  {
    id: 'dash-rebound-window',
    name: '借窗回返',
    description: '跨路线的灵活切换，附带生命恢复',
    category: 'route',
    routeId: 'dash',
    tags: ['bridge', 'redirect'],
    selection: {
      baseWeight: 1.88,
      minRound: 2,
      maxRound: 4,
      phaseBonuses: {
        mid: 1.75,
        late: 1,
      },
      hintedRouteBonus: 0.04,
      dominantRouteBonus: 0.12,
      committedRouteBonus: 0.08,
      offRouteMultiplier: 2.26,
      excludeFromFinalPrep: true,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          moveSpeed: 14,
          dashInterval: -0.18,
          dashPulseDamage: 3,
        },
      },
      {
        type: 'heal',
        amount: 6,
      },
      {
        type: 'route',
        routeId: 'dash',
      },
      {
        type: 'route',
        routeId: 'dash',
      },
    ],
  },
  {
    id: 'dash-rethread',
    name: '回线续拍',
    description: '穿梭频率、脉冲与无伤窗口的强力爆发',
    category: 'route',
    routeId: 'dash',
    tags: ['bridge', 'payoff'],
    selection: {
      baseWeight: 3,
      minRound: 3,
      phaseBonuses: {
        late: 1.6,
        finalPrep: 0.9,
      },
      hintedRouteBonus: 0.4,
      dominantRouteBonus: 4.6,
      committedRouteBonus: 4,
      maturedRouteBonus: 2,
      finalPrepBonus: 2,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          dashInterval: -0.42,
          dashInvulnerability: 0.08,
          dashPulseDamage: 5,
        },
      },
      {
        type: 'route',
        routeId: 'dash',
      },
    ],
  },
  {
    id: 'dash-reentry',
    name: '回环汲能',
    description: '穿梭脉冲、冷却与无伤窗口的强力组合',
    category: 'route',
    routeId: 'dash',
    tags: ['bridge', 'payoff'],
    selection: {
      baseWeight: 3.2,
      minRound: 3,
      phaseBonuses: {
        late: 1.5,
        finalPrep: 0.9,
      },
      hintedRouteBonus: 0.4,
      dominantRouteBonus: 4.8,
      committedRouteBonus: 4.2,
      maturedRouteBonus: 2.2,
      finalPrepBonus: 2,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          dashPulseDamage: 7,
          dashInvulnerability: 0.08,
          dashInterval: -0.28,
        },
      },
      {
        type: 'route',
        routeId: 'dash',
      },
    ],
  },
  {
    id: 'dash-anchor',
    name: '穿梭定标',
    description: '穿梭脉冲、生存与机动的终极封板',
    category: 'route',
    routeId: 'dash',
    tags: ['finisher'],
    selection: {
      baseWeight: 3,
      minRound: 3,
      phaseBonuses: {
        late: 1.6,
        finalPrep: 1.2,
      },
      dominantRouteBonus: 5,
      committedRouteBonus: 4,
      maturedRouteBonus: 3,
      finalPrepBonus: 3,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          dashPulseDamage: 6,
          dashInvulnerability: 0.12,
        },
      },
      {
        type: 'route',
        routeId: 'dash',
      },
      {
        type: 'route',
        routeId: 'dash',
      },
    ],
  },
  {
    id: 'dash-zero-window',
    name: '瞬返空档',
    description: '穿梭系统的全方位终极强化',
    category: 'route',
    contentTier: 'rare',
    routeId: 'dash',
    tags: ['payoff', 'finisher', 'rare'],
    selection: {
      baseWeight: 1.05,
      minRound: 3,
      phaseBonuses: {
        late: 1.4,
        finalPrep: 2,
        finalBattle: 2.2,
      },
      hintedRouteBonus: 0.2,
      dominantRouteBonus: 3.8,
      committedRouteBonus: 3.6,
      maturedRouteBonus: 2.4,
      finalPrepBonus: 2.4,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          dashInterval: -0.42,
          dashInvulnerability: 0.14,
          dashPulseDamage: 12,
        },
      },
      {
        type: 'route',
        routeId: 'dash',
      },
    ],
  },
];

export function buildUpgradeChoice(archetype: UpgradeArchetype, rarity: UpgradeRarity): UpgradeDefinition {
  const scaledEffects = scaleEffects(archetype.effects, rarity);
  const effectsWithoutInstantHeal = scaledEffects.filter((effect) => effect.type !== 'heal');
  const effects =
    archetype.category === 'generic'
      ? normalizeEffectsToSingleStat(archetype.id, effectsWithoutInstantHeal, archetype.routeId, rarity)
      : effectsWithoutInstantHeal;
  const valueBreakdown = estimateUpgradeValue(effects);
  const valueBucket = getUpgradeValueBucket(valueBreakdown.total);
  return {
    id: `${archetype.id}:${rarity}:${Math.random().toString(36).slice(2, 8)}`,
    sourceId: archetype.id,
    name: archetype.name,
    description: archetype.description ?? describeContentEffects(effects, archetype.routeId),
    category: archetype.category,
    contentTier: archetype.contentTier,
    rarity,
    rarityLabel: RARITY_LABEL_MAP[rarity],
    routeId: archetype.routeId,
    repeatable: archetype.repeatable,
    tags: archetype.tags,
    effects,
    valueScore: valueBreakdown.total,
    valueBucket,
    valueBreakdown,
  };
}
