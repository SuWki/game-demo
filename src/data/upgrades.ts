import type { UpgradeDefinition } from '../game/types';

export const UPGRADE_CATALOG: UpgradeDefinition[] = [
  {
    id: 'crit-aim',
    name: '聚焦瞄准',
    description: '暴击率提升，前段更容易打出爆点。',
    routeId: 'crit',
    modifiers: {
      critChance: 0.12,
      damage: 4,
    },
  },
  {
    id: 'crit-burst',
    name: '连发校准',
    description: '射速上升，暴击节奏更密。',
    routeId: 'crit',
    modifiers: {
      fireRate: 0.55,
      critChance: 0.08,
    },
  },
  {
    id: 'crit-finish',
    name: '终端爆发',
    description: '暴击倍率提升，终局更容易瞬间清场。',
    routeId: 'crit',
    modifiers: {
      critChance: 0.1,
      critMultiplier: 0.7,
    },
  },
  {
    id: 'pierce-core',
    name: '穿甲校正',
    description: '子弹获得额外穿透层数。',
    routeId: 'pierce',
    modifiers: {
      pierce: 1,
      damage: 3,
    },
  },
  {
    id: 'pierce-fan',
    name: '裂轨分束',
    description: '增加分束，让火力更适合清线。',
    routeId: 'pierce',
    modifiers: {
      multishot: 1,
      damage: 2,
    },
  },
  {
    id: 'pierce-chain',
    name: '续链增程',
    description: '穿透和射速同时抬升，推进更稳。',
    routeId: 'pierce',
    modifiers: {
      pierce: 1,
      fireRate: 0.35,
    },
  },
  {
    id: 'dash-brush',
    name: '擦身推进',
    description: '定期触发穿梭脉冲，近身也能换取收益。',
    routeId: 'dash',
    modifiers: {
      dashPulseDamage: 10,
      moveSpeed: 12,
      dashInterval: -0.7,
    },
  },
  {
    id: 'dash-loop',
    name: '净帧循环',
    description: '穿梭间隔缩短，机体更容易稳定脱离高压。',
    routeId: 'dash',
    modifiers: {
      dashPulseDamage: 8,
      dashInterval: -0.9,
      dashInvulnerability: 0.18,
    },
  },
  {
    id: 'dash-anchor',
    name: '穿梭定标',
    description: '穿梭时回复少量护体，续航更稳。',
    routeId: 'dash',
    modifiers: {
      regeneration: 0.35,
      dashPulseDamage: 6,
      moveSpeed: 14,
    },
  },
  {
    id: 'generic-armor',
    name: '应急装甲',
    description: '抬高上限并立刻恢复部分耐久。',
    modifiers: {
      maxHp: 18,
    },
  },
  {
    id: 'generic-control',
    name: '稳态火控',
    description: '火力更平滑，基础伤害上升。',
    modifiers: {
      damage: 7,
      fireRate: 0.2,
    },
  },
  {
    id: 'generic-cooling',
    name: '冷却压缩',
    description: '进一步提高射速，稳定推进。',
    modifiers: {
      fireRate: 0.45,
    },
  },
];
