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
      baseWeight: 3.2,
      maxRound: 2,
      phaseBonuses: {
        opening: 1.5,
        mid: 0.8,
      },
      noDominantRouteBonus: 1.4,
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
      baseWeight: 2.4,
      minRound: 2,
      phaseBonuses: {
        mid: 1.1,
        late: 1.5,
      },
      dominantRouteBonus: 4.6,
      committedRouteBonus: 2.4,
      maturedRouteBonus: 1.2,
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
      baseWeight: 2.6,
      minRound: 2,
      phaseBonuses: {
        mid: 1.2,
        late: 1.6,
      },
      dominantRouteBonus: 4.8,
      committedRouteBonus: 2.6,
      maturedRouteBonus: 1.3,
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
    id: 'crit-heat-bank',
    name: '热区记录',
    description: '一段暴击热区记录被锁定。你要把连发窗口继续拉长，还是把单次爆点压得更狠？',
    routeAffinity: 'crit',
    selection: {
      baseWeight: 0.9,
      minRound: 2,
      phaseBonuses: {
        mid: 1.2,
        late: 1.8,
      },
      dominantRouteBonus: 3.8,
      committedRouteBonus: 2.8,
      maturedRouteBonus: 1.4,
      offRouteMultiplier: 0.08,
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
    description: '你截获了一张贯穿波形图。要继续拉长链条，还是把清线扇面直接铺开？',
    routeAffinity: 'pierce',
    selection: {
      baseWeight: 0.9,
      minRound: 2,
      phaseBonuses: {
        mid: 1.2,
        late: 1.8,
      },
      dominantRouteBonus: 3.8,
      committedRouteBonus: 2.8,
      maturedRouteBonus: 1.4,
      offRouteMultiplier: 0.08,
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
    description: '机体留下了一段高压换位回放。要把擦身蓄能做厚，还是把反打窗口拉长？',
    routeAffinity: 'dash',
    selection: {
      baseWeight: 0.9,
      minRound: 2,
      phaseBonuses: {
        mid: 1.2,
        late: 1.8,
      },
      dominantRouteBonus: 3.8,
      committedRouteBonus: 2.8,
      maturedRouteBonus: 1.4,
      offRouteMultiplier: 0.08,
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
