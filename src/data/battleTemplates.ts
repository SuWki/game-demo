import type {
  BattleEncounterType,
  BattleState,
  BattleTemplateDefinition,
  BattleTemplateId,
  EnemyArchetypeId,
  EliteBehaviorId,
  PressurePocketShiftModeId,
  PressureSafeWindowAxis,
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

const POCKET_SHIFT_READOUT_MAP: Record<PressurePocketShiftModeId, string> = {
  sweep: '妯垏',
  centerReset: '鍥炲績',
  edgeBounce: '鍘嬭竟',
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
    enemyHp: 22,
    enemySpeed: 52,
    enemyDamage: 9,
    regularEnemyCap: 9,
    pressureMultiplier: 1.24,
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
      hpMultiplier: 11.6,
      speedMultiplier: 0.9,
      damageMultiplier: 2.35,
      guardSec: 5.2,
      guardDamageMultiplier: 0.42,
      radius: 22,
      regularEnemyCap: 11,
      behavior: 'frontline',
      preferredDistance: 160,
      strafeStrength: 0.18,
      escortBatch: 1,
      escortRespawnSec: 7.4,
      escortMax: 2,
      pressurePhases: [
        {
          id: 'collapse',
          label: '压进',
          triggerHpRatio: 0.58,
          triggerRemainingSec: 14,
          spawnIntervalMultiplier: 0.9,
          regularEnemyCapBonus: 1,
          eliteSpeedMultiplier: 1.08,
          preferredDistanceDelta: -18,
        },
      ],
    },
  },
  'elite-vice': {
    id: 'elite-vice',
    name: '绞锁压制',
    description: '低频出现的绞锁模板。精英会持续补护卫，把整场节奏拧得更紧。',
    contentTier: 'rare',
    durationSec: 31,
    spawnIntervalSec: 1.02,
    enemyHp: 24,
    enemySpeed: 56,
    enemyDamage: 10,
    regularEnemyCap: 10,
    pressureMultiplier: 1.42,
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
      hpMultiplier: 11.2,
      speedMultiplier: 0.9,
      damageMultiplier: 2.4,
      guardSec: 4.8,
      guardDamageMultiplier: 0.46,
      radius: 22,
      regularEnemyCap: 13,
      behavior: 'summoner',
      preferredDistance: 200,
      strafeStrength: 0.28,
      escortBatch: 2,
      escortRespawnSec: 3.8,
      escortMax: 9,
      pressurePhases: [
        {
          id: 'pinch',
          label: '围压',
          triggerHpRatio: 0.64,
          triggerRemainingSec: 16,
          spawnIntervalMultiplier: 0.88,
          regularEnemyCapBonus: 1,
          escortBatchBonus: 1,
          escortMaxBonus: 2,
          escortRespawnMultiplier: 0.74,
          rangedShotIntervalMultiplier: 0.82,
        },
      ],
    },
  },
  'elite-lockdown': {
    id: 'elite-lockdown',
    name: '包围压制',
    description: '精英更早带着护卫压上来，留给你的整理时间更少。',
    durationSec: 30,
    spawnIntervalSec: 1.05,
    enemyHp: 23,
    enemySpeed: 59,
    enemyDamage: 9,
    regularEnemyCap: 10,
    pressureMultiplier: 1.36,
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
      hpMultiplier: 10.6,
      speedMultiplier: 0.94,
      damageMultiplier: 2.42,
      guardSec: 4.6,
      guardDamageMultiplier: 0.48,
      radius: 22,
      regularEnemyCap: 13,
      behavior: 'kiting',
      preferredDistance: 190,
      strafeStrength: 0.34,
      escortBatch: 2,
      escortRespawnSec: 5.2,
      escortMax: 7,
      pressurePhases: [
        {
          id: 'seal-in',
          label: '收口',
          triggerHpRatio: 0.6,
          triggerRemainingSec: 15,
          spawnIntervalMultiplier: 0.9,
          regularEnemyCapBonus: 1,
          escortBatchBonus: 1,
          escortMaxBonus: 2,
          escortRespawnMultiplier: 0.78,
          eliteSpeedMultiplier: 1.06,
        },
      ],
    },
  },
  'elite-screen': {
    id: 'elite-screen',
    name: '掩护压制',
    description: '精英会借护卫线拖时间，逼你先拆掩护再摸到本体。',
    durationSec: 33,
    spawnIntervalSec: 1.18,
    enemyHp: 22,
    enemySpeed: 54,
    enemyDamage: 9,
    regularEnemyCap: 9,
    pressureMultiplier: 1.33,
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
      hpMultiplier: 10.4,
      speedMultiplier: 0.88,
      damageMultiplier: 2.2,
      guardSec: 4.9,
      guardDamageMultiplier: 0.48,
      radius: 22,
      regularEnemyCap: 12,
      behavior: 'screened',
      preferredDistance: 210,
      strafeStrength: 0.24,
      escortBatch: 3,
      escortRespawnSec: 4.8,
      escortMax: 8,
      pressurePhases: [
        {
          id: 'crossfire',
          label: '封火',
          triggerHpRatio: 0.62,
          triggerRemainingSec: 15,
          escortBatchBonus: 1,
          escortMaxBonus: 1,
          escortRespawnMultiplier: 0.8,
          rangedShotIntervalMultiplier: 0.86,
          rangedProjectileSpeedMultiplier: 1.08,
        },
      ],
    },
  },
  'boss-hunt': {
    id: 'boss-hunt',
    name: '主核压制',
    description: '最终 Boss 会直接压上来，用明确的高压节奏收束整局。',
    encounterType: 'boss',
    durationSec: 38,
    spawnIntervalSec: 1.04,
    enemyHp: 26,
    enemySpeed: 58,
    enemyDamage: 10,
    regularEnemyCap: 11,
    pressureMultiplier: 1.5,
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
      hpMultiplier: 14.2,
      speedMultiplier: 0.98,
      damageMultiplier: 2.62,
      guardSec: 6.8,
      guardDamageMultiplier: 0.32,
      radius: 26,
      regularEnemyCap: 13,
      behavior: 'frontline',
      preferredDistance: 176,
      strafeStrength: 0.18,
      escortBatch: 2,
      escortRespawnSec: 4.6,
      escortMax: 5,
      pressurePhases: [
        {
          id: 'close-in',
          label: '逼近',
          behaviorOverride: 'screened',
          signatureLabel: '逼近压线',
          signatureDurationSec: 2.8,
          signaturePulseIntervalSec: 1.35,
          signatureEscortBurst: 1,
          patternLabel: '纵压驱进',
          patternMode: 'laneCrush',
          patternPulseIntervalSec: 1.65,
          patternEscortBurst: 2,
          patternEscortArchetype: 'brute',
          patternSafeWindowSize: 224,
          patternSafeWindowLingerSec: 1.28,
          patternWallShotCount: 7,
          triggerHpRatio: 0.74,
          triggerRemainingSec: 24,
          minResidenceSec: 4.2,
          entryGuardSec: 1.2,
          entryGuardDamageMultiplier: 0.28,
          entryEscortBurst: 1,
          spawnIntervalMultiplier: 0.92,
          regularEnemyCapBonus: 1,
          escortRespawnMultiplier: 0.92,
          eliteSpeedMultiplier: 1.1,
          preferredDistanceDelta: -28,
        },
        {
          id: 'kill-window',
          label: '收束',
          behaviorOverride: 'frontline',
          triggerHpRatio: 0.38,
          triggerRemainingSec: 12,
          minResidenceSec: 4.6,
          entryGuardSec: 1.4,
          entryGuardDamageMultiplier: 0.24,
          entryEscortBurst: 2,
          spawnIntervalMultiplier: 0.84,
          regularEnemyCapBonus: 2,
          escortBatchBonus: 1,
          escortMaxBonus: 2,
          escortRespawnMultiplier: 0.78,
          eliteSpeedMultiplier: 1.2,
          preferredDistanceDelta: -54,
        },
      ],
    },
  },
  'boss-lockdown': {
    id: 'boss-lockdown',
    name: '锁域主核',
    description: '最终 Boss 会提早带着护卫压进来，把最后一段走位空间挤得更紧。',
    encounterType: 'boss',
    durationSec: 37,
    spawnIntervalSec: 0.94,
    enemyHp: 25,
    enemySpeed: 60,
    enemyDamage: 10,
    regularEnemyCap: 12,
    pressureMultiplier: 1.56,
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
      hpMultiplier: 13.6,
      speedMultiplier: 1,
      damageMultiplier: 2.58,
      guardSec: 6.2,
      guardDamageMultiplier: 0.34,
      radius: 26,
      regularEnemyCap: 14,
      behavior: 'kiting',
      preferredDistance: 204,
      strafeStrength: 0.36,
      escortBatch: 3,
      escortRespawnSec: 4.2,
      escortMax: 8,
      pressurePhases: [
        {
          id: 'pin-down',
          label: '封位',
          behaviorOverride: 'screened',
          signatureLabel: '护卫封位',
          signatureDurationSec: 3.2,
          signaturePulseIntervalSec: 1.25,
          signatureEscortBurst: 1,
          patternLabel: '侧翼夹封',
          patternMode: 'sideClamp',
          patternPulseIntervalSec: 1.45,
          patternEscortBurst: 2,
          patternEscortArchetype: 'skirmisher',
          patternSafeWindowSize: 162,
          patternSafeWindowLingerSec: 1.22,
          patternWallShotCount: 6,
          triggerHpRatio: 0.76,
          triggerRemainingSec: 24,
          minResidenceSec: 4.4,
          entryGuardSec: 1.3,
          entryGuardDamageMultiplier: 0.28,
          entryEscortBurst: 1,
          spawnIntervalMultiplier: 0.94,
          regularEnemyCapBonus: 1,
          escortBatchBonus: 1,
          escortMaxBonus: 2,
          escortRespawnMultiplier: 0.78,
          rangedShotIntervalMultiplier: 0.9,
        },
        {
          id: 'lockfield',
          label: '锁场',
          behaviorOverride: 'frontline',
          triggerHpRatio: 0.4,
          triggerRemainingSec: 11,
          minResidenceSec: 4.8,
          entryGuardSec: 1.5,
          entryGuardDamageMultiplier: 0.24,
          entryEscortBurst: 2,
          spawnIntervalMultiplier: 0.86,
          regularEnemyCapBonus: 2,
          escortBatchBonus: 1,
          escortMaxBonus: 3,
          escortRespawnMultiplier: 0.66,
          eliteSpeedMultiplier: 1.08,
          rangedShotIntervalMultiplier: 0.8,
        },
      ],
    },
  },
  'boss-bastion': {
    id: 'boss-bastion',
    name: '屏卫主核',
    description: '最终 Boss 会借护卫与远程火线拖长对局，让最终关不再只是普通 elite 变体。',
    encounterType: 'boss',
    durationSec: 39,
    spawnIntervalSec: 1.02,
    enemyHp: 27,
    enemySpeed: 56,
    enemyDamage: 10,
    regularEnemyCap: 12,
    pressureMultiplier: 1.54,
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
      hpMultiplier: 14,
      speedMultiplier: 0.9,
      damageMultiplier: 2.52,
      guardSec: 6.6,
      guardDamageMultiplier: 0.34,
      radius: 27,
      regularEnemyCap: 14,
      behavior: 'screened',
      preferredDistance: 214,
      strafeStrength: 0.26,
      escortBatch: 3,
      escortRespawnSec: 4.2,
      escortMax: 9,
      pressurePhases: [
        {
          id: 'crossfire',
          label: '交火',
          behaviorOverride: 'summoner',
          signatureLabel: '火线齐射',
          signatureDurationSec: 3.4,
          signaturePulseIntervalSec: 1.15,
          signatureVolleyCount: 3,
          patternLabel: '交叉火线',
          patternMode: 'crossfireWave',
          patternPulseIntervalSec: 1.52,
          patternVolleyCount: 1,
          patternVolleySpreadRad: 0.18,
          patternVolleyShotsPerShooter: 2,
          patternSafeWindowSize: 184,
          patternSafeWindowSecondarySize: 126,
          patternSafeWindowLingerSec: 1.16,
          patternPocketShiftModes: ['sweep', 'centerReset'],
          patternWallShotCount: 5,
          triggerHpRatio: 0.72,
          triggerRemainingSec: 25,
          minResidenceSec: 4.4,
          entryGuardSec: 1.2,
          entryGuardDamageMultiplier: 0.28,
          entryEscortBurst: 1,
          escortBatchBonus: 1,
          escortMaxBonus: 2,
          escortRespawnMultiplier: 0.82,
          rangedShotIntervalMultiplier: 0.78,
          rangedProjectileSpeedMultiplier: 1.1,
        },
        {
          id: 'fireline',
          label: '火线收束',
          behaviorOverride: 'kiting',
          patternLabel: '压边迁火',
          patternMode: 'crossfireWave',
          patternPulseIntervalSec: 1.08,
          patternVolleyCount: 1,
          patternVolleySpreadRad: 0.14,
          patternVolleyShotsPerShooter: 2,
          patternSafeWindowSize: 168,
          patternSafeWindowSecondarySize: 112,
          patternSafeWindowLingerSec: 0.98,
          patternPocketShiftModes: ['edgeBounce', 'centerReset'],
          patternWallShotCount: 6,
          triggerHpRatio: 0.48,
          triggerRemainingSec: 15,
          minResidenceSec: 4.2,
          entryGuardSec: 1.4,
          entryGuardDamageMultiplier: 0.24,
          entryEscortBurst: 2,
          spawnIntervalMultiplier: 0.9,
          regularEnemyCapBonus: 1,
          escortBatchBonus: 1,
          escortMaxBonus: 3,
          escortRespawnMultiplier: 0.68,
          rangedShotIntervalMultiplier: 0.64,
          rangedProjectileSpeedMultiplier: 1.18,
        },
      ],
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

export function getBattleActiveEliteBehavior(
  templateId: BattleTemplateId,
  pressurePhaseIndex = -1,
): EliteBehaviorId | null {
  const template = BATTLE_TEMPLATES[templateId];
  const pressurePhase =
    pressurePhaseIndex >= 0 ? template.eliteRule?.pressurePhases?.[pressurePhaseIndex] : undefined;
  return pressurePhase?.behaviorOverride ?? template.eliteRule?.behavior ?? null;
}

export function getBattleEnemyReadout(
  templateId: BattleTemplateId,
  pressurePhaseLabel?: string,
  emphasizeTransition = false,
  pressurePhaseIndex = -1,
  pressureSignatureLabel?: string,
  pressurePatternLabel?: string,
  pressureSafeWindowAxis?: PressureSafeWindowAxis,
  pressureSafeWindowShiftType?: PressurePocketShiftModeId,
): string {
  const template = BATTLE_TEMPLATES[templateId];
  const frontline = getTopArchetypeLabels(template.regularArchetypes, 2);
  const escort = getTopArchetypeLabels(template.escortArchetypes, 2);
  const activeBehavior = getBattleActiveEliteBehavior(templateId, pressurePhaseIndex);
  const parts: string[] = [];

  if (pressurePhaseLabel) {
    parts.push(`${emphasizeTransition ? '转段' : '阶段'} ${pressurePhaseLabel}`);
  }

  if (pressureSignatureLabel) {
    parts.push(`压迫 ${pressureSignatureLabel}`);
  }

  if (pressurePatternLabel) {
    parts.push(`模式 ${pressurePatternLabel}`);
  }

  if (pressureSafeWindowAxis) {
    parts.push(`安全窗 ${pressureSafeWindowAxis === 'vertical' ? '纵向' : '横向'}`);
  }

  if (pressureSafeWindowAxis === 'pocket') {
    parts[parts.length - 1] = `安全袋${pressureSafeWindowShiftType ? ` ${POCKET_SHIFT_READOUT_MAP[pressureSafeWindowShiftType]}` : ''}`;
  }

  if (activeBehavior) {
    parts.push(`主核 ${ELITE_BEHAVIOR_READOUT_MAP[activeBehavior]}`);
  }

  parts.push(`敌群 ${frontline.length > 0 ? frontline.join(' / ') : '普通怪'}`);
  parts.push(`节奏 ${getSpawnPatternReadout(template)}`);

  if (escort.length > 0) {
    parts.push(`护卫 ${escort.join(' / ')}`);
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
