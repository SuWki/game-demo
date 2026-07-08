import { getAnomalyRoutePoolOptions } from './anomalyRoutePools';
import { normalizeEffectsToSingleStat } from './upgrades';
import type { ContentEffect, EventContentKind, EventDefinition, RouteReference } from '../game/types';

const RAW_EVENT_CATALOG: EventDefinition[] = [
  {
    id: 'field-maintenance',
    name: '临时补给',
    description: '选防护还是火力',
    selection: {
      baseWeight: 4.4,
      phaseBonuses: {
        opening: 1.2,
        mid: 0.6,
      },
      noDominantRouteBonus: 1.6,
    },
    options: [
      {
        id: 'field-maintenance-heal',
        label: '补外甲',
        description: '恢复耐久，提高上限',
        effects: [
          {
            type: 'stats',
            modifiers: {
              maxHp: 8,
            },
          },
          {
            type: 'heal',
            amount: 22,
          },
        ],
      },
      {
        id: 'field-maintenance-damage',
        label: '压榨火控',
        description: '伤害和射速提升',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 6,
              fireRate: 0.25,
            },
          },
        ],
      },
    ],
  },
  {
    id: 'risky-protocol',
    name: '高压试飞',
    contentKind: 'anomaly',
    anomalyClass: 'routeWindow',
    description: '承受伤害，换取属性强化',
    selection: {
      baseWeight: 1.15,
      maxRound: 2,
      phaseBonuses: {
        opening: 0.9,
        mid: 0.15,
      },
      noDominantRouteBonus: 0.8,
    },
    options: getAnomalyRoutePoolOptions('riskyProtocol', ['crit', 'pierce']),
  },
  {
    id: 'cold-start-warp',
    name: '冷启偏折',
    contentKind: 'anomaly',
    anomalyClass: 'distortion',
    description: '牺牲一项属性，换取另一项强化',
    selection: {
      baseWeight: 1.05,
      maxRound: 2,
      phaseBonuses: {
        opening: 0.95,
        mid: 0.55,
      },
      noDominantRouteBonus: 0.6,
    },
    options: [
      {
        id: 'cold-start-warp-redline',
        label: '提火力',
        description: '伤害+4，射速+14%，HP-8',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 4,
              fireRate: 0.14,
            },
          },
          {
            type: 'heal',
            amount: -8,
          },
        ],
      },
      {
        id: 'cold-start-warp-brace',
        label: '补防护',
        description: '生命+6，恢复+0.1/s，弹速-12，回复8HP',
        effects: [
          {
            type: 'stats',
            modifiers: {
              maxHp: 6,
              regeneration: 0.1,
              projectileSpeed: -12,
            },
          },
          {
            type: 'heal',
            amount: 8,
          },
        ],
      },
    ],
  },

  {
    id: 'targeted-telemetry',
    name: '定向遥测',
    description: '看局势，补火力或防护',
    routeAffinity: 'dominant',
    selection: {
      baseWeight: 2.2,
      minRound: 2,
      maxRound: 4,
      phaseBonuses: {
        mid: 1,
        late: 0.7,
      },
      hintedRouteBonus: 0.8,
      dominantRouteBonus: 3.2,
      committedRouteBonus: 1.5,
      maturedRouteBonus: 0.6,
    },
    options: [
      {
        id: 'targeted-telemetry-press',
        label: '继续加力',
        description: '把当前路子再往前推一点',
        routeId: 'dominant',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 4,
              fireRate: 0.12,
            },
          },
          {
            type: 'route',
            routeId: 'dominant',
          },
        ],
      },
      {
        id: 'targeted-telemetry-buffer',
        label: '补生存',
        routeId: 'dominant',
        description: '生命+6，回复18HP',
        effects: [
          {
            type: 'stats',
            modifiers: {
              maxHp: 6,
            },
          },
          {
            type: 'heal',
            amount: 14,
          },
        ],
      },
    ],
  },
  {
    id: 'salvage-bay',
    name: '回收舱体',
    description: '拆成火力或防护',
    selection: {
      baseWeight: 3.4,
      phaseBonuses: {
        opening: 0.6,
        mid: 0.8,
        late: 0.2,
      },
      noDominantRouteBonus: 0.8,
    },
    options: [
      {
        id: 'salvage-bay-fire',
        label: '拆成火控件',
        description: '伤害和射速提升',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 5,
              fireRate: 0.16,
            },
          },
        ],
      },
      {
        id: 'salvage-bay-guard',
        label: '拆成缓冲甲',
        description: '恢复耐久，提高恢复速度',
        effects: [
          {
            type: 'heal',
            amount: 16,
          },
          {
            type: 'stats',
            modifiers: {
              regeneration: 0.12,
            },
          },
        ],
      },
    ],
  },
  {
    id: 'early-linecheck',
    name: '开局校线',
    description: '选择火力或生存方向',
    selection: {
      baseWeight: 3.98,
      phaseBonuses: {
        opening: 1.86,
        mid: 0.3,
      },
      noDominantRouteBonus: 1.4,
    },
    options: [
      {
        id: 'early-linecheck-offense',
        label: '提火力',
        description: '伤害+4，射速+14%',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 4,
              fireRate: 0.14,
            },
          },
        ],
      },
      {
        id: 'early-linecheck-guard',
        label: '补生存',
        description: '生命+8，恢复+0.08/s，回复12HP',
        effects: [
          {
            type: 'stats',
            modifiers: {
              maxHp: 8,
              regeneration: 0.08,
            },
          },
          {
            type: 'heal',
            amount: 12,
          },
        ],
      },
    ],
  },
  {
    id: 'signal-soften',
    name: '缓冲信号',
    description: '继续强化当前方向，或补充生存',
    routeAffinity: 'dominant',
    selection: {
      baseWeight: 2.74,
      minRound: 2,
      maxRound: 3,
      phaseBonuses: {
        mid: 1.62,
        late: 0.88,
      },
      hintedRouteBonus: 1.6,
      dominantRouteBonus: 2.4,
      committedRouteBonus: 1.4,
      maturedRouteBonus: 0.4,
    },
    options: [
      {
        id: 'signal-soften-lean',
        label: '强化当前',
        description: '射速+14%，移速+12',
        routeId: 'dominant',
        effects: [
          {
            type: 'stats',
            modifiers: {
              fireRate: 0.14,
              moveSpeed: 12,
            },
          },
        ],
      },
      {
        id: 'signal-soften-open',
        label: '补生存',
        description: '恢复+0.1/s，移速+10，回复10HP',
        effects: [
          {
            type: 'stats',
            modifiers: {
              regeneration: 0.1,
              moveSpeed: 10,
            },
          },
          {
            type: 'heal',
            amount: 10,
          },
        ],
      },
    ],
  },
  {
    id: 'coolant-detour',
    name: '冷却绕行',
    description: '提升射速和弹速，或提升生存',
    selection: {
      baseWeight: 3.04,
      minRound: 2,
      maxRound: 3,
      phaseBonuses: {
        mid: 1.42,
        late: 1.02,
      },
      noDominantRouteBonus: 1,
    },
    options: [
      {
        id: 'coolant-detour-tempo',
        label: '提射速',
        description: '射速+18%，弹速+18',
        effects: [
          {
            type: 'stats',
            modifiers: {
              fireRate: 0.18,
              projectileSpeed: 18,
            },
          },
        ],
      },
      {
        id: 'coolant-detour-guard',
        label: '补耐久',
        description: '生命+6，恢复+0.08/s，回复10HP',
        effects: [
          {
            type: 'stats',
            modifiers: {
              maxHp: 6,
              regeneration: 0.08,
            },
          },
          {
            type: 'heal',
            amount: 12,
          },
        ],
      },
    ],
  },
  {
    id: 'route-handoff',
    name: '侧频接驳',
    contentKind: 'anomaly',
    anomalyClass: 'routeWindow',
    description: '短暂机会，微调或切换战法',
    selection: {
      baseWeight: 0.34,
      minRound: 2,
      maxRound: 3,
      phaseBonuses: {
        mid: 0.48,
        late: 0.18,
      },
      noDominantRouteBonus: 0.1,
      hintedRouteBonus: 0.2,
      committedRouteBonus: 0.16,
      maturedRouteBonus: 0.05,
    },
    options: getAnomalyRoutePoolOptions('routeHandoff', ['crit', 'dash']),
  },

  {
    id: 'crit-reroute-window',
    name: '暴击抉择',
    contentKind: 'anomaly',
    anomalyClass: 'routeWindow',
    description: '选择暴击方向或其他方向',
    routeAffinity: 'crit',
    selection: {
      baseWeight: 1.22,
      minRound: 2,
      phaseBonuses: {
        mid: 1.68,
        late: 0.7,
      },
      hintedRouteBonus: 0.24,
      dominantRouteBonus: 2.68,
      committedRouteBonus: 1.62,
      maturedRouteBonus: 0.2,
      offRouteMultiplier: 0.05,
    },
    options: [
      {
        id: 'crit-reroute-window-direction',
        label: '稳住暴击',
        routeId: 'crit',
        description: '暴击+6%，射速+8%，恢复6HP',
        effects: [
          {
            type: 'stats',
            modifiers: {
              critChance: 0.06,
              fireRate: 0.08,
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
        id: 'crit-reroute-window-core',
        label: '堆暴击倍率',
        routeId: 'crit',
        description: '暴击+8%，暴击倍率+28%，射速+4%',
        effects: [
          {
            type: 'stats',
            modifiers: {
              critChance: 0.08,
              critMultiplier: 0.28,
              fireRate: 0.04,
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
    ],
  },
  {
    id: 'pierce-reroute-window',
    name: '穿透抉择',
    contentKind: 'anomaly',
    anomalyClass: 'routeWindow',
    description: '选择穿透方向或其他方向',
    routeAffinity: 'pierce',
    selection: {
      baseWeight: 1.45,
      minRound: 2,
      phaseBonuses: {
        mid: 2.05,
        late: 0.78,
      },
      hintedRouteBonus: 1,
      dominantRouteBonus: 3.05,
      committedRouteBonus: 1.9,
      maturedRouteBonus: 0.2,
      offRouteMultiplier: 0.05,
    },
    options: [
      {
        id: 'pierce-reroute-window-direction',
        label: '强化穿透',
        routeId: 'pierce',
        description: '弹速+14，射速+6%，恢复8HP',
        effects: [
          {
            type: 'stats',
            modifiers: {
              projectileSpeed: 14,
              fireRate: 0.06,
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
      {
        id: 'pierce-reroute-window-crit',
        label: '转暴击',
        routeId: 'crit',
        description: '伤害+3，射速+12%，暴击+3%，恢复8HP',
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
    ],
  },
  {
    id: 'dash-reroute-window',
    name: '穿梭转接',
    contentKind: 'anomaly',
    anomalyClass: 'routeWindow',
    description: '选择穿梭方向或其他方向',
    routeAffinity: 'dash',
    selection: {
      baseWeight: 1.45,
      minRound: 2,
      phaseBonuses: {
        mid: 2.05,
        late: 0.78,
      },
      hintedRouteBonus: 1,
      dominantRouteBonus: 3.05,
      committedRouteBonus: 1.9,
      maturedRouteBonus: 0.2,
      offRouteMultiplier: 0.05,
    },
    options: [
      {
        id: 'dash-reroute-window-hold',
        label: '强化穿梭',
        routeId: 'dash',
        description: '移速+10，恢复+0.08/s，回复10HP',
        effects: [
          {
            type: 'stats',
            modifiers: {
              moveSpeed: 10,
              regeneration: 0.08,
            },
          },
          {
            type: 'heal',
            amount: 10,
          },
        ],
      },
      {
        id: 'dash-reroute-window-crit',
        label: '转暴击',
        routeId: 'crit',
        description: '伤害+3，射速+12%，暴击+3%，恢复8HP',
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
    ],
  },
  {
    id: 'closeout-echo',
    name: '尾段回响',
    contentKind: 'anomaly',
    anomalyClass: 'bossEcho',
    contentTier: 'rare',
    description: '最终战斗前的最后一次强化',
    routeAffinity: 'dominant',
    selection: {
      baseWeight: 1.52,
      minRound: 3,
      phaseBonuses: {
        late: 2.12,
        finalPrep: 1.66,
      },
      noDominantRouteBonus: 0.2,
      dominantRouteBonus: 1.24,
      committedRouteBonus: 0.92,
      maturedRouteBonus: 0.48,
    },
    options: [
      {
        id: 'closeout-echo-press',
        label: '强化输出',
        routeId: 'dominant',
        description: '伤害+6，射速+16%',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 6,
              fireRate: 0.16,
            },
          },
        ],
      },
      {
        id: 'closeout-echo-buffer',
        label: '强化生存',
        routeId: 'dominant',
        description: '生命+8，恢复+0.12/s，回复10HP',
        effects: [
          {
            type: 'stats',
            modifiers: {
              maxHp: 8,
              regeneration: 0.12,
            },
          },
          {
            type: 'heal',
            amount: 10,
          },
        ],
      },
    ],
  },
  {
    id: 'blackbox-bargain',
    name: '黑匣押注',
    contentKind: 'anomaly',
    anomalyClass: 'distortion',
    contentTier: 'rare',
    description: '牺牲生命，换两种不同的突击方案',
    selection: {
      baseWeight: 1.58,
      minRound: 3,
      phaseBonuses: {
        late: 2.34,
        finalPrep: 1.18,
      },
      noDominantRouteBonus: 0.4,
      dominantRouteBonus: 0.68,
      committedRouteBonus: 0.46,
    },
    options: [
      {
        id: 'blackbox-bargain-dash',
        label: '拼命突击',
        routeId: 'dash',
        description: '生命-12，伤害+6，移速+16',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 6,
              moveSpeed: 16,
            },
          },
          {
            type: 'heal',
            amount: -12,
          },
        ],
      },
      {
        id: 'blackbox-bargain-crit',
        label: '拼命暴击',
        routeId: 'crit',
        description: '生命-10，暴击+10%，伤害+5',
        effects: [
          {
            type: 'stats',
            modifiers: {
              critChance: 0.1,
              damage: 5,
            },
          },
          {
            type: 'heal',
            amount: -10,
          },
        ],
      },
    ],
  },
  {
    id: 'boss-sightline',
    name: '首领准备',
    contentKind: 'anomaly',
    anomalyClass: 'bossEcho',
    contentTier: 'rare',
    description: '首领战前的最后调整',
    routeAffinity: 'dominant',
    selection: {
      baseWeight: 1.44,
      minRound: 3,
      phaseBonuses: {
        late: 2.18,
        finalPrep: 1.38,
      },
      noDominantRouteBonus: 0.15,
      dominantRouteBonus: 1.86,
      committedRouteBonus: 1.22,
      maturedRouteBonus: 0.62,
    },
    options: [
      {
        id: 'boss-sightline-press',
        label: '提火力',
        routeId: 'dominant',
        description: '伤害+5，射速+12%，生命-6',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 5,
              fireRate: 0.12,
              maxHp: -6,
            },
          },
        ],
      },
      {
        id: 'boss-sightline-brace',
        label: '补生存',
        routeId: 'dominant',
        description: '生命+8，恢复+0.12/s，射速-8%，回复10HP',
        effects: [
          {
            type: 'stats',
            modifiers: {
              maxHp: 8,
              regeneration: 0.12,
              fireRate: -0.08,
            },
          },
          {
            type: 'heal',
            amount: 10,
          },
        ],
      },
    ],
  },
  {
    id: 'overload-firecontrol',
    name: '过载火控',
    contentKind: 'anomaly',
    anomalyClass: 'distortion',
    description: '牺牲射速，换两种不同的火力配置',
    selection: {
      baseWeight: 0.95,
      minRound: 2,
      maxRound: 3,
      phaseBonuses: {
        mid: 1.2,
        late: 0.8,
      },
      noDominantRouteBonus: 1.1,
    },
    options: [
      {
        id: 'overload-firecontrol-crit',
        label: '重炮暴击',
        routeId: 'crit',
        description: '射速-25%，伤害+6，暴击+6%',
        effects: [
          {
            type: 'stats',
            modifiers: {
              fireRate: -0.25,
              damage: 6,
              critChance: 0.06,
            },
          },
        ],
      },
      {
        id: 'overload-firecontrol-pierce',
        label: '重炮穿透',
        routeId: 'pierce',
        description: '射速-25%，伤害+5，弹速+20',
        effects: [
          {
            type: 'stats',
            modifiers: {
              fireRate: -0.25,
              damage: 5,
              projectileSpeed: 20,
            },
          },
        ],
      },
    ],
  },
  {
    id: 'compressed-cycle',
    name: '压缩循环',
    contentKind: 'anomaly',
    anomalyClass: 'distortion',
    description: '牺牲伤害，换射速或弹速',
    selection: {
      baseWeight: 0.92,
      minRound: 2,
      maxRound: 3,
      phaseBonuses: {
        mid: 1.15,
        late: 0.85,
      },
      noDominantRouteBonus: 1.05,
    },
    options: [
      {
        id: 'compressed-cycle-dash',
        label: '高频走射',
        routeId: 'dash',
        description: '伤害-3，射速+55%，移速+12',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: -3,
              fireRate: 0.55,
              moveSpeed: 12,
            },
          },
        ],
      },
      {
        id: 'compressed-cycle-pierce',
        label: '高速穿透',
        routeId: 'pierce',
        description: '伤害-3，弹速+30，暴击+4%',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: -3,
              projectileSpeed: 30,
              critChance: 0.04,
            },
          },
        ],
      },
    ],
  },
];

const RAW_ANOMALY_EVENT_CATALOG: EventDefinition[] = [
  {
    id: 'fixed-turret-protocol',
    name: '炮台协议',
    contentKind: 'anomaly',
    anomalyClass: 'distortion',
    description: '牺牲移速或射速，换火力配置',
    selection: {
      baseWeight: 1.1,
      minRound: 2,
      maxRound: 3,
      phaseBonuses: {
        mid: 1.2,
        late: 0.8,
      },
      noDominantRouteBonus: 0.8,
    },
    options: [
      {
        id: 'fixed-turret-protocol-crit',
        label: '定点重炮',
        routeId: 'crit',
        description: '移速-35，伤害+5，射速+30%',
        effects: [
          {
            type: 'stats',
            modifiers: {
              moveSpeed: -35,
              damage: 5,
              fireRate: 0.3,
            },
          },
        ],
      },
      {
        id: 'fixed-turret-protocol-dash',
        label: '游击改装',
        routeId: 'dash',
        description: '射速-25%，移速+20，暴击+5%',
        effects: [
          {
            type: 'stats',
            modifiers: {
              fireRate: -0.25,
              moveSpeed: 20,
              critChance: 0.05,
            },
          },
        ],
      },
    ],
  },
  {
    id: 'redline-light-armor',
    name: '红线轻甲协议',
    contentKind: 'anomaly',
    anomalyClass: 'distortion',
    description: '牺牲装甲，换两种不同的输出方向',
    selection: {
      baseWeight: 1,
      minRound: 1,
      phaseBonuses: {
        opening: 0.35,
        mid: 1.05,
        late: 0.9,
      },
      noDominantRouteBonus: 0.9,
    },
    options: [
      {
        id: 'redline-light-armor-pierce',
        label: '拆甲提穿透',
        routeId: 'pierce',
        description: '生命-18，伤害+5，弹速+20',
        effects: [
          {
            type: 'stats',
            modifiers: {
              maxHp: -18,
              damage: 5,
              projectileSpeed: 20,
            },
          },
        ],
      },
      {
        id: 'redline-light-armor-crit',
        label: '拆甲提暴击',
        routeId: 'crit',
        description: '生命-16，暴击+8%，伤害+4',
        effects: [
          {
            type: 'stats',
            modifiers: {
              maxHp: -16,
              critChance: 0.08,
              damage: 4,
            },
          },
        ],
      },
    ],
  },
  {
    id: 'heavy-buffer-protocol',
    name: '重装缓冲协议',
    contentKind: 'anomaly',
    anomalyClass: 'distortion',
    description: '牺牲射速或移速，换生存能力',
    selection: {
      baseWeight: 0.9,
      minRound: 2,
      maxRound: 3,
      phaseBonuses: {
        mid: 0.85,
        late: 1.1,
      },
      noDominantRouteBonus: 0.65,
    },
    options: [
      {
        id: 'heavy-buffer-dash',
        label: '轻装突击',
        routeId: 'dash',
        description: '移速-20，生命+16，射速+30%',
        effects: [
          {
            type: 'stats',
            modifiers: {
              moveSpeed: -20,
              maxHp: 16,
              fireRate: 0.3,
            },
          },
        ],
      },
      {
        id: 'heavy-buffer-pierce',
        label: '重装穿透',
        routeId: 'pierce',
        description: '射速-20%，生命+20，弹速+16',
        effects: [
          {
            type: 'stats',
            modifiers: {
              fireRate: -0.2,
              maxHp: 20,
              projectileSpeed: 16,
            },
          },
        ],
      },
    ],
  },

  {
    id: 'pickup-drive-protocol',
    name: '回收驱动协议',
    contentKind: 'anomaly',
    anomalyClass: 'hybrid',
    description: '牺牲伤害，换取移速或弹速提升',
    selection: {
      baseWeight: 0.92,
      minRound: 2,
      phaseBonuses: {
        mid: 1.1,
        late: 0.9,
      },
      dominantRouteBonus: 0.3,
    },
    options: [
      {
        id: 'pickup-drive-tempo',
        label: '接入回收驱动',
        gameplayLabel: '拾取驱动',
        gainLabel: '移速+12',
        costLabel: '基础伤害降低',
        routeId: 'dominant',
        description: '伤害-3，移速+12',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: -3,
              moveSpeed: 12,
            },
          },
          {
            type: 'route',
            routeId: 'dominant',
          },
        ],
      },
      {
        id: 'pickup-drive-magnet',
        label: '接入磁轨回收',
        gameplayLabel: '回收拉扯',
        gainLabel: '弹速+24，移速+10',
        costLabel: '射速降低',
        routeId: 'dominant',
        description: '射速-18%，弹速+24，移速+10',
        effects: [
          {
            type: 'stats',
            modifiers: {
              fireRate: -0.18,
              projectileSpeed: 24,
              moveSpeed: 10,
            },
          },
          {
            type: 'route',
            routeId: 'dominant',
          },
        ],
      },
    ],
  },
  {
    id: 'dash-charge-protocol',
    name: '近战抉择',
    contentKind: 'anomaly',
    anomalyClass: 'routeWindow',
    routeAffinity: 'dash',
    description: '接近敌人将造成更高伤害。',
    selection: {
      baseWeight: 0.95,
      minRound: 2,
      phaseBonuses: {
        mid: 0.95,
        late: 1.1,
      },
      hintedRouteBonus: 0.6,
      dominantRouteBonus: 1.2,
      offRouteMultiplier: 0.42,
    },
    options: [
      {
        id: 'dash-charge-direction',
        label: '强化接近',
        routeId: 'dash',
        description: '移速+12，冲刺间隔-18%',
        effects: [
          {
            type: 'stats',
            modifiers: {
              moveSpeed: 12,
              dashInterval: -0.18,
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
        id: 'dash-charge-core',
        label: '强化反击',
        routeId: 'dash',
        description: '冲刺伤害+8，无敌+10%，移速+6',
        effects: [
          {
            type: 'stats',
            modifiers: {
              dashPulseDamage: 8,
              dashInvulnerability: 0.1,
              moveSpeed: 6,
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
    ],
  },
  {
    id: 'crit-lock-protocol',
    name: '暴击狠打',
    contentKind: 'anomaly',
    anomalyClass: 'routeWindow',
    routeAffinity: 'crit',
    description: '暴击已成型，选择继续强化或全面进攻',
    selection: {
      baseWeight: 0.9,
      minRound: 2,
      phaseBonuses: {
        mid: 0.9,
        late: 1.15,
      },
      hintedRouteBonus: 0.6,
      dominantRouteBonus: 1.15,
      offRouteMultiplier: 0.45,
    },
    options: [
      {
        id: 'crit-lock-transform',
        label: '强化爆发',
        routeId: 'crit',
        description: '生命-12，伤害+4，射速+12%，暴击倍率+42%',
        effects: [
          {
            type: 'stats',
            modifiers: {
              maxHp: -12,
              damage: 4,
              fireRate: 0.12,
              critMultiplier: 0.42,
              critOverdriveDurationBonus: 0.24,
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
        id: 'crit-lock-finisher',
        label: '终结回路',
        routeId: 'crit',
        description: '溅射+12%，过载暴击+5%，过载持续+35%',
        effects: [
          {
            type: 'stats',
            modifiers: {
              critSplashRadius: 0.12,
              critOverdriveCritBonus: 0.05,
              critOverdriveDurationBonus: 0.35,
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
    ],
  },
];

function normalizeEventOptionEffects(
  eventDef: EventDefinition,
  eventId: string,
  option: EventDefinition['options'][number],
): EventDefinition['options'][number] {
  if (!option.effects || option.effects.length === 0) {
    return option;
  }

  const normalizedEffects =
    (eventDef.contentKind ?? 'event') === 'anomaly'
      ? option.effects
      : normalizeEffectsToSingleStat(
          `${eventId}:${option.id}`,
          option.effects,
          option.routeId && option.routeId !== 'dominant' ? option.routeId : undefined,
        );

  return {
    ...option,
    effects: appendImplicitAnomalyRouteSupport(eventDef, option, normalizedEffects),
  };
}

export const EVENT_CATALOG: EventDefinition[] = RAW_EVENT_CATALOG.filter(
  (eventDef) => (eventDef.contentKind ?? 'event') === 'event',
).map((eventDef) => ({
  ...eventDef,
  options: eventDef.options.map((option) => normalizeEventOptionEffects(eventDef, eventDef.id, option)),
}));

export const STANDARD_EVENT_CATALOG = EVENT_CATALOG;

export const ANOMALY_EVENT_CATALOG: EventDefinition[] = RAW_ANOMALY_EVENT_CATALOG.map((eventDef) => ({
  ...eventDef,
  options: eventDef.options.map((option) => normalizeEventOptionEffects(eventDef, eventDef.id, option)),
}));

export const ALL_EVENT_CATALOG: EventDefinition[] = [...RAW_EVENT_CATALOG, ...RAW_ANOMALY_EVENT_CATALOG].map((eventDef) => ({
  ...eventDef,
  options: eventDef.options.map((option) => normalizeEventOptionEffects(eventDef, eventDef.id, option)),
}));

export function getEventCatalogByKind(contentKind: EventContentKind): EventDefinition[] {
  if (contentKind === 'anomaly') {
    return ANOMALY_EVENT_CATALOG.length > 0 ? ANOMALY_EVENT_CATALOG : EVENT_CATALOG;
  }
  return STANDARD_EVENT_CATALOG.length > 0 ? STANDARD_EVENT_CATALOG : EVENT_CATALOG;
}

function appendImplicitAnomalyRouteSupport(
  eventDef: EventDefinition,
  option: EventDefinition['options'][number],
  effects: ContentEffect[],
): ContentEffect[] {
  if ((eventDef.contentKind ?? 'event') !== 'anomaly') {
    return effects;
  }

  if (effects.some((effect) => effect.type === 'route')) {
    return effects;
  }

  const routeSupport = resolveImplicitAnomalyRouteSupport(eventDef, option);
  if (!routeSupport) {
    return effects;
  }

  return [
    ...effects.map((effect) =>
      effect.type === 'stats'
        ? {
            type: 'stats' as const,
            modifiers: {
              ...effect.modifiers,
            },
          }
        : { ...effect },
    ),
    ...Array.from({ length: routeSupport.count }, () => ({
      type: 'route' as const,
      routeId: routeSupport.routeId,
    })),
  ];
}

function resolveImplicitAnomalyRouteSupport(
  eventDef: EventDefinition,
  option: EventDefinition['options'][number],
): { routeId: RouteReference; count: number } | null {
  const explicitRoute = option.routeId ?? eventDef.routeAffinity;

  if (eventDef.anomalyClass === 'routeWindow') {
    return explicitRoute ? { routeId: explicitRoute, count: 2 } : null;
  }

  if (eventDef.anomalyClass === 'bossEcho') {
    return { routeId: explicitRoute ?? 'dominant', count: 1 };
  }

  if (eventDef.anomalyClass === 'hybrid') {
    return { routeId: explicitRoute ?? 'dominant', count: 1 };
  }

  if (eventDef.anomalyClass === 'distortion') {
    return { routeId: explicitRoute ?? 'dominant', count: 1 };
  }

  return null;
}
