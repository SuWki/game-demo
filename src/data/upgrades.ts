import { estimateUpgradeValue, getUpgradeRarityMultiplier, RARITY_LABEL_MAP } from './balance';
import { ROUTE_NAME_MAP } from './routes';
import type { ContentEffect, StatModifiers, UpgradeArchetype, UpgradeDefinition, UpgradeRarity } from '../game/types';

function roundModifier(key: keyof StatModifiers, value: number): number {
  switch (key) {
    case 'critChance':
    case 'fireRate':
    case 'critMultiplier':
    case 'dashInterval':
    case 'dashInvulnerability':
    case 'regeneration':
      return Number(value.toFixed(2));
    default:
      return Math.round(value);
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
        const value = roundModifier(key as keyof StatModifiers, rawValue * multiplier);
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

function formatModifierLabel(key: keyof StatModifiers, value: number): string {
  switch (key) {
    case 'maxHp':
      return `生命上限 ${value > 0 ? '+' : ''}${value}`;
    case 'damage':
      return `伤害 ${value > 0 ? '+' : ''}${value}`;
    case 'fireRate':
      return `射速 ${value > 0 ? '+' : ''}${value}`;
    case 'projectileSpeed':
      return `弹速 ${value > 0 ? '+' : ''}${value}`;
    case 'critChance':
      return `暴击率 ${value > 0 ? '+' : ''}${Math.round(value * 100)}%`;
    case 'critMultiplier':
      return `爆伤 ${value > 0 ? '+' : ''}${value.toFixed(2)}x`;
    case 'pierce':
      return `穿透 ${value > 0 ? '+' : ''}${value}`;
    case 'multishot':
      return `额外弹道 ${value > 0 ? '+' : ''}${value}`;
    case 'moveSpeed':
      return `移速 ${value > 0 ? '+' : ''}${value}`;
    case 'dashInterval':
      return `穿梭冷却 ${value > 0 ? '+' : ''}${value.toFixed(2)}s`;
    case 'dashPulseDamage':
      return `脉冲伤害 ${value > 0 ? '+' : ''}${value}`;
    case 'dashInvulnerability':
      return `无伤窗口 ${value > 0 ? '+' : ''}${value.toFixed(2)}s`;
    case 'regeneration':
      return `每秒回复 ${value > 0 ? '+' : ''}${value.toFixed(2)}`;
    default:
      return `${key} ${value > 0 ? '+' : ''}${value}`;
  }
}

function describeEffects(effects: ContentEffect[], routeId?: UpgradeArchetype['routeId']): string {
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
          damage: 4,
        },
      },
    ],
  },
  {
    id: 'generic-cadence',
    name: '压缩射频',
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
          fireRate: 0.3,
        },
      },
    ],
  },
  {
    id: 'generic-ballistics',
    name: '弹道校正',
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
          projectileSpeed: 34,
          damage: 2,
        },
      },
    ],
  },
  {
    id: 'generic-optics',
    name: '精密镜组',
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
          critChance: 0.07,
        },
      },
    ],
  },
  {
    id: 'generic-reactor',
    name: '爆伤蓄能',
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
          critMultiplier: 0.42,
        },
      },
    ],
  },
  {
    id: 'generic-frame',
    name: '强化骨架',
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
          maxHp: 16,
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
          moveSpeed: 20,
        },
      },
    ],
  },
  {
    id: 'generic-overclock',
    name: '循环稳态',
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
          regeneration: 0.16,
          fireRate: 0.12,
        },
      },
    ],
  },
  {
    id: 'generic-vector-buffer',
    name: '矢量缓冲',
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
          fireRate: 0.16,
          moveSpeed: 16,
          projectileSpeed: 18,
        },
      },
    ],
  },
  {
    id: 'generic-pressure-bypass',
    name: '压差旁路',
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
          maxHp: 10,
          regeneration: 0.12,
          moveSpeed: 10,
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
          fireRate: 0.14,
          projectileSpeed: 24,
          moveSpeed: 12,
        },
      },
    ],
  },
  {
    id: 'generic-open-loop',
    name: '开环余量',
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
          maxHp: 8,
          regeneration: 0.1,
          moveSpeed: 10,
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
    category: 'generic',
    repeatable: true,
    tags: ['stabilizer', 'bridge', 'hybrid', 'redirect'],
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
          fireRate: 0.12,
          projectileSpeed: 20,
          moveSpeed: 12,
        },
      },
      {
        type: 'heal',
        amount: 6,
      },
    ],
  },
  {
    id: 'generic-terminal-weave',
    name: '终段并轨',
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
    id: 'crit-aim',
    name: '聚焦瞄准',
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
          critChance: 0.07,
          damage: 2,
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
          fireRate: 0.24,
          critChance: 0.05,
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
    category: 'route',
    routeId: 'crit',
    tags: ['bridge'],
    selection: {
      baseWeight: 3.7,
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
          fireRate: 0.16,
          critChance: 0.03,
          projectileSpeed: 16,
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
    id: 'crit-sidechannel',
    name: '旁路升温',
    category: 'route',
    routeId: 'crit',
    tags: ['bridge', 'redirect'],
    selection: {
      baseWeight: 1.9,
      minRound: 2,
      maxRound: 4,
      phaseBonuses: {
        mid: 1.6,
        late: 0.8,
      },
      hintedRouteBonus: 0.2,
      dominantRouteBonus: 0.6,
      committedRouteBonus: 0.4,
      offRouteMultiplier: 1.45,
      excludeFromFinalPrep: true,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          fireRate: 0.14,
          critChance: 0.04,
          moveSpeed: 10,
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
          fireRate: 0.32,
          critChance: 0.05,
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
          damage: 3,
          fireRate: 0.18,
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
    id: 'crit-cascade',
    name: '爆链灼流',
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
          damage: 3,
          fireRate: 0.14,
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
    id: 'crit-finish',
    name: '终端爆发',
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
          critChance: 0.07,
          critMultiplier: 0.42,
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
    category: 'route',
    routeId: 'pierce',
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
          pierce: 1,
          damage: 2,
          projectileSpeed: 26,
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
    category: 'route',
    routeId: 'pierce',
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
          pierce: 1,
          projectileSpeed: 22,
          fireRate: 0.1,
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
    category: 'route',
    routeId: 'pierce',
    tags: ['bridge'],
    selection: {
      baseWeight: 3.7,
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
          projectileSpeed: 22,
          fireRate: 0.12,
          damage: 2,
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
    id: 'pierce-sidechannel',
    name: '侧轨借线',
    category: 'route',
    routeId: 'pierce',
    tags: ['bridge', 'redirect'],
    selection: {
      baseWeight: 1.9,
      minRound: 2,
      maxRound: 4,
      phaseBonuses: {
        mid: 1.6,
        late: 0.8,
      },
      hintedRouteBonus: 0.2,
      dominantRouteBonus: 0.6,
      committedRouteBonus: 0.4,
      offRouteMultiplier: 1.45,
      excludeFromFinalPrep: true,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          projectileSpeed: 20,
          damage: 2,
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
    id: 'crit-superheat',
    name: '灼区归档',
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
          damage: 5,
          fireRate: 0.16,
          critChance: 0.05,
          critMultiplier: 0.34,
        },
      },
      {
        type: 'route',
        routeId: 'crit',
      },
    ],
  },
  {
    id: 'pierce-fan',
    name: '裂轨分束',
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
      hintedRouteBonus: 2.1,
      dominantRouteBonus: 4.2,
      committedRouteBonus: 2,
      offRouteMultiplier: 0.42,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          multishot: 1,
          damage: 1,
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
          damage: 2,
          multishot: 1,
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
    id: 'pierce-bloom',
    name: '扇裂扩面',
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
          multishot: 1,
          damage: 2,
          fireRate: 0.16,
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
          fireRate: 0.18,
          projectileSpeed: 30,
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
          dashPulseDamage: 10,
          moveSpeed: 18,
          dashInterval: -0.55,
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
    id: 'dash-slipstream',
    name: '换位余程',
    category: 'route',
    routeId: 'dash',
    tags: ['bridge'],
    selection: {
      baseWeight: 3.7,
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
          moveSpeed: 14,
          dashInterval: -0.24,
          dashInvulnerability: 0.06,
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
    category: 'route',
    routeId: 'dash',
    tags: ['bridge', 'redirect'],
    selection: {
      baseWeight: 1.9,
      minRound: 2,
      maxRound: 4,
      phaseBonuses: {
        mid: 1.6,
        late: 0.8,
      },
      hintedRouteBonus: 0.2,
      dominantRouteBonus: 0.6,
      committedRouteBonus: 0.4,
      offRouteMultiplier: 1.45,
      excludeFromFinalPrep: true,
    },
    effects: [
      {
        type: 'stats',
        modifiers: {
          moveSpeed: 14,
          dashInterval: -0.24,
          dashInvulnerability: 0.04,
        },
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
          multishot: 1,
          pierce: 1,
          projectileSpeed: 24,
          damage: 3,
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
          dashPulseDamage: 8,
          dashInterval: -0.68,
          dashInvulnerability: 0.12,
        },
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
          dashInterval: -0.48,
          dashInvulnerability: 0.08,
          regeneration: 0.14,
          moveSpeed: 12,
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
          regeneration: 0.12,
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
          regeneration: 0.22,
          dashPulseDamage: 8,
          moveSpeed: 16,
        },
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
          dashInterval: -0.36,
          dashInvulnerability: 0.12,
          dashPulseDamage: 10,
          regeneration: 0.14,
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
  const effects = scaleEffects(archetype.effects, rarity);
  const valueBreakdown = estimateUpgradeValue(effects);
  return {
    id: `${archetype.id}:${rarity}:${Math.random().toString(36).slice(2, 8)}`,
    sourceId: archetype.id,
    name: archetype.name,
    description: describeEffects(effects, archetype.routeId),
    category: archetype.category,
    contentTier: archetype.contentTier,
    rarity,
    rarityLabel: RARITY_LABEL_MAP[rarity],
    routeId: archetype.routeId,
    repeatable: archetype.repeatable,
    tags: archetype.tags,
    effects,
    valueScore: valueBreakdown.total,
    valueBreakdown,
  };
}
