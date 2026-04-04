import type { BattleState, BattleTemplateDefinition, BattleTemplateId } from '../game/types';

export const BATTLE_TEMPLATES: Record<BattleTemplateId, BattleTemplateDefinition> = {
  elimination: {
    id: 'elimination',
    name: '歼灭',
    description: '清掉敌群，快速推进。',
    durationSec: 26,
    spawnIntervalSec: 0.85,
    enemyHp: 18,
    enemySpeed: 58,
    enemyDamage: 7,
    regularEnemyCap: 9,
    pressureMultiplier: 1,
    accent: 0x5790ff,
    winCondition: {
      type: 'kills',
      target: 22,
    },
    spawnRule: {
      pattern: 'surround',
      burstCount: 1,
    },
  },
  'elimination-pincer': {
    id: 'elimination-pincer',
    name: '夹击歼灭',
    description: '敌人更偏向左右夹击，要求你更快换侧。',
    durationSec: 25,
    spawnIntervalSec: 0.78,
    enemyHp: 17,
    enemySpeed: 66,
    enemyDamage: 7,
    regularEnemyCap: 10,
    pressureMultiplier: 1.08,
    accent: 0x5f9cff,
    winCondition: {
      type: 'kills',
      target: 24,
    },
    spawnRule: {
      pattern: 'pincers',
      burstCount: 1,
    },
  },
  'elimination-sweep': {
    id: 'elimination-sweep',
    name: '扫线歼灭',
    description: '敌潮更偏向上下扫线，单个敌人更厚但推进更整齐。',
    durationSec: 27,
    spawnIntervalSec: 0.92,
    enemyHp: 24,
    enemySpeed: 54,
    enemyDamage: 8,
    regularEnemyCap: 8,
    pressureMultiplier: 1.12,
    accent: 0x6696ff,
    winCondition: {
      type: 'kills',
      target: 18,
    },
    spawnRule: {
      pattern: 'lanes',
      burstCount: 2,
      laneBias: 'horizontal',
    },
  },
  elite: {
    id: 'elite',
    name: '精英压制',
    description: '顶住高压，击破精英。',
    durationSec: 32,
    spawnIntervalSec: 1.25,
    enemyHp: 20,
    enemySpeed: 52,
    enemyDamage: 8,
    regularEnemyCap: 8,
    pressureMultiplier: 1.16,
    accent: 0xffba4a,
    winCondition: {
      type: 'elite',
      target: 1,
    },
    spawnRule: {
      pattern: 'surround',
      burstCount: 1,
    },
    eliteRule: {
      spawnAtSec: 4,
      hpMultiplier: 10,
      speedMultiplier: 0.85,
      damageMultiplier: 2.2,
      radius: 22,
      regularEnemyCap: 10,
      behavior: 'frontline',
      preferredDistance: 160,
      strafeStrength: 0.18,
    },
  },
  'elite-lockdown': {
    id: 'elite-lockdown',
    name: '包围压制',
    description: '精英更早带着护卫压上来，留给你的整理时间更少。',
    durationSec: 30,
    spawnIntervalSec: 1.05,
    enemyHp: 21,
    enemySpeed: 58,
    enemyDamage: 8,
    regularEnemyCap: 9,
    pressureMultiplier: 1.28,
    accent: 0xff9b3d,
    winCondition: {
      type: 'elite',
      target: 1,
    },
    spawnRule: {
      pattern: 'pincers',
      burstCount: 1,
    },
    eliteRule: {
      spawnAtSec: 2.8,
      hpMultiplier: 9.5,
      speedMultiplier: 0.92,
      damageMultiplier: 2.3,
      radius: 22,
      regularEnemyCap: 12,
      behavior: 'kiting',
      preferredDistance: 190,
      strafeStrength: 0.34,
      escortBatch: 2,
      escortRespawnSec: 6.2,
      escortMax: 6,
    },
  },
  'elite-screen': {
    id: 'elite-screen',
    name: '掩护压制',
    description: '精英会借护卫线拖时间，逼你先拆掩护再摸到本体。',
    durationSec: 33,
    spawnIntervalSec: 1.18,
    enemyHp: 20,
    enemySpeed: 54,
    enemyDamage: 8,
    regularEnemyCap: 8,
    pressureMultiplier: 1.24,
    accent: 0xffc35a,
    winCondition: {
      type: 'elite',
      target: 1,
    },
    spawnRule: {
      pattern: 'lanes',
      burstCount: 1,
      laneBias: 'vertical',
    },
    eliteRule: {
      spawnAtSec: 3.4,
      hpMultiplier: 9.2,
      speedMultiplier: 0.88,
      damageMultiplier: 2.05,
      radius: 22,
      regularEnemyCap: 11,
      behavior: 'screened',
      preferredDistance: 210,
      strafeStrength: 0.24,
      escortBatch: 3,
      escortRespawnSec: 5.2,
      escortMax: 7,
    },
  },
  survival: {
    id: 'survival',
    name: '生存压制',
    description: '撑住敌潮，守住节奏。',
    durationSec: 28,
    spawnIntervalSec: 0.5,
    enemyHp: 22,
    enemySpeed: 68,
    enemyDamage: 9,
    regularEnemyCap: 12,
    pressureMultiplier: 1.22,
    accent: 0xff5f7a,
    winCondition: {
      type: 'survive',
    },
    spawnRule: {
      pattern: 'surround',
      burstCount: 1,
    },
  },
  'survival-rush': {
    id: 'survival-rush',
    name: '紧逼生存',
    description: '敌潮更快贴脸，考验你在高压下继续换位的能力。',
    durationSec: 24,
    spawnIntervalSec: 0.38,
    enemyHp: 23,
    enemySpeed: 74,
    enemyDamage: 10,
    regularEnemyCap: 14,
    pressureMultiplier: 1.34,
    accent: 0xff4d68,
    winCondition: {
      type: 'survive',
    },
    spawnRule: {
      pattern: 'pincers',
      burstCount: 1,
    },
  },
  'survival-gauntlet': {
    id: 'survival-gauntlet',
    name: '夹道求生',
    description: '敌人沿着窄通道扫进来，逼你在前后压迫里找空档换位。',
    durationSec: 26,
    spawnIntervalSec: 0.48,
    enemyHp: 26,
    enemySpeed: 64,
    enemyDamage: 10,
    regularEnemyCap: 13,
    pressureMultiplier: 1.3,
    accent: 0xff6f82,
    winCondition: {
      type: 'survive',
    },
    spawnRule: {
      pattern: 'lanes',
      burstCount: 2,
      laneBias: 'horizontal',
    },
  },
};

export function getBattleTargetKills(templateId: BattleTemplateId): number {
  const template = BATTLE_TEMPLATES[templateId];
  return template.winCondition.type === 'kills' ? template.winCondition.target ?? 0 : 0;
}

export function getBattleProgressText(battle: BattleState): string {
  const template = BATTLE_TEMPLATES[battle.templateId];
  switch (template.winCondition.type) {
    case 'survive':
      return `${template.name} ${Math.ceil(battle.remainingSec)}s`;
    case 'elite':
      return `${template.name} ${battle.eliteAlive ? '击破精英' : '准备交火'}`;
    case 'kills':
    default:
      return `${template.name} ${battle.kills}/${template.winCondition.target ?? battle.targetKills}`;
  }
}

export function isBattleVictory(battle: BattleState): boolean {
  const template = BATTLE_TEMPLATES[battle.templateId];
  switch (template.winCondition.type) {
    case 'kills':
      return battle.kills >= (template.winCondition.target ?? 0);
    case 'elite':
      return battle.eliteSpawned && !battle.eliteAlive;
    case 'survive':
      return battle.remainingSec <= 0;
    default:
      return false;
  }
}

export function shouldSpawnElite(battle: BattleState): boolean {
  const template = BATTLE_TEMPLATES[battle.templateId];
  if (!template.eliteRule) {
    return false;
  }
  return !battle.eliteSpawned && battle.elapsedSec >= template.eliteRule.spawnAtSec;
}
