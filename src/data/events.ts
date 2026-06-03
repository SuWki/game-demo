import { getAnomalyRoutePoolOptions } from './anomalyRoutePools';
import { normalizeEffectsToSingleStat } from './upgrades';
import type { ContentEffect, EventContentKind, EventDefinition, RouteReference } from '../game/types';

const RAW_EVENT_CATALOG: EventDefinition[] = [
  {
    id: 'field-maintenance',
    name: '临时整备',
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
        label: '补强外甲',
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
    description: '先受伤，再换转向机会',
    selection: {
      baseWeight: 1.15,
      maxRound: 2,
      phaseBonuses: {
        opening: 0.9,
        mid: 0.15,
      },
      noDominantRouteBonus: 0.8,
    },
    options: getAnomalyRoutePoolOptions('riskyProtocol', ['crit', 'pierce', 'dash']),
  },
  {
    id: 'cold-start-warp',
    name: '冷启偏折',
    contentKind: 'anomaly',
    anomalyClass: 'distortion',
    description: '能量涌动，转火力或防护',
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
        label: '先吞一口红线',
        description: '火力更猛，但先受伤',
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
        label: '先垫一层缓冲',
        description: '耐久和恢复提升，但弹道变慢',
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
    id: 'route-calibration',
    name: '读数校准',
    description: '强化打法，或恢复状态',
    routeAffinity: 'dominant',
    selection: {
      baseWeight: 2.3,
      minRound: 2,
      phaseBonuses: {
        mid: 1.3,
        late: 0.4,
      },
      hintedRouteBonus: 1.2,
      dominantRouteBonus: 3.4,
      committedRouteBonus: 1.6,
      maturedRouteBonus: 0.2,
    },
    options: [
      {
        id: 'route-calibration-focus',
        label: '继续压当前方向',
        description: '强化核心能力',
        routeId: 'dominant',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 5,
              fireRate: 0.15,
            },
          },
          {
            type: 'route',
            routeId: 'dominant',
          },
        ],
      },
      {
        id: 'route-calibration-stabilize',
        label: '补一个稳态',
        description: '恢复耐久并提高射速',
        effects: [
          {
            type: 'stats',
            modifiers: {
              fireRate: 0.2,
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
    id: 'targeted-telemetry',
    name: '定向遥测',
    description: '发现适合的数据，强化或防御',
    routeAffinity: 'dominant',
    selection: {
      baseWeight: 2.2,
      minRound: 2,
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
        label: '追当前窗口',
        description: '流派更稳，基础火力更高',
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
        label: '换一段缓冲',
        description: '恢复耐久，提高上限',
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
    name: '回收舱段',
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
    id: 'signal-soften',
    name: '缓冲信号',
    description: '初见成效，继续深入或保留灵活',
    routeAffinity: 'dominant',
    selection: {
      baseWeight: 2.4,
      minRound: 2,
      phaseBonuses: {
        mid: 1.4,
        late: 0.7,
      },
      hintedRouteBonus: 1.6,
      dominantRouteBonus: 2.4,
      committedRouteBonus: 1.4,
      maturedRouteBonus: 0.4,
    },
    options: [
      {
        id: 'signal-soften-lean',
        label: '顺着读法微调',
        description: '强化当前方向，保留转向余地',
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
        label: '保留转向余地',
        description: '提升恢复和机动',
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
    description: '转为更快攻击或更稳防护',
    selection: {
      baseWeight: 2.8,
      minRound: 2,
      phaseBonuses: {
        mid: 1.2,
        late: 0.8,
      },
      noDominantRouteBonus: 1,
    },
    options: [
      {
        id: 'coolant-detour-tempo',
        label: '换节奏窗口',
        description: '射速和弹速提升',
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
        label: '换稳定容错',
        description: '恢复耐久，提升上限和恢复',
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
      baseWeight: 0.26,
      minRound: 2,
      phaseBonuses: {
        mid: 0.36,
        late: 0.12,
      },
      noDominantRouteBonus: 0.1,
      hintedRouteBonus: 0.2,
      committedRouteBonus: 0.16,
      maturedRouteBonus: 0.05,
    },
    options: getAnomalyRoutePoolOptions('routeHandoff', ['crit', 'pierce', 'dash']),
  },
  {
    id: 'crit-reroute-window',
    name: '暴击转接窗',
    contentKind: 'anomaly',
    anomalyClass: 'routeWindow',
    description: '先把暴击方向锁住，再决定要不要换线',
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
      ...getAnomalyRoutePoolOptions('critRerouteWindow', ['pierce', 'dash']),
      {
        id: 'crit-reroute-window-hold',
        routeId: 'crit',
        label: '先锁暴击方向',
        gameplayLabel: '方向锁定',
        gainLabel: '暴击窗口更稳，后面更容易接核心件',
        costLabel: '少量通用强化让位',
        description: '不转向，先把暴击路站稳',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 4,
              fireRate: 0.1,
            },
          },
          {
            type: 'heal',
            amount: 10,
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
    name: '穿透转接窗',
    contentKind: 'anomaly',
    anomalyClass: 'routeWindow',
    description: '穿透成型，可切换其他打法',
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
      ...getAnomalyRoutePoolOptions('pierceRerouteWindow', ['crit', 'dash']),
      {
        id: 'pierce-reroute-window-hold',
        routeId: 'pierce',
        label: '先稳当前清线',
        description: '不转向，先补火力和耐久',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 3,
              projectileSpeed: 16,
            },
          },
          {
            type: 'heal',
            amount: 10,
          },
          {
            type: 'route',
            routeId: 'pierce',
          },
        ],
      },
    ],
  },
  {
    id: 'dash-reroute-window',
    name: '穿梭转接窗',
    contentKind: 'anomaly',
    anomalyClass: 'routeWindow',
    description: '穿梭成型，可切换其他打法',
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
      ...getAnomalyRoutePoolOptions('dashRerouteWindow', ['crit', 'pierce']),
      {
        id: 'dash-reroute-window-hold',
        label: '先稳当前机动',
        description: '不转向，先补移速、恢复和耐久',
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
    ],
  },
  {
    id: 'blackbox-bargain',
    name: '黑匣押注',
    contentKind: 'anomaly',
    anomalyClass: 'distortion',
    contentTier: 'rare',
    description: '一次性资源，转火力或防护',
    selection: {
      baseWeight: 1.28,
      minRound: 3,
      phaseBonuses: {
        late: 2,
        finalPrep: 0.7,
      },
      noDominantRouteBonus: 0.4,
    },
    options: [
      {
        id: 'blackbox-bargain-redline',
        label: '压成高输出',
        description: '伤害和射速提升，但先受伤',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 8,
              fireRate: 0.24,
            },
          },
          {
            type: 'heal',
            amount: -10,
          },
        ],
      },
      {
        id: 'blackbox-bargain-slack',
        label: '拆成喘息余地',
        description: '恢复、机动和弹道缓冲',
        effects: [
          {
            type: 'stats',
            modifiers: {
              projectileSpeed: 24,
              moveSpeed: 14,
              regeneration: 0.14,
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
];


const RAW_ANOMALY_EVENT_CATALOG: EventDefinition[] = [
  {
    id: 'fixed-turret-protocol',
    name: '固定炮台协议',
    contentKind: 'anomaly',
    anomalyClass: 'distortion',
    description: '牺牲机动，换取火力',
    selection: {
      baseWeight: 1.1,
      minRound: 2,
      phaseBonuses: {
        mid: 1.2,
        late: 0.8,
      },
      noDominantRouteBonus: 0.8,
    },
    options: [
      {
        id: 'fixed-turret-rapid',
        label: '接入速射炮台',
        gameplayLabel: '炮台化',
        gainLabel: '射速大幅提高，适合找位置定点输出',
        costLabel: '移速大幅降低',
        description: '移动变慢，持续火力更强',
        effects: [
          {
            type: 'stats',
            modifiers: {
              moveSpeed: -45,
              fireRate: 0.55,
              projectileSpeed: 12,
            },
          },
        ],
      },
      {
        id: 'fixed-turret-cannon',
        label: '接入重炮炮台',
        gameplayLabel: '慢速重炮',
        gainLabel: '单发伤害大幅提高',
        costLabel: '移速降低，射速降低',
        description: '机动和射速降低，单发伤害更高',
        effects: [
          {
            type: 'stats',
            modifiers: {
              moveSpeed: -35,
              fireRate: -0.18,
              damage: 9,
              projectileSpeed: -12,
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
        description: '用装甲换速度和火力',
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
        id: 'redline-light-armor-burst',
        label: '拆甲提火力',
        gameplayLabel: '玻璃大炮',
        gainLabel: '伤害与移速提高',
        costLabel: '生命上限降低',
        description: '更快更痛，但更脆弱',
        effects: [
          {
            type: 'stats',
            modifiers: {
              maxHp: -18,
              damage: 6,
              moveSpeed: 18,
            },
          },
        ],
      },
      {
        id: 'redline-light-armor-tempo',
        label: '拆甲提节奏',
        gameplayLabel: '轻甲快攻',
        gainLabel: '移速和射速提高',
        costLabel: '生命上限降低',
        description: '放弃耐久，换走位和射速',
        effects: [
          {
            type: 'stats',
            modifiers: {
              maxHp: -16,
              moveSpeed: 16,
              fireRate: 0.28,
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
    description: '用火控和机动换防护',
    selection: {
      baseWeight: 0.9,
      minRound: 2,
      phaseBonuses: {
        mid: 0.85,
        late: 1.1,
      },
      noDominantRouteBonus: 0.65,
    },
    options: [
      {
        id: 'heavy-buffer-armor',
        label: '接入重装外甲',
        gameplayLabel: '稳住压力',
        gainLabel: '生命上限明显提高',
        costLabel: '移速和射速降低',
        description: '牺牲灵活换生存',
        effects: [
          {
            type: 'stats',
            modifiers: {
              maxHp: 24,
              moveSpeed: -18,
              fireRate: -0.2,
            },
          },
        ],
      },
      {
        id: 'heavy-buffer-stabilizer',
        label: '接入缓冲核心',
        gameplayLabel: '稳态续航',
        gainLabel: '生命上限和再生提高',
        costLabel: '伤害和弹速降低',
        description: '击杀变慢，但更稳',
        effects: [
          {
            type: 'stats',
            modifiers: {
              maxHp: 16,
              regeneration: 0.12,
              damage: -3,
              projectileSpeed: -16,
            },
          },
        ],
      },
    ],
  },
  {
    id: 'rapid-light-rounds',
    name: '高频轻弹协议',
    contentKind: 'anomaly',
    anomalyClass: 'distortion',
    description: '单发降低，射速提高',
    selection: {
      baseWeight: 1.05,
      minRound: 2,
      phaseBonuses: {
        mid: 1.2,
        late: 0.75,
      },
      hintedRouteBonus: 0.4,
    },
    options: [
      {
        id: 'rapid-light-rounds-trigger',
        label: '切换轻弹循环',
        gameplayLabel: '高频触发',
        gainLabel: '射速大幅提高，更容易触发流派效果',
        costLabel: '单发伤害降低',
        description: '高频命中，触发流派效果',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: -4,
              fireRate: 0.65,
              critChance: 0.03,
            },
          },
        ],
      },
      {
        id: 'rapid-light-rounds-fan',
        label: '切换散射轻弹',
        gameplayLabel: '多弹压制',
        gainLabel: '多重提高，射速提高',
        costLabel: '单发伤害降低，弹速降低',
        description: '火力铺开，适合清小怪',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: -5,
              fireRate: 0.24,
              multishot: 1,
              projectileSpeed: -18,
            },
          },
        ],
      },
    ],
  },
  {
    id: 'heavy-cannon-overload',
    name: '重炮过载协议',
    contentKind: 'anomaly',
    anomalyClass: 'distortion',
    description: '射速降低，单发提高',
    selection: {
      baseWeight: 0.98,
      minRound: 2,
      phaseBonuses: {
        mid: 0.95,
        late: 1.15,
      },
      committedRouteBonus: 0.25,
    },
    options: [
      {
        id: 'heavy-cannon-overload-impact',
        label: '接入重炮核心',
        gameplayLabel: '慢速重炮',
        gainLabel: '单发伤害大幅提高',
        costLabel: '射速降低，弹速降低',
        description: '开火变慢，但单发更强',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 10,
              fireRate: -0.35,
              projectileSpeed: -20,
            },
          },
        ],
      },
      {
        id: 'heavy-cannon-overload-crit',
        label: '接入要害重炮',
        gameplayLabel: '强敌锁定',
        gainLabel: '伤害与暴击伤害提高',
        costLabel: '射速降低，移速降低',
        routeId: 'crit',
        description: '集中火力，适合打精英',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 5,
              critMultiplier: 0.32,
              fireRate: -0.26,
              moveSpeed: -10,
            },
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
    id: 'pickup-drive-protocol',
    name: '回收驱动协议',
    contentKind: 'anomaly',
    anomalyClass: 'hybrid',
    description: '基础火力降低，但经验和成长更快',
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
        gainLabel: '移速提高，当前流派 +1',
        costLabel: '基础伤害降低',
        routeId: 'dominant',
        description: '伤害变低，但更鼓励追击和回收',
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
        gainLabel: '弹速和移速提高，当前流派 +1',
        costLabel: '射速降低',
        routeId: 'dominant',
        description: '输出降低，回收和走位提升',
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
    name: '穿梭蓄能协议',
    contentKind: 'anomaly',
    anomalyClass: 'routeWindow',
    routeAffinity: 'dash',
    description: '普通射击变弱，穿梭后爆发',
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
        id: 'dash-charge-pulse',
        label: '接入穿梭脉冲',
        gameplayLabel: '换位爆发',
        gainLabel: '穿梭脉冲伤害提高，穿梭流 +1',
        costLabel: '基础伤害降低',
        routeId: 'dash',
        description: '普通射击变弱，穿梭后反击更强',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: -3,
              dashPulseDamage: 10,
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
        ],
      },
      {
        id: 'dash-charge-graze',
        label: '接入擦身蓄能',
        gameplayLabel: '擦身反打',
        gainLabel: '移速和穿梭窗口提高',
        costLabel: '生命上限降低',
        routeId: 'dash',
        description: '容错下降，擦身反击更强',
        effects: [
          {
            type: 'stats',
            modifiers: {
              maxHp: -12,
              moveSpeed: 16,
              dashInvulnerability: 0.12,
            },
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
    name: '暴击锁定协议',
    contentKind: 'anomaly',
    anomalyClass: 'routeWindow',
    routeAffinity: 'crit',
    description: '把暴击做成真正的核心回路，清怪慢一点也值',
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
        id: 'crit-lock-focus',
        label: '接入暴击锁定',
        gameplayLabel: '核心回路',
        gainLabel: '暴击更稳，破绽更容易叠满',
        costLabel: '射速会慢一点',
        routeId: 'crit',
        description: '让暴击先稳住，后面更容易连续爆点',
        effects: [
          {
            type: 'stats',
            modifiers: {
              fireRate: -0.22,
              critChance: 0.08,
              critMultiplier: 0.35,
            },
          },
          {
            type: 'route',
            routeId: 'crit',
          },
        ],
      },
      {
        id: 'crit-lock-redline',
        label: '接入红线锁定',
        gameplayLabel: '高压爆发',
        gainLabel: '伤害更高，爆点更容易炸开',
        costLabel: '血更薄，出手更慢',
        routeId: 'crit',
        description: '把容错压低，换一口更狠的爆发',
        effects: [
          {
            type: 'stats',
            modifiers: {
              maxHp: -14,
              damage: 4,
              fireRate: -0.16,
              critMultiplier: 0.42,
            },
          },
          {
            type: 'route',
            routeId: 'crit',
          },
        ],
      },
    ],
  },
  // 高风险高收益异常节点 - Build爽感迭代
  {
    id: 'glass-crit-protocol',
    name: '玻璃火力',
    contentKind: 'anomaly',
    anomalyClass: 'distortion',
    description: '把暴击做成玻璃大炮，成了就一路收，没成就很脆',
    selection: {
      baseWeight: 0.85,
      minRound: 2,
      phaseBonuses: {
        mid: 1.1,
        late: 0.9,
      },
      dominantRouteBonus: 1.2,
      offRouteMultiplier: 0.6,
    },
    options: [
      {
        id: 'glass-crit-accept',
        label: '接入玻璃火力',
        gameplayLabel: '玻璃大炮',
        gainLabel: '暴击爆点留下裂纹，更容易清线',
        costLabel: '生命上限大幅降低',
        routeId: 'crit',
        description: '换成高风险高回报的暴击玩法',
        effects: [
          {
            type: 'stats',
            modifiers: {
              maxHp: -24,
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
        id: 'glass-crit-decline',
        label: '拒绝改造',
        description: '保持配置，少量通用强化',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 2,
              maxHp: 4,
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
    id: 'heavy-pierce-protocol',
    name: '重炮模式',
    contentKind: 'anomaly',
    anomalyClass: 'distortion',
    description: '移动变慢，但穿透后的裂纹扩散更强',
    selection: {
      baseWeight: 0.82,
      minRound: 2,
      phaseBonuses: {
        mid: 1.0,
        late: 1.1,
      },
      dominantRouteBonus: 1.2,
      offRouteMultiplier: 0.6,
    },
    options: [
      {
        id: 'heavy-pierce-accept',
        label: '接入重炮核心',
        gameplayLabel: '重炮阵地',
        gainLabel: '穿透裂纹扩散范围和伤害提高',
        costLabel: '移速大幅降低',
        routeId: 'pierce',
        description: '移动变慢，但贯穿后的裂纹扩散更强',
        effects: [
          {
            type: 'stats',
            modifiers: {
              moveSpeed: -35,
              pierceEchoDamageBonus: 0.12,
              crackSpreadRadius: 0.15,
            },
          },
          {
            type: 'route',
            routeId: 'pierce',
          },
        ],
      },
      {
        id: 'heavy-pierce-decline',
        label: '拒绝改造',
        description: '保持配置，少量通用强化',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 2,
              moveSpeed: 6,
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
    id: 'no-heal-pulse-protocol',
    name: '断回血协议',
    contentKind: 'anomaly',
    anomalyClass: 'distortion',
    description: '不再自动回血，但脉冲命中会帮你叠破绽',
    selection: {
      baseWeight: 0.78,
      minRound: 2,
      phaseBonuses: {
        mid: 1.05,
        late: 1.15,
      },
      dominantRouteBonus: 1.2,
      offRouteMultiplier: 0.55,
    },
    options: [
      {
        id: 'no-heal-pulse-accept',
        label: '接入断回血协议',
        gameplayLabel: '以攻代守',
        gainLabel: '脉冲命中叠破绽，更容易触发爆发',
        costLabel: '无法自然回血',
        routeId: 'dash',
        description: '不再自动回血，但脉冲命中会帮你叠破绽',
        effects: [
          {
            type: 'stats',
            modifiers: {
              regeneration: -0.24,
              dashPulseDamage: 8,
              dashChargeSpeed: 0.1,
            },
          },
          {
            type: 'route',
            routeId: 'dash',
          },
        ],
      },
      {
        id: 'no-heal-pulse-decline',
        label: '拒绝改造',
        description: '保持配置，少量通用强化',
        effects: [
          {
            type: 'stats',
            modifiers: {
              regeneration: 0.06,
              maxHp: 4,
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
  // 高风险高回报异常节点 - 可能起飞也可能崩盘
  {
    id: 'all-in-gamble',
    name: '孤注一掷',
    contentKind: 'anomaly',
    anomalyClass: 'distortion',
    description: '随机获得大量强化或负面效果',
    selection: {
      baseWeight: 0.45,
      minRound: 2,
      phaseBonuses: {
        mid: 0.8,
        late: 1.4,
      },
      noDominantRouteBonus: 1.2,
    },
    options: [
      {
        id: 'all-in-roll',
        label: '掷骰子',
        gameplayLabel: '赌徒',
        gainLabel: '50%几率获得大量强化，50%几率获得负面效果',
        costLabel: '完全随机，可能直接崩盘',
        description: '随机决定命运',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 8,
              fireRate: 0.25,
              critChance: 0.08,
              maxHp: -15,
            },
          },
        ],
      },
      {
        id: 'all-in-pass',
        label: '放弃赌局',
        description: '稳妥选择，少量通用强化',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 2,
              maxHp: 6,
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
    id: 'demonic-exchange',
    name: '恶魔交易',
    contentKind: 'anomaly',
    anomalyClass: 'distortion',
    description: '用一个属性换取另一个属性的极限提升',
    selection: {
      baseWeight: 0.52,
      minRound: 2,
      phaseBonuses: {
        mid: 1.1,
        late: 1.3,
      },
      dominantRouteBonus: 1.4,
    },
    options: [
      {
        id: 'demonic-damage-for-speed',
        label: '以速换力',
        gameplayLabel: '重炮手',
        gainLabel: '伤害翻倍',
        costLabel: '移速降至极限',
        description: '伤害翻倍，但移速大幅降低',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 14,
              moveSpeed: -80,
            },
          },
        ],
      },
      {
        id: 'demonic-speed-for-crit',
        label: '以稳换敏',
        gameplayLabel: '鬼影',
        gainLabel: '移速和攻速大幅提升',
        costLabel: '生命上限减半',
        description: '移速和攻速大幅提升，但生命上限减半',
        effects: [
          {
            type: 'stats',
            modifiers: {
              moveSpeed: 45,
              fireRate: 0.35,
              maxHp: -55,
            },
          },
        ],
      },
      {
        id: 'demonic-decline',
        label: '拒绝交易',
        description: '保持现状，少量恢复',
        effects: [
          {
            type: 'heal',
            amount: 15,
          },
        ],
      },
    ],
  },
  {
    id: 'omega-overdrive',
    name: '欧米伽超载',
    contentKind: 'anomaly',
    anomalyClass: 'distortion',
    description: '所有属性全面提升，但持续受到伤害',
    selection: {
      baseWeight: 0.38,
      minRound: 3,
      phaseBonuses: {
        late: 1.6,
        finalPrep: 0.8,
      },
      dominantRouteBonus: 1.3,
    },
    options: [
      {
        id: 'omega-accept',
        label: '接受超载',
        gameplayLabel: '超载体',
        gainLabel: '所有核心属性大幅提升',
        costLabel: '无法自然回血，且持续受到伤害',
        description: '伤害、攻速、移速、暴击全面提升，但无法回血',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 6,
              fireRate: 0.3,
              moveSpeed: 25,
              critChance: 0.1,
              regeneration: -0.5,
            },
          },
          {
            type: 'heal',
            amount: -10,
          },
        ],
      },
      {
        id: 'omega-decline',
        label: '拒绝超载',
        description: '稳妥选择，少量强化',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 2,
              maxHp: 4,
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
