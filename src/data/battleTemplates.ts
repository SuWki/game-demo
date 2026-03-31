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
    accent: 0x5790ff,
    winCondition: {
      type: 'kills',
      target: 22,
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
    accent: 0xffba4a,
    winCondition: {
      type: 'elite',
      target: 1,
    },
    eliteRule: {
      spawnAtSec: 4,
      hpMultiplier: 10,
      speedMultiplier: 0.85,
      radius: 22,
      regularEnemyCap: 10,
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
    accent: 0xff9b3d,
    winCondition: {
      type: 'elite',
      target: 1,
    },
    eliteRule: {
      spawnAtSec: 2.8,
      hpMultiplier: 9.5,
      speedMultiplier: 0.92,
      radius: 22,
      regularEnemyCap: 12,
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
    accent: 0xff5f7a,
    winCondition: {
      type: 'survive',
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
    accent: 0xff4d68,
    winCondition: {
      type: 'survive',
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

export function getRegularEnemyCap(templateId: BattleTemplateId): number | null {
  return BATTLE_TEMPLATES[templateId].eliteRule?.regularEnemyCap ?? null;
}
