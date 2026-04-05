import type {
  BattleEncounterType,
  BattleState,
  BattleTemplateDefinition,
  BattleTemplateId,
  EnemyArchetypeId,
  EliteBehaviorId,
} from '../game/types';

const ENEMY_ARCHETYPE_LABEL_MAP: Record<EnemyArchetypeId, string> = {
  standard: '普通怪',
  brute: '厚血怪',
  skirmisher: '高速怪',
  ranged: '远程怪',
};

const ELITE_BEHAVIOR_READOUT_MAP: Record<EliteBehaviorId, string> = {
  frontline: '正面顶压',
  screened: '护卫遮线',
  kiting: '反拉压迫',
  summoner: '召援拖场',
};

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
    regularArchetypes: {
      standard: 3,
      brute: 1.1,
      skirmisher: 1.1,
      ranged: 0.25,
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
    regularArchetypes: {
      standard: 1.7,
      brute: 0.6,
      skirmisher: 2.8,
      ranged: 0.4,
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
    regularArchetypes: {
      standard: 1.4,
      brute: 2.4,
      skirmisher: 0.7,
      ranged: 0.4,
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
    regularArchetypes: {
      standard: 2.1,
      brute: 1.7,
      skirmisher: 0.8,
      ranged: 0.45,
    },
    escortArchetypes: {
      standard: 1.6,
      brute: 0.8,
      skirmisher: 1.2,
      ranged: 0.45,
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
  'elite-vice': {
    id: 'elite-vice',
    name: '绞锁压制',
    description: '低频出现的绞锁模板。精英会持续补护卫，把整场节奏拧得更紧。',
    contentTier: 'rare',
    durationSec: 31,
    spawnIntervalSec: 1.02,
    enemyHp: 22,
    enemySpeed: 56,
    enemyDamage: 9,
    regularEnemyCap: 9,
    pressureMultiplier: 1.34,
    accent: 0xff9348,
    winCondition: {
      type: 'elite',
      target: 1,
    },
    spawnRule: {
      pattern: 'pincers',
      burstCount: 1,
    },
    regularArchetypes: {
      standard: 1.7,
      brute: 1.2,
      skirmisher: 1,
      ranged: 1.35,
    },
    escortArchetypes: {
      standard: 0.9,
      brute: 0.6,
      skirmisher: 1.1,
      ranged: 1.9,
    },
    eliteRule: {
      spawnAtSec: 3,
      hpMultiplier: 10.2,
      speedMultiplier: 0.9,
      damageMultiplier: 2.25,
      radius: 22,
      regularEnemyCap: 12,
      behavior: 'summoner',
      preferredDistance: 200,
      strafeStrength: 0.28,
      escortBatch: 2,
      escortRespawnSec: 4.4,
      escortMax: 8,
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
    regularArchetypes: {
      standard: 1.6,
      brute: 1.1,
      skirmisher: 1.8,
      ranged: 0.95,
    },
    escortArchetypes: {
      standard: 1,
      brute: 0.6,
      skirmisher: 1.55,
      ranged: 1.2,
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
    regularArchetypes: {
      standard: 1.2,
      brute: 1,
      skirmisher: 1.2,
      ranged: 1.6,
    },
    escortArchetypes: {
      standard: 0.8,
      brute: 0.6,
      skirmisher: 1.1,
      ranged: 2.3,
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
  'boss-hunt': {
    id: 'boss-hunt',
    name: '主核压制',
    description: '最终 Boss 会直接压上来，用明确的高压节奏收束整局。',
    encounterType: 'boss',
    durationSec: 36,
    spawnIntervalSec: 1.04,
    enemyHp: 24,
    enemySpeed: 58,
    enemyDamage: 9,
    regularEnemyCap: 10,
    pressureMultiplier: 1.38,
    accent: 0xff7d59,
    winCondition: {
      type: 'elite',
      target: 1,
    },
    spawnRule: {
      pattern: 'surround',
      burstCount: 1,
    },
    regularArchetypes: {
      standard: 1.3,
      brute: 1.6,
      skirmisher: 1,
      ranged: 0.55,
    },
    escortArchetypes: {
      standard: 1.2,
      brute: 1,
      skirmisher: 0.8,
      ranged: 0.45,
    },
    eliteRule: {
      spawnAtSec: 1.6,
      hpMultiplier: 12.4,
      speedMultiplier: 0.96,
      damageMultiplier: 2.45,
      radius: 26,
      regularEnemyCap: 12,
      behavior: 'frontline',
      preferredDistance: 176,
      strafeStrength: 0.18,
    },
  },
  'boss-lockdown': {
    id: 'boss-lockdown',
    name: '锁域主核',
    description: '最终 Boss 会提早带着护卫压进来，把最后一段走位空间挤得更紧。',
    encounterType: 'boss',
    durationSec: 35,
    spawnIntervalSec: 0.98,
    enemyHp: 23,
    enemySpeed: 60,
    enemyDamage: 9,
    regularEnemyCap: 11,
    pressureMultiplier: 1.42,
    accent: 0xff8650,
    winCondition: {
      type: 'elite',
      target: 1,
    },
    spawnRule: {
      pattern: 'pincers',
      burstCount: 1,
    },
    regularArchetypes: {
      standard: 1.2,
      brute: 1,
      skirmisher: 1.8,
      ranged: 1.05,
    },
    escortArchetypes: {
      standard: 0.9,
      brute: 0.6,
      skirmisher: 1.6,
      ranged: 1.35,
    },
    eliteRule: {
      spawnAtSec: 1.4,
      hpMultiplier: 11.8,
      speedMultiplier: 1,
      damageMultiplier: 2.4,
      radius: 26,
      regularEnemyCap: 13,
      behavior: 'kiting',
      preferredDistance: 204,
      strafeStrength: 0.36,
      escortBatch: 2,
      escortRespawnSec: 5,
      escortMax: 7,
    },
  },
  'boss-bastion': {
    id: 'boss-bastion',
    name: '屏卫主核',
    description: '最终 Boss 会借护卫与远程火线拖长对局，让最终关不再只是普通 elite 变体。',
    encounterType: 'boss',
    durationSec: 37,
    spawnIntervalSec: 1.08,
    enemyHp: 25,
    enemySpeed: 56,
    enemyDamage: 9,
    regularEnemyCap: 11,
    pressureMultiplier: 1.4,
    accent: 0xff9462,
    winCondition: {
      type: 'elite',
      target: 1,
    },
    spawnRule: {
      pattern: 'lanes',
      burstCount: 1,
      laneBias: 'vertical',
    },
    regularArchetypes: {
      standard: 1,
      brute: 1.1,
      skirmisher: 1,
      ranged: 1.95,
    },
    escortArchetypes: {
      standard: 0.7,
      brute: 0.6,
      skirmisher: 1.1,
      ranged: 2.6,
    },
    eliteRule: {
      spawnAtSec: 1.8,
      hpMultiplier: 12.1,
      speedMultiplier: 0.9,
      damageMultiplier: 2.32,
      radius: 27,
      regularEnemyCap: 13,
      behavior: 'screened',
      preferredDistance: 214,
      strafeStrength: 0.26,
      escortBatch: 3,
      escortRespawnSec: 4.8,
      escortMax: 8,
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
    regularArchetypes: {
      standard: 2.1,
      brute: 1.2,
      skirmisher: 1.8,
      ranged: 0.75,
    },
  },
  'survival-crossfire': {
    id: 'survival-crossfire',
    name: '交火求生',
    description: '低频出现的交火模板。两向火线会更频繁地把你压进换位窗口。',
    contentTier: 'rare',
    durationSec: 25,
    spawnIntervalSec: 0.42,
    enemyHp: 24,
    enemySpeed: 72,
    enemyDamage: 10,
    regularEnemyCap: 13,
    pressureMultiplier: 1.36,
    accent: 0xff5676,
    winCondition: {
      type: 'survive',
    },
    spawnRule: {
      pattern: 'lanes',
      burstCount: 2,
      laneBias: 'vertical',
    },
    regularArchetypes: {
      standard: 1.2,
      brute: 1,
      skirmisher: 1.2,
      ranged: 2.7,
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
    regularArchetypes: {
      standard: 1.5,
      brute: 0.9,
      skirmisher: 2.9,
      ranged: 0.6,
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
    regularArchetypes: {
      standard: 1.4,
      brute: 1.95,
      skirmisher: 1.1,
      ranged: 0.85,
    },
  },
};

function getTopArchetypeLabels(
  weights: Partial<Record<EnemyArchetypeId, number>> | undefined,
  count: number,
): string[] {
  return Object.entries(weights ?? {})
    .filter((entry): entry is [EnemyArchetypeId, number] => Boolean(entry[1] && entry[1] > 0))
    .sort((left, right) => right[1] - left[1])
    .slice(0, count)
    .map(([archetypeId]) => ENEMY_ARCHETYPE_LABEL_MAP[archetypeId]);
}

function getSpawnPatternReadout(template: BattleTemplateDefinition): string {
  const spawnRule = template.spawnRule;
  if (!spawnRule) {
    return '环压逼近';
  }

  if (spawnRule.pattern === 'pincers') {
    return '侧压包夹';
  }

  if (spawnRule.pattern === 'lanes') {
    return spawnRule.laneBias === 'horizontal' ? '横线推进' : '纵向火线';
  }

  return '环压逼近';
}

export function getBattleEncounterLabel(
  templateId: BattleTemplateId,
  encounterType?: BattleEncounterType,
): string {
  const template = BATTLE_TEMPLATES[templateId];
  const resolvedEncounterType = encounterType ?? template.encounterType ?? 'battle';

  if (resolvedEncounterType === 'boss') {
    return 'Boss载体';
  }

  switch (template.winCondition.type) {
    case 'elite':
      return '精英战';
    case 'survive':
      return '生存战';
    case 'kills':
    default:
      return '普通战';
  }
}

export function getBattleEnemyReadout(templateId: BattleTemplateId): string {
  const template = BATTLE_TEMPLATES[templateId];
  const frontline = getTopArchetypeLabels(template.regularArchetypes, 2);
  const escort = getTopArchetypeLabels(template.escortArchetypes, 2);
  const parts = [
    `敌群 ${frontline.length > 0 ? frontline.join(' / ') : '普通怪'}`,
    `节奏 ${getSpawnPatternReadout(template)}`,
  ];

  if (escort.length > 0) {
    parts.push(`护卫 ${escort.join(' / ')}`);
  }

  if (template.eliteRule?.behavior) {
    parts.push(`主核 ${ELITE_BEHAVIOR_READOUT_MAP[template.eliteRule.behavior]}`);
  }

  return parts.join(' · ');
}

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
