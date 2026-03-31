import type { EventDefinition } from '../game/types';

export const EVENT_CATALOG: EventDefinition[] = [
  {
    id: 'field-maintenance',
    name: '临时整备',
    description: '短暂停机维护。你要更稳的续航，还是更敢压进下一段？',
    options: [
      {
        id: 'field-maintenance-heal',
        label: '补强外甲',
        description: '恢复 22 点耐久，并提高 8 点上限。',
        modifiers: {
          maxHp: 8,
        },
        heal: 22,
      },
      {
        id: 'field-maintenance-damage',
        label: '压榨火控',
        description: '伤害与射速小幅抬升。',
        modifiers: {
          damage: 6,
          fireRate: 0.25,
        },
      },
    ],
  },
  {
    id: 'risky-protocol',
    name: '高压试飞',
    description: '试飞记录给出一次偏向路线的机会，但机体会承受额外负荷。',
    options: [
      {
        id: 'risky-protocol-crit',
        label: '追求爆发',
        description: '向暴击方向推进，并承受 8 点压力伤害。',
        routeId: 'crit',
        modifiers: {
          critChance: 0.08,
        },
        heal: -8,
      },
      {
        id: 'risky-protocol-pierce',
        label: '追求贯穿',
        description: '向穿透方向推进，并承受 8 点压力伤害。',
        routeId: 'pierce',
        modifiers: {
          pierce: 1,
        },
        heal: -8,
      },
      {
        id: 'risky-protocol-dash',
        label: '追求穿梭',
        description: '向穿梭方向推进，并承受 8 点压力伤害。',
        routeId: 'dash',
        modifiers: {
          dashPulseDamage: 6,
          dashInterval: -0.4,
        },
        heal: -8,
      },
    ],
  },
  {
    id: 'route-calibration',
    name: '读数校准',
    description: '系统建议你顺着已有倾向继续深入，或者先补一个保底。',
    options: [
      {
        id: 'route-calibration-focus',
        label: '继续压当前方向',
        description: '强化已有路线的关键手感。',
        modifiers: {
          damage: 5,
          fireRate: 0.15,
        },
      },
      {
        id: 'route-calibration-stabilize',
        label: '补一个稳态',
        description: '恢复 12 点耐久，并提高射速。',
        modifiers: {
          fireRate: 0.2,
        },
        heal: 12,
      },
    ],
  },
];
