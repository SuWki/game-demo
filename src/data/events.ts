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
    description: '要么把这套继续拧紧，要么先缓一口气',
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
        label: '顺着这条线再压一手',
        description: '把这套核心再拧紧一点',
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
        description: '缓一口气，顺手把射速提起来',
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
    description: '发现合适的路数，补火力或防护',
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
        description: '这条线会更稳，火力也更扎实',
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
    name: '暴击抉择',
    contentKind: 'anomaly',
    anomalyClass: 'routeWindow',
    description: '这一下会决定暴击是先稳住，还是直接改成重击快打。',
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
        label: '先走暴击',
        gameplayLabel: '起手',
        gainLabel: '更容易连着打出暴击',
        costLabel: '先少一点容错',
        routeId: 'crit',
        anomalyRole: 'direction',
        description: '先把暴击打顺，后面更容易连着出重击。',
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
        label: '补暴击火力',
        gameplayLabel: '加压',
        gainLabel: '暴击更疼，连发更快',
        costLabel: '清杂会慢一点',
        routeId: 'crit',
        anomalyRole: 'core',
        description: '补一段暴击火力，连着打时更容易压住血线。',
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
      {
        id: 'crit-reroute-window-transform',
        label: '压上暴击',
        gameplayLabel: '换打法',
        gainLabel: '连续暴击会把旁边也一起炸到',
        costLabel: '容错和血量都会掉',
        routeId: 'crit',
        anomalyRole: 'transform',
        description: '直接走高爆发，连着打中时会把附近敌人一起带走。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 4,
              fireRate: 0.1,
              critMultiplier: 0.36,
              critOverdriveDurationBonus: 0.2,
              maxHp: -10,
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
    description: '这一下决定穿透是先稳着打，还是直接穿到后排。',
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
        id: 'pierce-reroute-window-direction',
        routeId: 'pierce',
        label: '先走穿透',
        gameplayLabel: '起手',
        gainLabel: '更容易穿开前排',
        costLabel: '先不换打法',
        anomalyRole: 'direction',
        description: '先把前排穿开，后面更容易一路带到后排。',
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
        id: 'pierce-reroute-window-hold',
        routeId: 'pierce',
        label: '补穿透火力',
        gameplayLabel: '加压',
        gainLabel: '穿前排更稳，后排掉血更快',
        costLabel: '这手不改别的打法',
        anomalyRole: 'core',
        description: '先把穿透火力补上，打散前排会更稳。',
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
      {
        id: 'pierce-reroute-window-breakthrough',
        routeId: 'pierce',
        label: '压上穿透',
        gameplayLabel: '换打法',
        gainLabel: '子弹会直接带到后排',
        costLabel: '站位和血量更吃紧',
        anomalyRole: 'transform',
        description: '直接走穿后排的打法，子弹一串过去会带倒整排。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 4,
              projectileSpeed: 22,
              pierce: 1,
              fireRate: -0.06,
              maxHp: -10,
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
    ],
  },
  {
    id: 'dash-reroute-window',
    name: '穿梭转接窗',
    contentKind: 'anomaly',
    anomalyClass: 'routeWindow',
    description: '穿梭已经跑顺了，可以临时换打法',
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
        gameplayLabel: '起手',
        gainLabel: '先把机动底子垫稳',
        costLabel: '不直接切成别的路线',
        anomalyRole: 'direction',
        description: '不转向，先补移速、恢复和耐久。',
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
  {
    id: 'overload-firecontrol',
    name: '过载火控',
    contentKind: 'anomaly',
    anomalyClass: 'distortion',
    description: '牺牲射速，换取伤害。',
    selection: {
      baseWeight: 0.95,
      minRound: 2,
      phaseBonuses: {
        mid: 1.2,
        late: 0.8,
      },
      noDominantRouteBonus: 1.1,
    },
    options: [
      {
        id: 'overload-firecontrol-accept',
        label: '接受过载',
        description: '射速降低40%，伤害提升80%',
        effects: [
          {
            type: 'stats',
            modifiers: {
              fireRate: -0.4,
              damage: 8,
            },
          },
        ],
      },
      {
        id: 'overload-firecontrol-decline',
        label: '拒绝过载',
        description: '保持配置，少量通用强化',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 2,
              fireRate: 0.08,
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
    description: '牺牲伤害，换取射速。',
    selection: {
      baseWeight: 0.92,
      minRound: 2,
      phaseBonuses: {
        mid: 1.15,
        late: 0.85,
      },
      noDominantRouteBonus: 1.05,
    },
    options: [
      {
        id: 'compressed-cycle-accept',
        label: '接受压缩',
        description: '伤害降低30%，射速提升70%',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: -3,
              fireRate: 0.7,
            },
          },
        ],
      },
      {
        id: 'compressed-cycle-decline',
        label: '拒绝压缩',
        description: '保持配置，少量通用强化',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 2,
              fireRate: 0.08,
            },
          },
        ],
      },
    ],
  },
  {
    id: 'fixed-turret',
    name: '固定炮台',
    contentKind: 'anomaly',
    anomalyClass: 'distortion',
    description: '牺牲机动，换取火力',
    selection: {
      baseWeight: 0.88,
      minRound: 2,
      phaseBonuses: {
        mid: 1.1,
        late: 0.9,
      },
      noDominantRouteBonus: 1.15,
    },
    options: [
      {
        id: 'fixed-turret-accept',
        label: '接受改造',
        description: '移速降低50%，伤害和射速提升',
        effects: [
          {
            type: 'stats',
            modifiers: {
              moveSpeed: -50,
              damage: 4,
              fireRate: 0.3,
            },
          },
        ],
      },
      {
        id: 'fixed-turret-decline',
        label: '拒绝改造',
        description: '保持配置，少量通用强化',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 2,
              moveSpeed: 8,
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
        gainLabel: '射速大幅提高，更容易连续触发效果',
        costLabel: '单发伤害降低',
        description: '开火更密，效果更容易连续触发',
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
        gainLabel: '移速提高，这一套更顺一点',
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
        gainLabel: '弹速和移速提高，这一套更顺一点',
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
    name: '穿梭抉择',
    contentKind: 'anomaly',
    anomalyClass: 'routeWindow',
    routeAffinity: 'dash',
    description: '普通射击会变弱，但贴身闪过后的那一下会更狠。',
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
        label: '钉住穿梭方向',
        gameplayLabel: '起手',
        gainLabel: '穿梭更容易起手',
        costLabel: '基础火力会弱一点',
        routeId: 'dash',
        anomalyRole: 'direction',
        description: '先把穿梭的起手抬起来，后面更容易接反打。',
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
        label: '补进穿梭核心',
        gameplayLabel: '加压',
        gainLabel: '脉冲伤害和无伤窗提高',
        costLabel: '耐久会少一点',
        routeId: 'dash',
        anomalyRole: 'core',
        description: '把穿梭的核心拍补实，擦身会更稳。',
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
      {
        id: 'dash-charge-transform',
        label: '压上换位爆发',
        gameplayLabel: '换打法',
        gainLabel: '换位后爆发更狠',
        costLabel: '容错明显下降',
        routeId: 'dash',
        anomalyRole: 'transform',
        description: '把穿梭从游走，直接改成贴身收人。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 4,
              dashPulseDamage: 10,
              dashInterval: -0.22,
              maxHp: -10,
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
        id: 'dash-charge-finisher',
        label: '接入收割回路',
        gameplayLabel: '补刀',
        gainLabel: '脉冲后更容易补掉残血',
        costLabel: '普通射击更弱',
        routeId: 'dash',
        anomalyRole: 'finisher',
        description: '不是多一层数值，是把收尾节奏拉起来。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              dashPulseDamage: 12,
              dashChargeSpeed: 0.12,
              dashCounterDamageBonus: 0.22,
              dashGrazeRadiusBonus: 8,
              fireRate: -0.08,
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
    ],
  },
  {
    id: 'crit-lock-protocol',
    name: '暴击狠打',
    contentKind: 'anomaly',
    anomalyClass: 'routeWindow',
    routeAffinity: 'crit',
    description: '暴击已经打顺了，这一下决定是继续补伤害，还是直接压上去。',
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
        label: '压上重击',
        gameplayLabel: '换打法',
        gainLabel: '短时间里会打得特别狠',
        costLabel: '容错明显下降',
        routeId: 'crit',
        anomalyRole: 'transform',
        description: '压掉容错，换更狠的爆发窗口。',
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
        label: '接入终结回路',
        gameplayLabel: '补刀',
        gainLabel: '破绽炸开后更容易补掉残血',
        costLabel: '后面能补的会少',
        routeId: 'crit',
        anomalyRole: 'finisher',
        description: '这一手不是补属性，是把收尾拉起来。',
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
