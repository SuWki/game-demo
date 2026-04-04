import type { EventDefinition } from '../game/types';

export const EVENT_CATALOG: EventDefinition[] = [
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
    description: '试飞记录给出一次偏向路线的机会，但机体会承受额外负荷。',
    selection: {
      baseWeight: 2.5,
      maxRound: 2,
      phaseBonuses: {
        opening: 1.1,
        mid: 0.3,
      },
      noDominantRouteBonus: 1,
    },
    options: [
      {
        id: 'risky-protocol-crit',
        label: '追求爆发',
        description: '向暴击方向推进，并承受 8 点压力伤害。',
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
      {
        id: 'risky-protocol-pierce',
        label: '追求贯穿',
        description: '向穿透方向推进，并承受 8 点压力伤害。',
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
      {
        id: 'risky-protocol-dash',
        label: '追求穿梭',
        description: '向穿梭方向推进，并承受 8 点压力伤害。',
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
        late: 0.9,
      },
      hintedRouteBonus: 1.2,
      dominantRouteBonus: 3.4,
      committedRouteBonus: 2,
      maturedRouteBonus: 0.8,
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
        late: 1.2,
      },
      hintedRouteBonus: 0.8,
      dominantRouteBonus: 3.2,
      committedRouteBonus: 2,
      maturedRouteBonus: 1,
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
    id: 'cross-branch-signal',
    name: '岔路讯号',
    contentTier: 'rare',
    description: '一段侧频样本插了进来。它不一定比当前方向更强，但足够让这局出现一次真正的转向诱惑。',
    routeAffinity: 'dominant',
    selection: {
      baseWeight: 1.2,
      minRound: 2,
      phaseBonuses: {
        mid: 1.5,
        late: 1.7,
        finalPrep: 0.6,
      },
      hintedRouteBonus: 1.1,
      dominantRouteBonus: 2.2,
      committedRouteBonus: 1.3,
      maturedRouteBonus: 0.4,
    },
    options: [
      {
        id: 'cross-branch-signal-crit',
        label: '接入暴击样本',
        description: '补一段升温火力，顺手把读法切向暴击。',
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
        ],
      },
      {
        id: 'cross-branch-signal-pierce',
        label: '接入贯穿样本',
        description: '补一段穿透与弹速，把读法切向贯穿清线。',
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
        ],
      },
      {
        id: 'cross-branch-signal-dash',
        label: '接入穿梭样本',
        description: '补一段换位与规避，把读法切向穿梭反打。',
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
        ],
      },
    ],
  },
  {
    id: 'blackbox-bargain',
    name: '黑匣押注',
    contentTier: 'rare',
    description: '封存记录只够开一次。你可以把它压成高风险兑现，也可以拆成这局独有的一段缓冲余地。',
    selection: {
      baseWeight: 1.05,
      minRound: 3,
      phaseBonuses: {
        late: 1.8,
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
    id: 'crit-heat-bank',
    name: '热区记录',
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
];
