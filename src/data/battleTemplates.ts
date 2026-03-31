import type { BattleTemplateDefinition, BattleTemplateId } from '../game/types';

export const BATTLE_TEMPLATES: Record<BattleTemplateId, BattleTemplateDefinition> = {
  elimination: {
    id: 'elimination',
    name: '歼灭',
    description: '清掉敌群，快速推进。',
    durationSec: 26,
    targetKills: 22,
    spawnIntervalSec: 0.85,
    enemyHp: 18,
    enemySpeed: 58,
    accent: 0x5790ff,
  },
  elite: {
    id: 'elite',
    name: '精英压制',
    description: '顶住高压，击破精英。',
    durationSec: 32,
    targetKills: 1,
    spawnIntervalSec: 1.25,
    enemyHp: 20,
    enemySpeed: 52,
    accent: 0xffba4a,
  },
  survival: {
    id: 'survival',
    name: '生存压制',
    description: '撑住敌潮，守住节奏。',
    durationSec: 28,
    targetKills: 0,
    spawnIntervalSec: 0.5,
    enemyHp: 22,
    enemySpeed: 68,
    accent: 0xff5f7a,
  },
};
