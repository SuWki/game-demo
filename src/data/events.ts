import { getAnomalyRoutePoolOptions } from './anomalyRoutePools';
import { normalizeEffectsToSingleStat } from './upgrades';
import type { ContentEffect, EventContentKind, EventDefinition, RouteReference } from '../game/types';

const RAW_EVENT_CATALOG: EventDefinition[] = [
  {
    id: 'field-maintenance',
    name: '临时整备',
    description: '短暂停机维护。你要更稳的续航，还是更敢压进下一段？',
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
        description: '恢复 22 点耐久，并提高 8 点上限。',
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
        description: '伤害与射速小幅抬升。',
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
    description: '把机体压进一段红线试飞，用立即承压换一次主动偏航的资格。',
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
    description: '系统还没完全热起来，就先漏出了一拍失真。它给得不稳，但会直接改变这一局前段的手感。',
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
        description: '立刻换一段更猛的火力，但会先吃下一次冷启动回震。',
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
        description: '把失真压成更厚的前段容错，但弹道会短暂变钝。',
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
    description: '系统建议你顺着已有倾向继续深入，或者先补一个保底。',
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
        description: '强化已有路线的关键手感。',
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
        description: '恢复 12 点耐久，并提高射速。',
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
    description: '系统抓到一段更贴近当前路线的战斗遥测。要顺势压深，还是先换成更稳的整理？',
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
        description: '把当前路线继续往前压一小步，并补一点基础火力。',
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
        description: '恢复 14 点耐久，并提高 6 点上限。',
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
    description: '你截获了一段残留补给。现在拆成火力读数，还是拆成更稳的机体冗余？',
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
        description: '基础伤害上升，并补一点射速。',
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
        description: '恢复 16 点耐久，并提高一点再生。',
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
    description: '读数已经开始偏向一条路了，但系统提醒你先把坡度铺平也许更稳。',
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
        description: '沿当前方向补一段手感，但先不急着把承诺压死。',
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
        description: '补一段续航和机动，把后面的分支留宽一点。',
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
    description: '机体需要一小段缓冲。你可以把它换成节奏空间，也可以换成更稳的容错。',
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
        description: '射速和弹速上升，帮助把中段衔接得更顺。',
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
        description: '恢复 12 点耐久，并补一点上限和再生。',
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
    id: 'relay-splice',
    name: '并线改道',
    contentKind: 'anomaly',
    anomalyClass: 'routeWindow',
    description: '侧频总线短暂并轨。你可以借这次裂口强行改道，但这更像异常侧切，而不是普通补给。',
    routeAffinity: 'dominant',
    selection: {
      baseWeight: 0.32,
      minRound: 2,
      phaseBonuses: {
        mid: 0.42,
        late: 0.14,
      },
      hintedRouteBonus: 0.3,
      dominantRouteBonus: 0.72,
      committedRouteBonus: 0.18,
      maturedRouteBonus: 0.05,
    },
    options: getAnomalyRoutePoolOptions('relaySplice', ['crit', 'pierce', 'dash']),
  },
  {
    id: 'route-handoff',
    name: '侧频接驳',
    contentKind: 'anomaly',
    anomalyClass: 'routeWindow',
    description: '侧频接口短暂打开。它允许你顺着当前读法微调，也允许你借一拍异常把整条线掰向别处。',
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
    description: '当前暴击读法已经起势。你可以趁接口还没关死，把这条线切向别的收束。',
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
        label: '先稳当前火力',
        description: '不急着转向，先补一段基础火力和耐久，留着后面再判断。',
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
    description: '当前穿透读法已经拉出清线节奏。你可以借这次窗口切向另一条收束方式。',
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
        description: '不急着转向，先补一段稳定火力和耐久，把窗口留到后面。',
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
    description: '当前穿梭节奏已经成形。你可以借这次窗口把反打节奏切向别的收束方式。',
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
        description: '不急着转向，先补一段移速、再生和耐久，让后续窗口更宽。',
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
    id: 'cross-branch-signal',
    name: '岔路讯号',
    contentKind: 'anomaly',
    anomalyClass: 'routeWindow',
    contentTier: 'rare',
    description: '一段侧频样本插了进来。它不一定比当前方向更强，但足够让这局出现一次真正的转向诱惑。',
    routeAffinity: 'dominant',
    selection: {
      baseWeight: 0.74,
      minRound: 2,
      phaseBonuses: {
        mid: 1.35,
        late: 1.55,
        finalPrep: 0.6,
      },
      hintedRouteBonus: 1.1,
      dominantRouteBonus: 2.2,
      committedRouteBonus: 1.5,
      maturedRouteBonus: 0.4,
    },
    options: getAnomalyRoutePoolOptions('crossBranchSignal', ['crit', 'pierce', 'dash']),
  },
  {
    id: 'blackbox-bargain',
    name: '黑匣押注',
    contentKind: 'anomaly',
    anomalyClass: 'distortion',
    contentTier: 'rare',
    description: '封存记录只够开一次。你可以把它压成高风险兑现，也可以拆成这局独有的一段缓冲余地。',
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
        label: '压成红线输出',
        description: '伤害与射速大幅抬升，但机体会立刻承压。',
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
        description: '换一段续航、机动和弹道缓冲，把尾段窗口留宽一点。',
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
    id: 'frayed-accord',
    name: '裂谱合拍',
    contentKind: 'anomaly',
    anomalyClass: 'hybrid',
    description: '几段互不兼容的样本在同一拍里强行合拍。它不稳定，但会把这一局的中后段手感撬向另一种层次。',
    selection: {
      baseWeight: 1.62,
      minRound: 2,
      phaseBonuses: {
        mid: 1.55,
        late: 1.15,
      },
      noDominantRouteBonus: 0.3,
    },
    options: [
      {
        id: 'frayed-accord-heat-cut',
        label: '借热切层',
        description: '把升温与切层样本压在一起，换更主动的清线爆点。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 2,
              critChance: 0.02,
              pierce: 1,
            },
          },
        ],
      },
      {
        id: 'frayed-accord-slide',
        label: '借滑切并轨',
        description: '把裂轨和位移短接，换更顺的换边、补线和脱离窗口。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              projectileSpeed: 18,
              moveSpeed: 12,
              dashInterval: -0.18,
            },
          },
        ],
      },
      {
        id: 'frayed-accord-counter',
        label: '借反打升温',
        description: '把反打和升温揉成一拍，让中后段更容易抢回主动权。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              fireRate: 0.12,
              dashInvulnerability: 0.06,
              critChance: 0.02,
            },
          },
        ],
      },
    ],
  },
  {
    id: 'mirror-cache',
    name: '镜像缓存',
    contentKind: 'anomaly',
    anomalyClass: 'hybrid',
    contentTier: 'rare',
    description: '尾段里突然拉出一段镜像样本。你可以把它压成当前路线的收尾，也可以拆成这局独有的一段混搭余量。',
    routeAffinity: 'dominant',
    selection: {
      baseWeight: 1.12,
      minRound: 3,
      phaseBonuses: {
        late: 2,
        finalPrep: 0.7,
      },
      hintedRouteBonus: 0.2,
      dominantRouteBonus: 1.9,
      committedRouteBonus: 1.2,
      maturedRouteBonus: 0.6,
    },
    options: [
      {
        id: 'mirror-cache-press',
        label: '压成当前收尾',
        description: '补一段尾段火力，并沿当前方向再压一步。',
        routeId: 'dominant',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 6,
              fireRate: 0.18,
            },
          },
          {
            type: 'route',
            routeId: 'dominant',
          },
        ],
      },
      {
        id: 'mirror-cache-open',
        label: '拆成并轨余量',
        description: '补一段机动、弹速和再生，把尾段混搭窗口留宽一点。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              projectileSpeed: 24,
              moveSpeed: 16,
              regeneration: 0.12,
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
    id: 'junction-overdrive',
    name: '并轨超调',
    contentKind: 'anomaly',
    anomalyClass: 'hybrid',
    contentTier: 'rare',
    description: '两种本不该同拍的收束读法被硬拧到了一起。这一拍不是普通补给，而是在决定这局尾段更像混搭还是单路暴冲。',
    routeAffinity: 'dominant',
    selection: {
      baseWeight: 1.04,
      minRound: 3,
      phaseBonuses: {
        late: 2.05,
        finalPrep: 0.82,
      },
      hintedRouteBonus: 0.16,
      dominantRouteBonus: 1.55,
      committedRouteBonus: 1.05,
      maturedRouteBonus: 0.55,
      noDominantRouteBonus: 0.08,
    },
    options: [
      {
        id: 'junction-overdrive-splice',
        label: '压成双向尾段',
        description: '把两段不兼容的尾劲硬接到一起，换一口更宽的混搭收束。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 4,
              multishot: 1,
              projectileSpeed: 18,
              moveSpeed: 10,
            },
          },
        ],
      },
      {
        id: 'junction-overdrive-focus',
        label: '压成当前爆点',
        description: '放弃混搭，把这一拍全压进当前路线的尾段爆点。',
        routeId: 'dominant',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 3,
              fireRate: 0.14,
              critMultiplier: 0.24,
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
    id: 'crossfade-ledger',
    name: '错拍并账',
    contentKind: 'anomaly',
    anomalyClass: 'hybrid',
    description: '一条旁路收益提前撞进当前节奏。这不是普通补值，而是在决定这局尾段要不要带着另一种打法收回去。',
    routeAffinity: 'dominant',
    selection: {
      baseWeight: 1.12,
      minRound: 2,
      phaseBonuses: {
        mid: 1.62,
        late: 1.76,
        finalPrep: 0.72,
      },
      hintedRouteBonus: 0.15,
      dominantRouteBonus: 1.4,
      committedRouteBonus: 1.08,
      maturedRouteBonus: 0.56,
      noDominantRouteBonus: 0.1,
    },
    options: [
      {
        id: 'crossfade-ledger-focus',
        label: '压回当前主线',
        description: '把旁路火力折回当前路线，让尾段更像一次干净定稿。',
        routeId: 'dominant',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 3,
              fireRate: 0.1,
              projectileSpeed: 18,
            },
          },
          {
            type: 'route',
            routeId: 'dominant',
          },
        ],
      },
      {
        id: 'crossfade-ledger-keep',
        label: '保留旁路余拍',
        description: '不把旁路全裁掉，让这局尾段继续带着一点混搭余味。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              multishot: 1,
              moveSpeed: 12,
              regeneration: 0.1,
            },
          },
          {
            type: 'heal',
            amount: 6,
          },
        ],
      },
    ],
  },
  {
    id: 'crit-heat-bank',
    name: '热区记录',
    contentKind: 'anomaly',
    anomalyClass: 'distortion',
    contentTier: 'rare',
    description: '一段暴击热区记录被锁定。你要把连发窗口继续拉长，还是把单次爆点压得更狠？',
    routeAffinity: 'crit',
    selection: {
      baseWeight: 0.9,
      minRound: 3,
      phaseBonuses: {
        late: 1.8,
        finalPrep: 0.8,
      },
      hintedRouteBonus: 0.3,
      dominantRouteBonus: 3.8,
      committedRouteBonus: 2.8,
      maturedRouteBonus: 1.4,
      offRouteMultiplier: 0.05,
    },
    options: [
      {
        id: 'crit-heat-bank-feed',
        label: '续热供压',
        description: '把暴击触发接成更长的升温链。',
        routeId: 'crit',
        effects: [
          {
            type: 'stats',
            modifiers: {
              fireRate: 0.24,
              critChance: 0.05,
              projectileSpeed: 14,
            },
          },
          {
            type: 'route',
            routeId: 'crit',
          },
        ],
      },
      {
        id: 'crit-heat-bank-burst',
        label: '压成爆点',
        description: '把暴击伤害和爆发读数往收尾方向再推一截。',
        routeId: 'crit',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 4,
              critChance: 0.03,
              critMultiplier: 0.32,
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
    id: 'pierce-routing-map',
    name: '裂轨图谱',
    contentKind: 'anomaly',
    anomalyClass: 'hybrid',
    contentTier: 'rare',
    description: '你截获了一张贯穿波形图。要继续拉长链条，还是把清线扇面直接铺开？',
    routeAffinity: 'pierce',
    selection: {
      baseWeight: 0.9,
      minRound: 3,
      phaseBonuses: {
        late: 1.8,
        finalPrep: 0.8,
      },
      hintedRouteBonus: 0.3,
      dominantRouteBonus: 3.8,
      committedRouteBonus: 2.8,
      maturedRouteBonus: 1.4,
      offRouteMultiplier: 0.05,
    },
    options: [
      {
        id: 'pierce-routing-map-chain',
        label: '续链校正',
        description: '让贯穿链条更长、更稳，更适合一路打穿。',
        routeId: 'pierce',
        effects: [
          {
            type: 'stats',
            modifiers: {
              pierce: 1,
              fireRate: 0.1,
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
        id: 'pierce-routing-map-bloom',
        label: '扇裂展开',
        description: '把裂轨扇面和面压收益提前拉出来。',
        routeId: 'pierce',
        effects: [
          {
            type: 'stats',
            modifiers: {
              multishot: 1,
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
    ],
  },
  {
    id: 'dash-weave-memory',
    name: '穿梭记忆',
    contentKind: 'anomaly',
    anomalyClass: 'distortion',
    contentTier: 'rare',
    description: '机体留下了一段高压换位回放。要把擦身蓄能做厚，还是把反打窗口拉长？',
    routeAffinity: 'dash',
    selection: {
      baseWeight: 0.9,
      minRound: 3,
      phaseBonuses: {
        late: 1.8,
        finalPrep: 0.8,
      },
      hintedRouteBonus: 0.3,
      dominantRouteBonus: 3.8,
      committedRouteBonus: 2.8,
      maturedRouteBonus: 1.4,
      offRouteMultiplier: 0.05,
    },
    options: [
      {
        id: 'dash-weave-memory-graze',
        label: '贴身取样',
        description: '把擦身收益和换位速度继续做厚，逼出更主动的走位节奏。',
        routeId: 'dash',
        effects: [
          {
            type: 'stats',
            modifiers: {
              moveSpeed: 14,
              dashInterval: -0.42,
              dashInvulnerability: 0.04,
              dashPulseDamage: 6,
            },
          },
          {
            type: 'route',
            routeId: 'dash',
          },
        ],
      },
      {
        id: 'dash-weave-memory-stabilize',
        label: '稳住净帧',
        description: '把无伤窗口和回线稳态拉长，换更可靠的反打空档。',
        routeId: 'dash',
        effects: [
          {
            type: 'stats',
            modifiers: {
              fireRate: 0.12,
              dashInvulnerability: 0.1,
              regeneration: 0.12,
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
    id: 'phase-debt',
    name: '相位欠账',
    contentKind: 'anomaly',
    anomalyClass: 'distortion',
    description: '异常账层把后半段压力提前透支到了现在。你可以立刻套现一段爆发，也可以把这次回震压成更厚的容错。',
    selection: {
      baseWeight: 1.55,
      minRound: 2,
      phaseBonuses: {
        mid: 1.25,
        late: 0.85,
      },
      noDominantRouteBonus: 0.3,
    },
    options: [
      {
        id: 'phase-debt-overclock',
        label: '先透支火线',
        description: '立刻换来一段更凶的火力，但机体会先吃下一次提前回震。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 5,
              fireRate: 0.18,
            },
          },
          {
            type: 'heal',
            amount: -12,
          },
        ],
      },
      {
        id: 'phase-debt-buffer',
        label: '先吞下回震',
        description: '把这次失真压成更厚的耐久和再生，代价是弹道会短暂变钝。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              maxHp: 8,
              regeneration: 0.14,
              projectileSpeed: -18,
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
    id: 'phase-splitter',
    name: '相位裂缝',
    contentKind: 'anomaly',
    anomalyClass: 'hybrid',
    description: '异常裂缝把互不兼容的读法短暂并排拉到面前。这不是普通补给，而是一拍真正的并轨试错。',
    selection: {
      baseWeight: 2.15,
      minRound: 2,
      phaseBonuses: {
        mid: 1.7,
        late: 0.95,
      },
      noDominantRouteBonus: 0.4,
    },
    options: [
      {
        id: 'phase-splitter-crit-pierce',
        label: '接入灼线样本',
        description: '补一段暴击升温和穿透清线的混搭样本，先拿到手感，再决定后续要不要顺着走。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 2,
              critChance: 0.03,
              projectileSpeed: 18,
            },
          },
        ],
      },
      {
        id: 'phase-splitter-pierce-dash',
        label: '接入扇面位移',
        description: '把穿透扇面和位移窗口短接在一起，换更顺的中段走位。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              pierce: 1,
              moveSpeed: 12,
              dashInterval: -0.18,
            },
          },
        ],
      },
      {
        id: 'phase-splitter-dash-crit',
        label: '接入反打热区',
        description: '用换位反打去接一段暴击升温，把主动出手的窗口撑开。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              moveSpeed: 10,
              fireRate: 0.12,
              critChance: 0.02,
            },
          },
        ],
      },
    ],
  },
  {
    id: 'faultline-auction',
    name: '断层竞价',
    contentKind: 'anomaly',
    anomalyClass: 'distortion',
    description: '裂口只开一拍。你可以把它压成一次过热冲刺，也可以拆成更厚的回稳缓冲。',
    selection: {
      baseWeight: 1.65,
      minRound: 2,
      phaseBonuses: {
        mid: 1.45,
        late: 1.1,
      },
      noDominantRouteBonus: 0.35,
    },
    options: [
      {
        id: 'faultline-auction-redline',
        label: '压成过热冲刺',
        description: '伤害、射速和暴击抬升，但立刻吃下 12 点回震。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 5,
              fireRate: 0.16,
              critChance: 0.03,
            },
          },
          {
            type: 'heal',
            amount: -12,
          },
        ],
      },
      {
        id: 'faultline-auction-brace',
        label: '拆成回稳缓冲',
        description: '上限、再生和移速提高，但弹道会更钝。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              maxHp: 8,
              regeneration: 0.16,
              moveSpeed: 12,
              projectileSpeed: -20,
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
    id: 'ghost-mesh',
    name: '幽栅并轨',
    contentKind: 'anomaly',
    anomalyClass: 'hybrid',
    description: '几段互不兼容的样本同时挂在视野边缘。它们更像一次并轨试错，而不是正常补给。',
    selection: {
      baseWeight: 1.7,
      minRound: 2,
      phaseBonuses: {
        mid: 1.5,
        late: 1.05,
      },
      noDominantRouteBonus: 0.45,
    },
    options: [
      {
        id: 'ghost-mesh-heat-step',
        label: '借热区穿身',
        description: '把升温火线和穿身窗口短接在一起，换更主动的贴身节奏。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              fireRate: 0.12,
              critChance: 0.03,
              moveSpeed: 12,
              dashInterval: -0.18,
            },
          },
        ],
      },
      {
        id: 'ghost-mesh-rift-slide',
        label: '借裂轨滑切',
        description: '把裂轨和位移手感揉成一拍，换更顺的中段换边与清线。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              pierce: 1,
              projectileSpeed: 18,
              moveSpeed: 10,
              dashInterval: -0.16,
            },
          },
        ],
      },
      {
        id: 'ghost-mesh-fan-heat',
        label: '借扇裂升温',
        description: '把扇裂和升温压进同一拍，换更激进的中段扫场手感。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 3,
              critChance: 0.02,
              pierce: 1,
              projectileSpeed: 14,
            },
          },
        ],
      },
    ],
  },
  {
    id: 'shadow-merge',
    name: '影缝并联',
    contentKind: 'anomaly',
    anomalyClass: 'hybrid',
    description: '两段偏航样本被缝在了一起。你可以让这局继续稳走当前路线，也可以让尾段开始带上一点旁路味道。',
    routeAffinity: 'dominant',
    selection: {
      baseWeight: 1.42,
      minRound: 2,
      phaseBonuses: {
        mid: 1.35,
        late: 1.1,
      },
      hintedRouteBonus: 0.3,
      dominantRouteBonus: 1.1,
      committedRouteBonus: 0.7,
      noDominantRouteBonus: 0.4,
    },
    options: [
      {
        id: 'shadow-merge-press',
        label: '顺着当前线压深',
        description: '沿当前路线再往前压一拍，但把站位余量一起垫上。',
        routeId: 'dominant',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 3,
              fireRate: 0.12,
              moveSpeed: 8,
            },
          },
          {
            type: 'route',
            routeId: 'dominant',
          },
        ],
      },
      {
        id: 'shadow-merge-buffer',
        label: '留一段旁路余量',
        description: '不急着压死方向，先把混搭和转场空间一起留出来。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              projectileSpeed: 20,
              critChance: 0.05,
              regeneration: 0.1,
            },
          },
        ],
      },
    ],
  },
  {
    id: 'sideband-overlap',
    name: '侧频并轨',
    contentKind: 'anomaly',
    anomalyClass: 'hybrid',
    contentTier: 'rare',
    description: '尾段侧频没有消失，反而和当前 build 叠在了一起。这一拍会决定你是纯走既有爆点，还是把旁路也带到结尾。',
    routeAffinity: 'dominant',
    selection: {
      baseWeight: 1.01,
      minRound: 3,
      phaseBonuses: {
        late: 1.96,
        finalPrep: 0.82,
      },
      hintedRouteBonus: 0.12,
      dominantRouteBonus: 1.5,
      committedRouteBonus: 1.04,
      maturedRouteBonus: 0.5,
      noDominantRouteBonus: 0.08,
    },
    options: [
      {
        id: 'sideband-overlap-focus',
        label: '压成当前定稿',
        description: '把旁路收益收回当前路线，准备把最后一段收得更尖。',
        routeId: 'dominant',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 3,
              fireRate: 0.12,
              moveSpeed: 8,
            },
          },
          {
            type: 'route',
            routeId: 'dominant',
          },
        ],
      },
      {
        id: 'sideband-overlap-carry',
        label: '带着旁路收尾',
        description: '不把侧频剪掉，保留一口混搭火力和更宽的回旋空间。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 4,
              multishot: 1,
              projectileSpeed: 16,
              moveSpeed: 10,
            },
          },
        ],
      },
    ],
  },
  {
    id: 'null-lens',
    name: '空镜偏折',
    contentKind: 'anomaly',
    anomalyClass: 'distortion',
    contentTier: 'rare',
    description: '一段不属于当前局面的偏折样本被照了出来。你可以把它折成一次危险混搭，也可以把它压成更稳的尾段余量。',
    selection: {
      baseWeight: 1.08,
      minRound: 3,
      phaseBonuses: {
        late: 1.7,
        finalPrep: 0.75,
      },
      noDominantRouteBonus: 0.2,
    },
    options: [
      {
        id: 'null-lens-weave',
        label: '折成危险混搭',
        description: '立刻接上两种不安分的读法，收益更高，也要先吞一次波形回震。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              critChance: 0.02,
              pierce: 1,
              moveSpeed: 12,
            },
          },
          {
            type: 'heal',
            amount: -8,
          },
        ],
      },
      {
        id: 'null-lens-brace',
        label: '压成稳态余量',
        description: '不抢当下爆发，改拿更厚的耐久、回收和弹道余量，给尾段留出读数。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              maxHp: 10,
              regeneration: 0.14,
              projectileSpeed: 18,
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
    id: 'carrier-breach',
    name: '载体失真',
    contentKind: 'anomaly',
    anomalyClass: 'distortion',
    contentTier: 'rare',
    description: '异常载体开始失真。你可以把这段波形压成一次高收益冲刺，也可以拆成一段更宽的并轨余量。',
    selection: {
      baseWeight: 1.24,
      minRound: 2,
      phaseBonuses: {
        mid: 1,
        late: 1.8,
        finalPrep: 0.75,
      },
      hintedRouteBonus: 0.4,
      dominantRouteBonus: 1.2,
      committedRouteBonus: 0.7,
    },
    options: [
      {
        id: 'carrier-breach-redline',
        label: '压成红线冲刺',
        description: '立刻换来一段更凶的输出，但机体会先吃下一次失真回震。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 7,
              fireRate: 0.18,
              critChance: 0.03,
            },
          },
          {
            type: 'heal',
            amount: -10,
          },
        ],
      },
      {
        id: 'carrier-breach-open',
        label: '拆成并轨余量',
        description: '不赌当下爆发，改拿更宽的移动、弹道和恢复余量，把后续异常窗口留活。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              moveSpeed: 16,
              projectileSpeed: 20,
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
    id: 'crit-afterburn-trace',
    name: '热区余拍',
    contentKind: 'anomaly',
    anomalyClass: 'hybrid',
    description: '热区已经站住，但尾段还没决定是继续把热度续满，还是带着旁路味道一起撞进爆点。',
    routeAffinity: 'crit',
    selection: {
      baseWeight: 1.06,
      minRound: 2,
      phaseBonuses: {
        mid: 1.28,
        late: 1.52,
        finalPrep: 0.64,
      },
      hintedRouteBonus: 0.26,
      dominantRouteBonus: 1.26,
      committedRouteBonus: 1,
      maturedRouteBonus: 0.5,
      offRouteMultiplier: 0.08,
    },
    options: [
      {
        id: 'crit-afterburn-trace-keep',
        label: '先把热度续满',
        description: '补一段续热火力，让爆点不是只靠最后一下运气。',
        routeId: 'crit',
        effects: [
          {
            type: 'stats',
            modifiers: {
              fireRate: 0.14,
              critChance: 0.04,
              projectileSpeed: 16,
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
        id: 'crit-afterburn-trace-carry',
        label: '带着旁路冲刺',
        description: '不把旁路剪掉，换一段更宽的压线与补刀余量。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 2,
              critMultiplier: 0.2,
              multishot: 1,
              moveSpeed: 8,
            },
          },
        ],
      },
    ],
  },
  {
    id: 'crit-ember-hold',
    name: '压线余焰',
    contentKind: 'anomaly',
    anomalyClass: 'hybrid',
    description: '热区已经立住，但尾段还差一拍稳定承接。你可以先把压线站稳，也可以先把爆点留到更后面。',
    routeAffinity: 'crit',
    selection: {
      baseWeight: 1.02,
      minRound: 2,
      phaseBonuses: {
        mid: 1.56,
        late: 1.18,
        finalPrep: 0.42,
      },
      hintedRouteBonus: 0.54,
      dominantRouteBonus: 1.58,
      committedRouteBonus: 1.18,
      maturedRouteBonus: 0.58,
      offRouteMultiplier: 0.08,
    },
    options: [
      {
        id: 'crit-ember-hold-press',
        label: '先把压线站稳',
        description: '补一段续热与续航，让后面的爆点不是硬赌。',
        routeId: 'crit',
        effects: [
          {
            type: 'stats',
            modifiers: {
              fireRate: 0.12,
              critChance: 0.03,
              regeneration: 0.08,
              moveSpeed: 8,
            },
          },
          {
            type: 'route',
            routeId: 'crit',
          },
        ],
      },
      {
        id: 'crit-ember-hold-save',
        label: '先把爆点留后',
        description: '先把节奏留宽一点，把那一下更稳地放到后段。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              maxHp: 6,
              projectileSpeed: 14,
              moveSpeed: 8,
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
    id: 'pierce-ledger-trace',
    name: '拆线余账',
    contentKind: 'anomaly',
    anomalyClass: 'hybrid',
    description: '拆线节奏已经立住，但尾段还没决定是继续清账，还是把铺开的扇面一路带到结尾。',
    routeAffinity: 'pierce',
    selection: {
      baseWeight: 1.06,
      minRound: 2,
      phaseBonuses: {
        mid: 1.28,
        late: 1.52,
        finalPrep: 0.64,
      },
      hintedRouteBonus: 0.26,
      dominantRouteBonus: 1.26,
      committedRouteBonus: 1,
      maturedRouteBonus: 0.5,
      offRouteMultiplier: 0.08,
    },
    options: [
      {
        id: 'pierce-ledger-trace-break',
        label: '先把拆线压稳',
        description: '补一段拆屏与穿线余量，让后段先把账拆干净。',
        routeId: 'pierce',
        effects: [
          {
            type: 'stats',
            modifiers: {
              pierce: 1,
              projectileSpeed: 22,
              fireRate: 0.08,
              moveSpeed: 8,
            },
          },
          {
            type: 'route',
            routeId: 'pierce',
          },
        ],
      },
      {
        id: 'pierce-ledger-trace-fan',
        label: '把扇面一并带走',
        description: '不只拆一条缝，顺手把清线和补面也铺开。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 2,
              multishot: 1,
              projectileSpeed: 16,
              moveSpeed: 8,
            },
          },
        ],
      },
    ],
  },
  {
    id: 'pierce-ledger-hold',
    name: '拆账余缝',
    contentKind: 'anomaly',
    anomalyClass: 'hybrid',
    description: '拆线方向已经定住，但尾段还差一拍把缝口撑开。你可以先把缝口压稳，也可以先把回收余量留满。',
    routeAffinity: 'pierce',
    selection: {
      baseWeight: 1.06,
      minRound: 2,
      phaseBonuses: {
        mid: 1.62,
        late: 1.18,
        finalPrep: 0.42,
      },
      hintedRouteBonus: 0.66,
      dominantRouteBonus: 1.84,
      committedRouteBonus: 1.18,
      maturedRouteBonus: 0.58,
      offRouteMultiplier: 0.08,
    },
    options: [
      {
        id: 'pierce-ledger-hold-seam',
        label: '先把缝口压稳',
        description: '补一段拆线与推进余量，先把后段的缝口撑住。',
        routeId: 'pierce',
        effects: [
          {
            type: 'stats',
            modifiers: {
              pierce: 1,
              projectileSpeed: 16,
              fireRate: 0.06,
              moveSpeed: 8,
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
        id: 'pierce-ledger-hold-bank',
        label: '先把回收留满',
        description: '不急着只冲一条缝，先把补刀和回收余量留得更宽。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              multishot: 1,
              regeneration: 0.08,
              moveSpeed: 8,
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
    id: 'pierce-seam-anchor',
    name: '拆线定幅',
    contentKind: 'anomaly',
    anomalyClass: 'hybrid',
    description: '清线方向已经露出一拍，但还差一次把缝口稳住的承接。你可以先把拆线站住，也可以先把铺面留宽。',
    routeAffinity: 'pierce',
    selection: {
      baseWeight: 1.02,
      minRound: 2,
      maxRound: 3,
      phaseBonuses: {
        mid: 1.64,
        late: 0.44,
      },
      hintedRouteBonus: 0.74,
      dominantRouteBonus: 1.94,
      committedRouteBonus: 1.04,
      maturedRouteBonus: 0.24,
      offRouteMultiplier: 0.08,
    },
    options: [
      {
        id: 'pierce-seam-anchor-seam',
        label: '先把拆线站住',
        description: '补一段拆线与推进余量，让中段先有一条清楚的缝口。',
        routeId: 'pierce',
        effects: [
          {
            type: 'stats',
            modifiers: {
              pierce: 1,
              projectileSpeed: 18,
              fireRate: 0.06,
              moveSpeed: 8,
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
        id: 'pierce-seam-anchor-fan',
        label: '先把铺面留宽',
        description: '不急着只冲一条缝，先把回收和补刀余量留得更宽。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              multishot: 1,
              regeneration: 0.08,
              moveSpeed: 8,
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
    id: 'dash-return-trace',
    name: '回线余拍',
    contentKind: 'anomaly',
    anomalyClass: 'hybrid',
    description: '回线已经开始成形，但尾段还没决定是继续把反打压紧，还是把换边与喘息窗口一并留宽。',
    routeAffinity: 'dash',
    selection: {
      baseWeight: 1.06,
      minRound: 2,
      phaseBonuses: {
        mid: 1.28,
        late: 1.52,
        finalPrep: 0.64,
      },
      hintedRouteBonus: 0.26,
      dominantRouteBonus: 1.26,
      committedRouteBonus: 1,
      maturedRouteBonus: 0.5,
      offRouteMultiplier: 0.08,
    },
    options: [
      {
        id: 'dash-return-trace-counter',
        label: '先把反打压紧',
        description: '补一段回摆与擦身火力，让后段更敢抢回主动权。',
        routeId: 'dash',
        effects: [
          {
            type: 'stats',
            modifiers: {
              dashInterval: -0.2,
              dashPulseDamage: 6,
              fireRate: 0.08,
              moveSpeed: 10,
            },
          },
          {
            type: 'route',
            routeId: 'dash',
          },
        ],
      },
      {
        id: 'dash-return-trace-breath',
        label: '先把喘息留宽',
        description: '不急着把每次换位都压成反打，先把回摆后的空档留大一点。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              dashInvulnerability: 0.08,
              regeneration: 0.12,
              moveSpeed: 14,
              projectileSpeed: 16,
            },
          },
        ],
      },
    ],
  },
  {
    id: 'dash-sidewake-memory',
    name: '回切借窗',
    contentKind: 'anomaly',
    anomalyClass: 'hybrid',
    description: '换边节奏已经成形，但后段还没决定是继续把反打压紧，还是把借窗与喘息空间再留宽半拍。',
    routeAffinity: 'dash',
    selection: {
      baseWeight: 1.04,
      minRound: 2,
      maxRound: 4,
      phaseBonuses: {
        mid: 1.54,
        late: 1.24,
        finalPrep: 0.36,
      },
      hintedRouteBonus: 0.58,
      dominantRouteBonus: 1.86,
      committedRouteBonus: 1.16,
      maturedRouteBonus: 0.52,
      offRouteMultiplier: 0.08,
    },
    options: [
      {
        id: 'dash-sidewake-memory-push',
        label: '把回切窗口压实',
        description: '补一拍换边后的反打强度，让中后段更敢靠借窗夺回主动。',
        routeId: 'dash',
        effects: [
          {
            type: 'stats',
            modifiers: {
              dashInterval: -0.16,
              dashPulseDamage: 5,
              fireRate: 0.08,
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
        id: 'dash-sidewake-memory-breath',
        label: '先把喘息拍留宽',
        description: '不急着把每次换边都压成进攻，先把无敌与再生撑住，给回切 build 更多容错。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              dashInvulnerability: 0.08,
              regeneration: 0.1,
              moveSpeed: 14,
              projectileSpeed: 18,
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
    id: 'escort-overread',
    name: '屏卫预读',
    contentKind: 'anomaly',
    anomalyClass: 'bossEcho',
    description: 'Boss 还没真正出现，屏卫与火线的读数就先漏了出来。你可以提前准备拆屏，也可以提前准备换边。',
    selection: {
      baseWeight: 1.2,
      minRound: 3,
      phaseBonuses: {
        late: 1.85,
        finalPrep: 1.25,
      },
      noDominantRouteBonus: 0.2,
    },
    options: [
      {
        id: 'escort-overread-break',
        label: '预装拆屏火力',
        description: '把多弹道和弹速先补好，准备在屏卫拉满时更快拆出窗口。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              multishot: 1,
              damage: 3,
              projectileSpeed: 18,
            },
          },
        ],
      },
      {
        id: 'escort-overread-lane',
        label: '预留换边余量',
        description: '把移速、再生和射速先垫起来，为首领拖线和换边留更宽的读数。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              moveSpeed: 14,
              regeneration: 0.12,
              fireRate: 0.12,
            },
          },
        ],
      },
    ],
  },
  {
    id: 'crit-crown-preview',
    name: '灼冠预读',
    contentKind: 'anomaly',
    anomalyClass: 'bossEcho',
    description: '首领压场还没真正贴脸，短窗爆点已经先从侧频里亮出来。你可以先把爆点压尖，也可以先把续热留住。',
    routeAffinity: 'crit',
    selection: {
      baseWeight: 0.98,
      minRound: 3,
      phaseBonuses: {
        late: 2,
        finalPrep: 1.42,
      },
      hintedRouteBonus: 0.25,
      dominantRouteBonus: 3.9,
      committedRouteBonus: 3.15,
      maturedRouteBonus: 1.95,
      offRouteMultiplier: 0.05,
    },
    options: [
      {
        id: 'crit-crown-preview-spike',
        label: '先把爆点压尖',
        description: '把首领前的短窗压成更尖的一记爆点。',
        routeId: 'crit',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 4,
              critChance: 0.04,
              critMultiplier: 0.28,
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
        id: 'crit-crown-preview-feed',
        label: '先把续热点亮',
        description: '先把升温链留住，准备把尾段一路烧到首领脸上。',
        routeId: 'crit',
        effects: [
          {
            type: 'stats',
            modifiers: {
              fireRate: 0.16,
              critChance: 0.05,
              moveSpeed: 12,
              regeneration: 0.08,
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
    id: 'pierce-screen-ledger',
    name: '裂屏预账',
    contentKind: 'anomaly',
    anomalyClass: 'bossEcho',
    description: '屏卫和漏火的节奏还没真正压满，拆线和扩面的账已经先摆到面前。你可以先把拆线压厚，也可以先把扇面铺开。',
    routeAffinity: 'pierce',
    selection: {
      baseWeight: 0.98,
      minRound: 3,
      phaseBonuses: {
        late: 2,
        finalPrep: 1.42,
      },
      hintedRouteBonus: 0.25,
      dominantRouteBonus: 3.9,
      committedRouteBonus: 3.15,
      maturedRouteBonus: 1.95,
      offRouteMultiplier: 0.05,
    },
    options: [
      {
        id: 'pierce-screen-ledger-break',
        label: '先把拆线压厚',
        description: '优先把屏卫和火线拆开，准备一路清到本体。',
        routeId: 'pierce',
        effects: [
          {
            type: 'stats',
            modifiers: {
              pierce: 1,
              projectileSpeed: 24,
              fireRate: 0.12,
              damage: 2,
            },
          },
          {
            type: 'route',
            routeId: 'pierce',
          },
        ],
      },
      {
        id: 'pierce-screen-ledger-fan',
        label: '先把扇面铺开',
        description: '让尾段更像清线后接回响，而不是单纯把火力塞进一条缝里。',
        routeId: 'pierce',
        effects: [
          {
            type: 'stats',
            modifiers: {
              multishot: 1,
              damage: 3,
              projectileSpeed: 16,
              moveSpeed: 8,
            },
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
    id: 'dash-return-preview',
    name: '回线窥影',
    contentKind: 'anomaly',
    anomalyClass: 'bossEcho',
    description: '首领换边前，回线空档已经先露了一截。你可以先备回摆反打，也可以先把净帧喘息留宽。',
    routeAffinity: 'dash',
    selection: {
      baseWeight: 0.98,
      minRound: 3,
      phaseBonuses: {
        late: 2,
        finalPrep: 1.42,
      },
      hintedRouteBonus: 0.25,
      dominantRouteBonus: 3.9,
      committedRouteBonus: 3.15,
      maturedRouteBonus: 1.95,
      offRouteMultiplier: 0.05,
    },
    options: [
      {
        id: 'dash-return-preview-counter',
        label: '先把反打压紧',
        description: '把回摆和擦身都压成更紧的一次反打窗口。',
        routeId: 'dash',
        effects: [
          {
            type: 'stats',
            modifiers: {
              dashInterval: -0.22,
              dashPulseDamage: 8,
              fireRate: 0.08,
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
        id: 'dash-return-preview-breath',
        label: '先把净帧留宽',
        description: '把换位后的喘息空档留得更宽，准备靠回线把尾段接回来。',
        routeId: 'dash',
        effects: [
          {
            type: 'stats',
            modifiers: {
              dashInvulnerability: 0.1,
              regeneration: 0.12,
              moveSpeed: 16,
              dashPulseDamage: 4,
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
    id: 'pocket-afterread',
    name: '口袋回读',
    contentKind: 'anomaly',
    anomalyClass: 'bossEcho',
    description: '首领火线还没真正压进场内，侧频里已经先留下了一段口袋回读。你可以把它记成拆线准备，也可以记成换边准备。',
    selection: {
      baseWeight: 1.14,
      minRound: 3,
      phaseBonuses: {
        late: 1.95,
        finalPrep: 1.35,
      },
      noDominantRouteBonus: 0.18,
    },
    options: [
      {
        id: 'pocket-afterread-break',
        label: '先记拆线',
        description: '先把拆屏、穿线和补刀的手感垫起来，准备吃下首领的火线段。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              multishot: 1,
              projectileSpeed: 18,
              pierce: 1,
            },
          },
        ],
      },
      {
        id: 'pocket-afterread-slide',
        label: '先记回摆',
        description: '先把换边和回摆窗口垫起来，为首领后段的拖线留更宽的走位。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              moveSpeed: 16,
              regeneration: 0.12,
              dashInterval: -0.16,
            },
          },
        ],
      },
    ],
  },
  {
    id: 'fireline-overread',
    name: '迁火预录',
    contentKind: 'anomaly',
    anomalyClass: 'bossEcho',
    description: '首领真正把火线往边缘拉开前，场边已经先漏出了一次迁火样本。你可以先补拆线，也可以先补回摆。',
    selection: {
      baseWeight: 0.72,
      minRound: 3,
      phaseBonuses: {
        late: 1.82,
        finalPrep: 1.18,
      },
      noDominantRouteBonus: 0.12,
    },
    options: [
      {
        id: 'fireline-overread-break',
        label: '先补拆线',
        description: '先把拆屏、穿线和补刀手感垫起来，免得迁火一开就被压住。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              pierce: 1,
              projectileSpeed: 18,
              fireRate: 0.08,
            },
          },
        ],
      },
      {
        id: 'fireline-overread-return',
        label: '先补回摆',
        description: '先把回摆和换边余量留宽一点，准备边压边把节奏追回来。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              moveSpeed: 14,
              dashInterval: -0.16,
              regeneration: 0.1,
            },
          },
        ],
      },
    ],
  },
  {
    id: 'tail-hold-preview',
    name: '尾段预录',
    contentKind: 'anomaly',
    anomalyClass: 'bossEcho',
    description: '首领还没真正压上来，当前打法最容易散掉的那一拍先漏了出来。你可以先把手感站稳，也可以先把收尾余量留宽。',
    routeAffinity: 'dominant',
    selection: {
      baseWeight: 0.68,
      minRound: 3,
      phaseBonuses: {
        late: 1.72,
        finalPrep: 1.16,
      },
      hintedRouteBonus: 0.14,
      dominantRouteBonus: 1.92,
      committedRouteBonus: 2.18,
      maturedRouteBonus: 1.08,
    },
    options: [
      {
        id: 'tail-hold-preview-press',
        label: '先把手感站稳',
        description: '沿着当前打法补一小段承接，别让尾段突然散开。',
        routeId: 'dominant',
        effects: [
          {
            type: 'stats',
            modifiers: {
              fireRate: 0.1,
              projectileSpeed: 14,
              regeneration: 0.08,
              moveSpeed: 10,
            },
          },
          {
            type: 'route',
            routeId: 'dominant',
          },
        ],
      },
      {
        id: 'tail-hold-preview-buffer',
        label: '先把收尾留宽',
        description: '补一点容错和回气，把最后那段先撑过去。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              maxHp: 8,
              regeneration: 0.1,
              moveSpeed: 8,
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
    id: 'terminal-tithe',
    name: '终端税',
    contentKind: 'anomaly',
    anomalyClass: 'distortion',
    contentTier: 'rare',
    description: '尾段终端先收走一部分稳态，才肯吐出更尖的收尾样本。',
    selection: {
      baseWeight: 0.98,
      minRound: 3,
      phaseBonuses: {
        late: 1.95,
        finalPrep: 0.9,
      },
      noDominantRouteBonus: 0.15,
    },
    options: [
      {
        id: 'terminal-tithe-offense',
        label: '先交稳态',
        description: '拿更狠的收尾火力，但立即承受 12 点压损。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 6,
              fireRate: 0.18,
              multishot: 1,
            },
          },
          {
            type: 'heal',
            amount: -12,
          },
        ],
      },
      {
        id: 'terminal-tithe-buffer',
        label: '先交火控',
        description: '放缓当下火力，换更厚的续航与走位余量。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              maxHp: 10,
              moveSpeed: 14,
              regeneration: 0.16,
              projectileSpeed: -14,
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
    id: 'boss-shadow-scan',
    name: 'Boss 阴影扫描',
    contentKind: 'anomaly',
    anomalyClass: 'bossEcho',
    contentTier: 'rare',
    description: 'Boss 载体边界泄出了一段压力样本。你还没真正撞上最终关，但已经能先决定要拿哪种收束准备。',
    selection: {
      baseWeight: 1.46,
      minRound: 3,
      phaseBonuses: {
        late: 2.2,
        finalPrep: 1.45,
      },
      noDominantRouteBonus: 0.25,
    },
    options: [
      {
        id: 'boss-shadow-scan-brace',
        label: '预装正面承压',
        description: '补一段正面顶压的厚度，准备在 Boss 压脸时仍能持续输出。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              maxHp: 10,
              damage: 3,
            },
          },
          {
            type: 'heal',
            amount: 18,
          },
        ],
      },
      {
        id: 'boss-shadow-scan-window',
        label: '预留侧向窗口',
        description: '把移动、弹速和回复提前补好，为最终 Boss 的封位和拖线留更宽的走位。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              moveSpeed: 18,
              projectileSpeed: 22,
              regeneration: 0.12,
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
    id: 'crown-switchboard',
    name: '首领并线',
    contentKind: 'anomaly',
    anomalyClass: 'bossEcho',
    contentTier: 'rare',
    description: '首领波形里不止一种收束方式在抢线。这一拍会让你决定最后一段是继续纯收尾，还是带着偏航味道撞进去。',
    routeAffinity: 'dominant',
    selection: {
      baseWeight: 1.02,
      minRound: 3,
      phaseBonuses: {
        late: 1.9,
        finalPrep: 1.55,
      },
      hintedRouteBonus: 0.12,
      dominantRouteBonus: 1.2,
      committedRouteBonus: 0.85,
      maturedRouteBonus: 0.45,
      noDominantRouteBonus: 0.1,
    },
    options: [
      {
        id: 'crown-switchboard-focus',
        label: '压成当前收尾',
        description: '把残响全压回当前路线，准备把尾段收得更尖。',
        routeId: 'dominant',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 4,
              fireRate: 0.14,
              projectileSpeed: 16,
            },
          },
          {
            type: 'route',
            routeId: 'dominant',
          },
        ],
      },
      {
        id: 'crown-switchboard-drift',
        label: '压成偏航余量',
        description: '不把这拍全部压死，改成一段更宽的偏航和回摆空间。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              maxHp: 8,
              moveSpeed: 14,
              regeneration: 0.12,
              multishot: 1,
            },
          },
        ],
      },
    ],
  },
  {
    id: 'crown-residue',
    name: '首领残响',
    contentKind: 'anomaly',
    anomalyClass: 'bossEcho',
    contentTier: 'rare',
    description: '首领波形留下了一段高压残响。你可以把它压成更稳的承压准备，也可以把它偷成更尖的收尾爆点。',
    selection: {
      baseWeight: 1.08,
      minRound: 3,
      phaseBonuses: {
        late: 1.9,
        finalPrep: 1.55,
      },
      noDominantRouteBonus: 0.1,
    },
    options: [
      {
        id: 'crown-residue-brace',
        label: '先拿承压余量',
        description: '把残响压成更厚的耐久、回收和基础火力，准备顶住首领正压。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              maxHp: 10,
              regeneration: 0.14,
              damage: 2,
            },
          },
          {
            type: 'heal',
            amount: 10,
          },
        ],
      },
      {
        id: 'crown-residue-breach',
        label: '先偷收尾火力',
        description: '把残响偷成更尖的收尾输出，但会先吞下一口回震。',
        effects: [
          {
            type: 'stats',
            modifiers: {
              damage: 5,
              fireRate: 0.16,
              projectileSpeed: 20,
            },
          },
          {
            type: 'heal',
            amount: -8,
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

  const normalizedEffects = normalizeEffectsToSingleStat(
    `${eventId}:${option.id}`,
    option.effects,
    option.routeId && option.routeId !== 'dominant' ? option.routeId : undefined,
  );

  return {
    ...option,
    effects: appendImplicitAnomalyRouteSupport(eventDef, option, normalizedEffects),
  };
}

export const EVENT_CATALOG: EventDefinition[] = RAW_EVENT_CATALOG.map((eventDef) => ({
  ...eventDef,
  options: eventDef.options.map((option) => normalizeEventOptionEffects(eventDef, eventDef.id, option)),
}));

export const STANDARD_EVENT_CATALOG = EVENT_CATALOG.filter((eventDef) => (eventDef.contentKind ?? 'event') === 'event');

export const ANOMALY_EVENT_CATALOG = EVENT_CATALOG.filter((eventDef) => (eventDef.contentKind ?? 'event') === 'anomaly');

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
