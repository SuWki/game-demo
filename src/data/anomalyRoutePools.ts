import type { ContentEffect, EventOption, RouteId } from '../game/types';

export type AnomalyRoutePoolId =
  | 'riskyProtocol'
  | 'relaySplice'
  | 'routeHandoff'
  | 'critRerouteWindow'
  | 'pierceRerouteWindow'
  | 'dashRerouteWindow'
  | 'crossBranchSignal';

type AnomalyRouteOption = EventOption & {
  routeId: RouteId;
  effects: ContentEffect[];
};

type AnomalyRoutePool = Record<RouteId, AnomalyRouteOption>;

const ANOMALY_ROUTE_POOLS: Record<AnomalyRoutePoolId, AnomalyRoutePool> = {
  riskyProtocol: {
    crit: {
      id: 'risky-protocol-crit',
      label: '追求暴击',
      description: '暴击率提高，承受 8 点压力伤害。',
      routeId: 'crit',
      effects: [
        {
          type: 'stats',
          modifiers: {
            critChance: 0.08,
          },
        },
        {
          type: 'route',
          routeId: 'crit',
        },
        {
          type: 'heal',
          amount: -8,
        },
      ],
    },
    pierce: {
      id: 'risky-protocol-pierce',
      label: '追求穿透',
      description: '获得 1 点穿透，承受 8 点压力伤害。',
      routeId: 'pierce',
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
        {
          type: 'heal',
          amount: -8,
        },
      ],
    },
    dash: {
      id: 'risky-protocol-dash',
      label: '追求穿梭',
      description: '强化穿梭节奏，承受 8 点压力伤害。',
      routeId: 'dash',
      effects: [
        {
          type: 'stats',
          modifiers: {
            dashPulseDamage: 6,
            dashInterval: -0.4,
          },
        },
        {
          type: 'route',
          routeId: 'dash',
        },
        {
          type: 'heal',
          amount: -8,
        },
      ],
    },
  },
  relaySplice: {
    crit: {
      id: 'relay-splice-crit',
      label: '偏转暴击',
      description: '恢复 8 点耐久，把暴击这一下补上。',
      routeId: 'crit',
      effects: [
        {
          type: 'stats',
          modifiers: {
            damage: 3,
            fireRate: 0.12,
            critChance: 0.03,
          },
        },
        {
          type: 'heal',
          amount: 8,
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
    pierce: {
      id: 'relay-splice-pierce',
      label: '偏转穿透',
      description: '恢复 8 点耐久，把穿透这一下接上。',
      routeId: 'pierce',
      effects: [
        {
          type: 'stats',
          modifiers: {
            damage: 2,
            projectileSpeed: 18,
            pierce: 1,
          },
        },
        {
          type: 'heal',
          amount: 8,
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
    dash: {
      id: 'relay-splice-dash',
      label: '偏转穿梭',
      description: '恢复 8 点耐久，把穿梭那股节奏接上。',
      routeId: 'dash',
      effects: [
        {
          type: 'stats',
          modifiers: {
            moveSpeed: 12,
            dashInterval: -0.2,
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
  },
  routeHandoff: {
    crit: {
      id: 'route-handoff-crit',
      label: '先接暴击',
      gameplayLabel: '先打顺',
      gainLabel: '先把暴击打顺',
      costLabel: '还不到猛压的时候',
      anomalyRole: 'direction',
      description: '先把暴击接顺。',
      routeId: 'crit',
      effects: [
        {
          type: 'stats',
          modifiers: {
            critChance: 0.05,
            fireRate: 0.12,
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
        {
          type: 'route',
          routeId: 'crit',
        },
      ],
    },
    pierce: {
      id: 'route-handoff-pierce',
      label: '先接穿透',
      gameplayLabel: '先打开路',
      gainLabel: '先把前排穿开',
      costLabel: '还不到带后排的时候',
      anomalyRole: 'direction',
      description: '先把穿透接顺。',
      routeId: 'pierce',
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
    dash: {
      id: 'route-handoff-dash',
      label: '先接穿梭',
      gameplayLabel: '先贴近',
      gainLabel: '先把贴身节奏拉起来',
      costLabel: '还不能马上贴身收人',
      anomalyRole: 'direction',
      description: '先把穿梭节奏接上，后面更容易贴着连打。',
      routeId: 'dash',
      effects: [
        {
          type: 'stats',
          modifiers: {
            moveSpeed: 14,
            dashInterval: -0.22,
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
        {
          type: 'route',
          routeId: 'dash',
        },
      ],
    },
  },
  critRerouteWindow: {
    crit: {
      id: 'crit-reroute-window-crit-unused',
      label: '稳住暴击火力',
      description: '先把暴击打顺。',
      routeId: 'crit',
      effects: [
        {
          type: 'stats',
          modifiers: {
            damage: 3,
            fireRate: 0.1,
          },
        },
        {
          type: 'route',
          routeId: 'crit',
        },
      ],
    },
    pierce: {
      id: 'crit-reroute-window-pierce',
      label: '穿透接管',
      description: '修好 8 点损伤，顺手把穿透接过来。',
      routeId: 'pierce',
      effects: [
        {
          type: 'stats',
          modifiers: {
            damage: 2,
            projectileSpeed: 18,
            pierce: 1,
          },
        },
        {
          type: 'heal',
          amount: 8,
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
    dash: {
      id: 'crit-reroute-window-dash',
      label: '穿梭接管',
      description: '修好 8 点损伤，顺手把穿梭接过来。',
      routeId: 'dash',
      effects: [
        {
          type: 'stats',
          modifiers: {
            moveSpeed: 12,
            dashInterval: -0.2,
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
  },
  pierceRerouteWindow: {
    crit: {
      id: 'pierce-reroute-window-crit',
      label: '暴击接管',
      description: '修好 8 点损伤，顺手把暴击接过来。',
      routeId: 'crit',
      effects: [
        {
          type: 'stats',
          modifiers: {
            damage: 3,
            fireRate: 0.12,
            critChance: 0.03,
          },
        },
        {
          type: 'heal',
          amount: 8,
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
    pierce: {
      id: 'pierce-reroute-window-pierce-unused',
      label: '稳住穿透火力',
      description: '先稳住现在这股穿透火力。',
      routeId: 'pierce',
      effects: [
        {
          type: 'stats',
          modifiers: {
            damage: 2,
            projectileSpeed: 16,
          },
        },
        {
          type: 'route',
          routeId: 'pierce',
        },
      ],
    },
    dash: {
      id: 'pierce-reroute-window-dash',
      label: '穿梭接管',
      description: '修好 8 点损伤，顺手把穿梭节奏接过来。',
      routeId: 'dash',
      effects: [
        {
          type: 'stats',
          modifiers: {
            moveSpeed: 12,
            dashInterval: -0.2,
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
        {
          type: 'route',
          routeId: 'dash',
        },
      ],
    },
  },
  dashRerouteWindow: {
    crit: {
      id: 'dash-reroute-window-crit',
      label: '暴击接管',
      description: '修好 8 点损伤，顺手把暴击这一路接过来。',
      routeId: 'crit',
      effects: [
        {
          type: 'stats',
          modifiers: {
            damage: 3,
            fireRate: 0.12,
            critChance: 0.03,
          },
        },
        {
          type: 'heal',
          amount: 8,
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
    pierce: {
      id: 'dash-reroute-window-pierce',
      label: '穿透接管',
      description: '修好 8 点损伤，顺手把穿透接过来。',
      routeId: 'pierce',
      effects: [
        {
          type: 'stats',
          modifiers: {
            damage: 2,
            projectileSpeed: 18,
            pierce: 1,
          },
        },
        {
          type: 'heal',
          amount: 8,
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
    dash: {
      id: 'dash-reroute-window-dash-unused',
      label: '稳住穿梭节奏',
      description: '先把穿梭接顺。',
      routeId: 'dash',
      effects: [
        {
          type: 'stats',
          modifiers: {
            moveSpeed: 10,
            regeneration: 0.08,
          },
        },
        {
          type: 'route',
          routeId: 'dash',
        },
      ],
    },
  },
  crossBranchSignal: {
    crit: {
      id: 'cross-branch-signal-crit',
      label: '补暴击',
      description: '补一段暴击火力，让这一把更容易照着暴击打。',
      routeId: 'crit',
      effects: [
        {
          type: 'stats',
          modifiers: {
            critChance: 0.06,
            fireRate: 0.12,
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
    pierce: {
      id: 'cross-branch-signal-pierce',
      label: '补穿透',
      description: '补一段穿透火力，让这一把更容易一路带到后排。',
      routeId: 'pierce',
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
        {
          type: 'route',
          routeId: 'pierce',
        },
      ],
    },
    dash: {
      id: 'cross-branch-signal-dash',
      label: '补穿梭',
      description: '补一段穿梭节奏，让这一把更容易贴着连打。',
      routeId: 'dash',
      effects: [
        {
          type: 'stats',
          modifiers: {
            moveSpeed: 14,
            dashInterval: -0.3,
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
  },
};

function cloneEffects(effects: ContentEffect[]): ContentEffect[] {
  return effects.map((effect) => {
    if (effect.type === 'stats') {
      return {
        type: 'stats',
        modifiers: {
          ...effect.modifiers,
        },
      };
    }

    return {
      ...effect,
    };
  });
}

export function getAnomalyRoutePoolOptions(poolId: AnomalyRoutePoolId, routeIds: RouteId[]): EventOption[] {
  return routeIds.map((routeId) => {
    const option = ANOMALY_ROUTE_POOLS[poolId][routeId];
    return {
      ...option,
      effects: cloneEffects(option.effects),
    };
  });
}
