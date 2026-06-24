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
    name: '读数调整',
    description: '继续加深，或换个节奏',
    routeAffinity: 'dominant',
    selection: {
      baseWeight: 2.3,
      minRound: 2,
      maxRound: 4,
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
        label: '顺着这条线再压',
        description: '把这条线继续压下去',
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
        label: '稳一手',
        description: '先把节奏稳住',
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
        label: '稳一手',
        description: '先把机体站稳',
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
    name: '起手校线',
    description: '先把这把的打法定住',
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
        label: '先压火力',
        description: '火力先加一点',
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
        label: '先留余地',
        description: '先把生存稳住',
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
    description: '已经有起色，继续压或留活口',
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
        label: '顺着这条路走',
        description: '当前方向继续加深',
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
        label: '留一点活口',
        description: '恢复和机动一起补',
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
    description: '换成更快的节奏，或者更稳的身板',
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
        label: '切快一点',
        description: '出手更快，弹道更顺',
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
        label: '换稳一点',
        description: '先把耐久拉满',
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
    options: getAnomalyRoutePoolOptions('routeHandoff', ['crit', 'pierce', 'dash']),
  },
  {
    id: 'midline-split',
    name: '中盘岔口',
    contentKind: 'anomaly',
    anomalyClass: 'routeWindow',
    description: '中盘该换法了',
    routeAffinity: 'dominant',
    selection: {
      baseWeight: 1.24,
      minRound: 2,
      maxRound: 3,
      phaseBonuses: {
        mid: 2,
        late: 0.7,
      },
      hintedRouteBonus: 0.6,
      dominantRouteBonus: 2.3,
      committedRouteBonus: 1.35,
      offRouteMultiplier: 0.05,
    },
    options: [
      {
        id: 'midline-split-direction',
        label: '先接顺',
        gameplayLabel: '先接顺',
        gainLabel: '中盘更稳',
        costLabel: '火力会慢一点',
        routeId: 'dominant',
        anomalyRole: 'direction',
        description: '先把这一段接住。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              fireRate: 0.1,
              projectileSpeed: 12,
            },
          },
          {
            type: 'heal',
            amount: 6,
          },
        ],
      },
      {
        id: 'midline-split-transform',
        label: '直接换手',
        gameplayLabel: '直接换手',
        gainLabel: '中盘换成另一种打法',
        costLabel: '容错会少一点',
        routeId: 'dominant',
        anomalyRole: 'transform',
        description: '这一段直接换打法。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 4,
              moveSpeed: 10,
              maxHp: -6,
            },
          },
        ],
      },
    ],
  },
  {
    id: 'crit-reroute-window',
    name: '暴击抉择',
    contentKind: 'anomaly',
    anomalyClass: 'routeWindow',
    description: '暴击这条线要继续压，还是换成更猛的打法。',
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
        label: '先把暴击稳住',
        gameplayLabel: '起手',
        gainLabel: '更容易连着出重击',
        costLabel: '稳一点的东西会少些',
        routeId: 'crit',
        anomalyRole: 'direction',
        description: '先把暴击节奏带起来。',
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
        gameplayLabel: '加力',
        gainLabel: '厚血目标更容易炸开',
        costLabel: '清杂会慢一点',
        routeId: 'crit',
        anomalyRole: 'core',
        description: '先往重击上再加一把。',
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
        label: '强化暴击',
        gameplayLabel: '转强',
        gainLabel: '重击会带到旁边',
        costLabel: '容错会少一点',
        routeId: 'crit',
        anomalyRole: 'transform',
        description: '重击一开，旁边也会跟着掉。',
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
    description: '穿透这条线要往前推。',
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
        label: '先把前排打开',
        gameplayLabel: '起手',
        gainLabel: '前排更容易穿开',
        costLabel: '先少一点稳妥',
        anomalyRole: 'direction',
        description: '先把前排打开。',
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
        gameplayLabel: '加力',
        gainLabel: '前排更容易被打穿',
        costLabel: '本回合专注当前流派',
        anomalyRole: 'core',
        description: '再往前推一把。',
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
        label: '强化穿透',
        gameplayLabel: '转强',
        gainLabel: '找到直线就能带到后面',
        costLabel: '站位会更紧',
        anomalyRole: 'transform',
        description: '直线一成，后面也会跟着掉。',
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
    name: '穿梭转接',
    contentKind: 'anomaly',
    anomalyClass: 'routeWindow',
    description: '穿梭已经成型，接下来往贴身打。',
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
        label: '继续贴身',
        gameplayLabel: '起手',
        gainLabel: '机动基础更稳',
        costLabel: '不会直接换路',
        anomalyRole: 'direction',
        description: '先把身位站稳。',
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
    id: 'closeout-echo',
    name: '尾段回响',
    contentKind: 'anomaly',
    anomalyClass: 'bossEcho',
    contentTier: 'rare',
    description: '尾段把前面的积累再强化一轮。',
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
        label: '压到最后',
        gameplayLabel: '压到最后',
        gainLabel: '最终输出伤害提升',
        costLabel: '容错会少一点',
        routeId: 'dominant',
        anomalyRole: 'core',
        description: '最后一段继续压。',
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
        label: '留一层',
        gameplayLabel: '留一层',
        gainLabel: '最终输出更加稳定',
        costLabel: '爆发会慢一点',
        description: '多留一点余地，最后一段不容易断。',
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
    description: '一次性资源，转火力或防护',
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
    id: 'boss-sightline',
    name: '首领准备',
    contentKind: 'anomaly',
    anomalyClass: 'bossEcho',
    contentTier: 'rare',
    description: '进 Boss 前，先把血量和火力摆好。',
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
        label: '先把火力压满',
        gameplayLabel: '加力',
        gainLabel: '进 Boss 前把伤害再提一把',
        costLabel: '容错会少一点',
        routeId: 'dominant',
        anomalyRole: 'core',
        description: '先把火力提上去。',
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
        label: '先留一层余地',
        gameplayLabel: '收尾',
        gainLabel: '进 Boss 前先把血量和恢复补住',
        costLabel: '爆发会慢一点',
        routeId: 'dominant',
        anomalyRole: 'finisher',
        description: '先把机体站稳。',
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
    description: '牺牲射速，换取伤害。',
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
      maxRound: 3,
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
      maxRound: 3,
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
      maxRound: 3,
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
        description: '攻击速度和伤害提升，但生命值降低',
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
      maxRound: 3,
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
        gameplayLabel: '承受压力',
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
        description: '攻击速度降低，但生存能力增强',
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
      maxRound: 3,
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
    description: '火力弱一点，但成长更快',
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
        gainLabel: '移速提高，战斗更顺',
        costLabel: '基础伤害降低',
        routeId: 'dominant',
        description: '伤害低一点，追击会更顺。',
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
        gainLabel: '弹速和移速提高，战斗更顺',
        costLabel: '射速降低',
        routeId: 'dominant',
        description: '输出低一点，回收和走位更顺。',
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
        label: '先贴近',
        gameplayLabel: '先贴近',
        gainLabel: '更容易先贴住',
        costLabel: '基础火力会弱一点',
        routeId: 'dash',
        anomalyRole: 'direction',
        description: '强化接近敌人后的反击能力。',
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
        label: '补进火力',
        gameplayLabel: '反击增强',
        gainLabel: '接近敌人后更容易反击',
        costLabel: '耐久会少一点',
        routeId: 'dash',
        anomalyRole: 'core',
        description: '强化接近敌人后的反击效果。',
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
        label: '全面接近',
        gameplayLabel: '全面强化',
        gainLabel: '接近敌人后爆发更强',
        costLabel: '容错明显下降',
        routeId: 'dash',
        anomalyRole: 'transform',
        description: '将战斗推向全面近战输出。',
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
        label: '最终补强',
        gameplayLabel: '最终补强',
        gainLabel: '接近敌人后更容易消灭残血',
        costLabel: '普通射击更弱',
        routeId: 'dash',
        anomalyRole: 'finisher',
        description: '把最后一下补顺。',
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
    description: '暴击已成型，本回合决定继续强化伤害或全面进攻。',
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
        label: '强化重击',
        gameplayLabel: '全面强化',
        gainLabel: '短时间里会打得特别狠',
        costLabel: '容错明显下降',
        routeId: 'crit',
        anomalyRole: 'transform',
        description: '降低容错率，换取更高的爆发伤害。',
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
        gameplayLabel: '最终补强',
        gainLabel: '破绽炸开后更容易补掉残血',
        costLabel: '后面能补的会少',
        routeId: 'crit',
        anomalyRole: 'finisher',
        description: '本回合不补充属性，直接强化最终输出能力。',
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
