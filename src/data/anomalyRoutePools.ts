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
      label: '暴击强化',
      description: '暴击率提高8%，承受8点伤害。',
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
      label: '穿透强化',
      description: '获得1点穿透，承受8点伤害。',
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
      label: '穿梭强化',
      description: '穿梭脉冲伤害提升6点，脉冲间隔缩短0.4秒，承受8点伤害。',
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
      label: '暴击恢复',
      description: '恢复8点生命，伤害+3，射速+12%，暴击率+3%。',
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
      label: '穿透恢复',
      description: '恢复8点生命，伤害+2，弹速+18，获得1点穿透。',
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
      label: '穿梭恢复',
      description: '恢复8点生命，移速+12，脉冲间隔缩短0.2秒，脉冲伤害+4。',
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
      label: '暴击起步',
      gameplayLabel: '建立节奏',
      gainLabel: '暴击率提升，射速提升',
      costLabel: '暴击流派未开始',
      anomalyRole: 'direction',
      description: '暴击率+5%，射速+12%。',
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
      label: '穿透起步',
      gameplayLabel: '打开路线',
      gainLabel: '获得穿透属性，弹速提升',
      costLabel: '穿透流派未开始',
      anomalyRole: 'direction',
      description: '获得1点穿透，弹速+18。',
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
      label: '穿梭起步',
      gameplayLabel: '接近敌人',
      gainLabel: '移速提升，脉冲间隔缩短',
      costLabel: '穿梭流派未开始',
      anomalyRole: 'direction',
      description: '移速+14，脉冲间隔缩短0.22秒。',
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
      label: '暴击巩固',
      description: '伤害+3，射速+10%。',
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
      description: '恢复8点生命，伤害+2，弹速+18，获得1点穿透。',
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
      description: '恢复8点生命，移速+12，脉冲间隔缩短0.2秒，脉冲伤害+4。',
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
      description: '恢复8点生命，伤害+3，射速+12%，暴击率+3%。',
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
      label: '穿透巩固',
      description: '伤害+2，弹速+16。',
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
      description: '恢复8点生命，移速+12，脉冲间隔缩短0.2秒，脉冲伤害+4。',
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
      description: '恢复8点生命，伤害+3，射速+12%，暴击率+3%。',
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
      description: '恢复8点生命，伤害+2，弹速+18，获得1点穿透。',
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
      label: '穿梭巩固',
      description: '移速+10，生命恢复+0.8/秒。',
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
      label: '补充暴击',
      description: '暴击率+6%，射速+12%。',
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
      label: '补充穿透',
      description: '获得1点穿透，弹速+20。',
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
      label: '补充穿梭',
      description: '移速+14，脉冲间隔缩短0.3秒。',
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
