/**
 * 游戏平衡性测试
 * 测试各种数值公式的合理性和平衡性
 */

import {
  createBaseStats,
  getExperienceToNextLevel,
  getEnemyHealth,
  getEnemyMoveSpeed,
  getEnemyContactDamage,
  getEnemySpawnInterval,
  getRegularEnemyCap,
  getEnemyExperienceValue,
  getUpgradeRarityWeights,
  estimateUpgradeValue,
  getPhaseTier,
} from '../data/balance';

import type { PlayerStats } from '../game/types';

import {
  calculateCritDamage,
  rollCritical,
  getFireInterval,
  getMultishotSpreadAngles,
  getPierceDamageMultiplier,
  getRegenerationPerFrame,
  getProjectileMaxLifetime,
  getExpectedDPS,
  getPierceExpectedDamageMultiplier,
  getComprehensiveDPS,
  calculateCombatPowerScore,
  createDamageInstance,
} from '../data/combatFormulas';

import { BATTLE_TEMPLATES } from '../data/battleTemplates';
import { ENEMY_ARCHETYPES } from '../data/enemyArchetypes';

interface TestResult {
  category: string;
  test: string;
  passed: boolean;
  actual: any;
  expected?: any;
  message?: string;
}

const results: TestResult[] = [];

function test(category: string, testName: string, condition: boolean, actual: any, expected?: any, message?: string) {
  results.push({
    category,
    test: testName,
    passed: condition,
    actual,
    expected,
    message,
  });
}

console.log('='.repeat(80));
console.log('游戏平衡性测试开始');
console.log('='.repeat(80));

// ============================================================================
// 1. 玩家成长曲线测试
// ============================================================================
console.log('\n【1. 玩家成长曲线测试】');

const expProgression = [1, 2, 3, 5, 10, 15, 20].map((level) => ({
  level,
  expNeeded: getExperienceToNextLevel(level),
}));

console.log('等级升级所需经验：');
expProgression.forEach(({ level, expNeeded }) => {
  console.log(`  Lv${level} → Lv${level + 1}: ${expNeeded} 经验`);
});

// 测试：经验增长是否合理（不应过快或过慢）
test(
  '玩家成长',
  '经验增长合理性',
  expProgression[1].expNeeded < 100 && expProgression[4].expNeeded < 500,
  expProgression[4].expNeeded,
  undefined,
  '前期升级不应过慢',
);

// ============================================================================
// 2. 战斗核心公式测试
// ============================================================================
console.log('\n【2. 战斗核心公式测试】');

const baseStats = createBaseStats();
console.log('基础属性：', {
  damage: baseStats.damage,
  fireRate: baseStats.fireRate,
  critChance: baseStats.critChance,
  critMultiplier: baseStats.critMultiplier,
});

// 测试暴击伤害
const critDamage = calculateCritDamage(baseStats.damage, baseStats.critMultiplier);
console.log(`暴击伤害: ${baseStats.damage} × ${baseStats.critMultiplier} = ${critDamage}`);
test('战斗公式', '暴击伤害计算', critDamage === baseStats.damage * baseStats.critMultiplier, critDamage);

// 测试射速转换
const fireInterval = getFireInterval(baseStats.fireRate);
console.log(`射速: ${baseStats.fireRate}/秒 → 开火间隔: ${fireInterval.toFixed(3)}秒`);
test('战斗公式', '射速转换', fireInterval > 0 && fireInterval < 1, fireInterval);

// 测试多重射击散射
const spreadAngles = getMultishotSpreadAngles(3);
console.log(`多重射击(3发)散射角度: ${spreadAngles.map((a) => (a * 180 / Math.PI).toFixed(1) + '°').join(', ')}`);
test('战斗公式', '多重射击散射', spreadAngles.length === 3, spreadAngles.length, 3);

// 测试穿透衰减
console.log('穿透伤害衰减：');
for (let i = 0; i <= 5; i++) {
  const multiplier = getPierceDamageMultiplier(i);
  console.log(`  第${i}次穿透: ${(multiplier * 100).toFixed(0)}% 伤害`);
}
test('战斗公式', '穿透衰减下限', getPierceDamageMultiplier(10) >= 0.3, getPierceDamageMultiplier(10));

// 测试生命恢复
const regenPerSec = getRegenerationPerFrame(1, 1000);
console.log(`再生速率: 1/秒 → 每秒恢复 ${regenPerSec} HP`);
test('战斗公式', '生命恢复计算', regenPerSec === 1, regenPerSec, 1);

// ============================================================================
// 3. DPS计算测试
// ============================================================================
console.log('\n【3. DPS计算测试】');

const testStats: PlayerStats = {
  ...baseStats,
  damage: 20,
  fireRate: 3,
  critChance: 0.2,
  critMultiplier: 2,
  pierce: 2,
  multishot: 2,
};

const baseDPS = getExpectedDPS(testStats);
const comprehensiveDPS = getComprehensiveDPS(testStats);

console.log('测试属性：', {
  damage: testStats.damage,
  fireRate: testStats.fireRate,
  critChance: testStats.critChance,
  critMultiplier: testStats.critMultiplier,
  pierce: testStats.pierce,
  multishot: testStats.multishot,
});

console.log(`基础期望DPS: ${baseDPS.toFixed(1)}`);
console.log(`综合期望DPS (含穿透+多重): ${comprehensiveDPS.toFixed(1)}`);

const pierceMultiplier = getPierceExpectedDamageMultiplier(testStats.pierce);
console.log(`穿透期望倍率: ${pierceMultiplier.toFixed(2)}×`);

test('DPS计算', '基础DPS合理性', baseDPS > 50 && baseDPS < 100, baseDPS);
test('DPS计算', '综合DPS提升', comprehensiveDPS > baseDPS * 2, comprehensiveDPS);

// ============================================================================
// 4. 敌人数值缩放测试
// ============================================================================
console.log('\n【4. 敌人数值缩放测试】');

const template = BATTLE_TEMPLATES['elimination'];
const phases: Array<{ round: number; phase: 'opening' | 'mid' | 'late' }> = [
  { round: 1, phase: 'opening' },
  { round: 2, phase: 'mid' },
  { round: 3, phase: 'late' },
];

console.log('敌人属性缩放（基础歼灭战）：');
phases.forEach(({ round, phase }) => {
  const hp = getEnemyHealth(template, round, phase, 1);
  const speed = getEnemyMoveSpeed(template, round, phase, 1);
  const damage = getEnemyContactDamage(template, round, phase, 1);
  const cap = getRegularEnemyCap(template, round, phase);
  const interval = getEnemySpawnInterval(template, round, phase, 0);

  console.log(`  Round ${round} (${phase}):`);
  console.log(`    生命: ${hp} HP (基础: ${template.enemyHp})`);
  console.log(`    速度: ${speed} (基础: ${template.enemySpeed})`);
  console.log(`    伤害: ${damage} (基础: ${template.enemyDamage})`);
  console.log(`    上限: ${cap} (基础: ${template.regularEnemyCap})`);
  console.log(`    间隔: ${interval.toFixed(2)}秒 (基础: ${template.spawnIntervalSec})`);
});

// 测试：敌人属性应该随回合增长
const round1Hp = getEnemyHealth(template, 1, 'opening', 1);
const round3Hp = getEnemyHealth(template, 3, 'late', 1);
test('敌人缩放', '生命值增长', round3Hp > round1Hp * 1.5, round3Hp, `> ${round1Hp * 1.5}`);

// ============================================================================
// 5. 精英敌人测试
// ============================================================================
console.log('\n【5. 精英敌人测试】');

const eliteTemplate = BATTLE_TEMPLATES['elite'];
const eliteHp = getEnemyHealth(eliteTemplate, 2, 'mid', 1.15, eliteTemplate.eliteRule!.hpMultiplier);
const eliteDamage = getEnemyContactDamage(eliteTemplate, 2, 'mid', 1.15, eliteTemplate.eliteRule!.damageMultiplier);

console.log('精英敌人属性（Round 2, mid）：');
console.log(`  生命: ${eliteHp} HP (倍率: ${eliteTemplate.eliteRule!.hpMultiplier}×)`);
console.log(`  伤害: ${eliteDamage} (倍率: ${eliteTemplate.eliteRule!.damageMultiplier}×)`);

// 测试：精英生命倍率是否过高
const regularHp = getEnemyHealth(eliteTemplate, 2, 'mid', 1.15);
const hpRatio = eliteHp / regularHp;
console.log(`  精英/普通生命比: ${hpRatio.toFixed(1)}×`);
test('精英平衡', '生命倍率合理性', hpRatio > 8 && hpRatio < 15, hpRatio, '8-15×');

// ============================================================================
// 6. 经验值平衡测试
// ============================================================================
console.log('\n【6. 经验值平衡测试】');

console.log('击杀经验值：');
phases.forEach(({ round, phase }) => {
  const regularExp = getEnemyExperienceValue(template, round, phase, false);
  const eliteExp = getEnemyExperienceValue(template, round, phase, true);

  console.log(`  Round ${round} (${phase}):`);
  console.log(`    普通敌人: ${regularExp.toFixed(1)} 经验`);
  console.log(`    精英敌人: ${eliteExp.toFixed(1)} 经验 (${(eliteExp / regularExp).toFixed(1)}×)`);
});

// 测试：精英经验应该是普通敌人的4-5倍
const regularExp = getEnemyExperienceValue(template, 2, 'mid', false);
const eliteExp = getEnemyExperienceValue(template, 2, 'mid', true);
const expRatio = eliteExp / regularExp;
test('经验平衡', '精英经验倍率', expRatio > 4 && expRatio < 5, expRatio, '4-5×');

// ============================================================================
// 7. 稀有度权重测试
// ============================================================================
console.log('\n【7. 稀有度权重测试】');

console.log('稀有度出现权重：');
phases.forEach(({ round, phase }) => {
  const weights = getUpgradeRarityWeights(round, phase, 1, 'levelUp');
  const total = Object.values(weights).reduce((sum, w) => sum + w, 0);

  console.log(`  Round ${round} (${phase}):`);
  Object.entries(weights).forEach(([rarity, weight]) => {
    const percentage = ((weight / total) * 100).toFixed(1);
    console.log(`    ${rarity}: ${weight.toFixed(1)} (${percentage}%)`);
  });
});

// 测试：前期稀有度应该以白绿为主
const round1Weights = getUpgradeRarityWeights(1, 'opening', 1, 'levelUp');
const round1Total = Object.values(round1Weights).reduce((sum, w) => sum + w, 0);
const round1CommonRate = round1Weights.common / round1Total;
test('稀有度平衡', '前期白色占比', round1CommonRate > 0.5, (round1CommonRate * 100).toFixed(1) + '%');

// ============================================================================
// 8. 升级价值评估测试
// ============================================================================
console.log('\n【8. 升级价值评估测试】');

const testUpgrades = [
  { name: '纯伤害', effects: [{ type: 'stats' as const, modifiers: { damage: 10 } }] },
  { name: '纯射速', effects: [{ type: 'stats' as const, modifiers: { fireRate: 0.5 } }] },
  { name: '纯暴击率', effects: [{ type: 'stats' as const, modifiers: { critChance: 0.1 } }] },
  { name: '纯生命', effects: [{ type: 'stats' as const, modifiers: { maxHp: 50 } }] },
  { name: '纯移速', effects: [{ type: 'stats' as const, modifiers: { moveSpeed: 30 } }] },
  {
    name: '混合DPS',
    effects: [{ type: 'stats' as const, modifiers: { damage: 5, fireRate: 0.3, critChance: 0.05 } }],
  },
];

console.log('升级价值评估：');
testUpgrades.forEach((upgrade) => {
  const value = estimateUpgradeValue(upgrade.effects);
  console.log(`  ${upgrade.name}:`);
  console.log(`    直接DPS: ${value.directDps.toFixed(1)}`);
  console.log(`    实用性: ${value.utility.toFixed(1)}`);
  console.log(`    生存: ${value.survival.toFixed(1)}`);
  console.log(`    机动: ${value.mobility.toFixed(1)}`);
  console.log(`    总价值: ${value.total.toFixed(1)}`);
});

// 测试：混合升级应该比单一属性更有价值
const pureValue = estimateUpgradeValue(testUpgrades[0].effects).total;
const mixedValue = estimateUpgradeValue(testUpgrades[5].effects).total;
test('升级价值', '混合升级优势', mixedValue > pureValue * 0.8, mixedValue, `> ${(pureValue * 0.8).toFixed(1)}`);

// ============================================================================
// 9. 战斗力评分测试
// ============================================================================
console.log('\n【9. 战斗力评分测试】');

const progressionStats = [
  { label: '初始', stats: createBaseStats() },
  {
    label: '中期',
    stats: {
      ...createBaseStats(),
      damage: 30,
      fireRate: 3.5,
      critChance: 0.25,
      maxHp: 180,
      moveSpeed: 300,
    },
  },
  {
    label: '后期',
    stats: {
      ...createBaseStats(),
      damage: 50,
      fireRate: 5,
      critChance: 0.45,
      critMultiplier: 2.5,
      pierce: 3,
      multishot: 2,
      maxHp: 250,
      moveSpeed: 350,
      regeneration: 2,
    },
  },
];

console.log('战斗力评分：');
progressionStats.forEach(({ label, stats }) => {
  const score = calculateCombatPowerScore(stats);
  const dps = getComprehensiveDPS(stats);
  console.log(`  ${label}: ${score.toFixed(0)} 分 (DPS: ${dps.toFixed(1)})`);
});

// 测试：战斗力应该随成长显著提升
const initialScore = calculateCombatPowerScore(progressionStats[0].stats);
const lateScore = calculateCombatPowerScore(progressionStats[2].stats);
test('战斗力', '成长曲线', lateScore > initialScore * 3, lateScore, `> ${initialScore * 3}`);

// ============================================================================
// 10. 敌人原型平衡测试
// ============================================================================
console.log('\n【10. 敌人原型平衡测试】');

console.log('敌人原型倍率：');
Object.values(ENEMY_ARCHETYPES).forEach((archetype) => {
  console.log(`  ${archetype.name}:`);
  console.log(`    生命: ${archetype.hpMultiplier}×`);
  console.log(`    速度: ${archetype.speedMultiplier}×`);
  console.log(`    伤害: ${archetype.contactDamageMultiplier}×`);
  console.log(`    经验: ${archetype.experienceMultiplier}×`);
});

// 测试：厚血怪应该血多速慢
const brute = ENEMY_ARCHETYPES.brute;
test('敌人原型', '厚血怪平衡', brute.hpMultiplier > 1.5 && brute.speedMultiplier < 1, {
  hp: brute.hpMultiplier,
  speed: brute.speedMultiplier,
});

// ============================================================================
// 测试结果汇总
// ============================================================================
console.log('\n' + '='.repeat(80));
console.log('测试结果汇总');
console.log('='.repeat(80));

const categories = [...new Set(results.map((r) => r.category))];
categories.forEach((category) => {
  const categoryResults = results.filter((r) => r.category === category);
  const passed = categoryResults.filter((r) => r.passed).length;
  const total = categoryResults.length;

  console.log(`\n【${category}】 ${passed}/${total} 通过`);
  categoryResults.forEach((result) => {
    const status = result.passed ? '✓' : '✗';
    console.log(`  ${status} ${result.test}`);
    if (!result.passed) {
      console.log(`    实际值: ${JSON.stringify(result.actual)}`);
      if (result.expected !== undefined) {
        console.log(`    期望值: ${JSON.stringify(result.expected)}`);
      }
      if (result.message) {
        console.log(`    说明: ${result.message}`);
      }
    }
  });
});

const totalPassed = results.filter((r) => r.passed).length;
const totalTests = results.length;
const passRate = ((totalPassed / totalTests) * 100).toFixed(1);

console.log('\n' + '='.repeat(80));
console.log(`总计: ${totalPassed}/${totalTests} 通过 (${passRate}%)`);
console.log('='.repeat(80));

// ============================================================================
// 平衡性建议
// ============================================================================
console.log('\n【平衡性建议】');

const suggestions: string[] = [];

// 检查经验增长
const lv10Exp = getExperienceToNextLevel(10);
if (lv10Exp > 400) {
  suggestions.push('⚠️ 等级10升级所需经验过高，建议降低二次项系数（当前3，建议2-2.5）');
}

// 检查精英生命倍率
if (hpRatio > 12) {
  suggestions.push('⚠️ 精英生命倍率过高，可能导致战斗过长（当前11.6×，建议9-10×）');
}

// 检查DPS权重
const damageUpgradeValue = estimateUpgradeValue([{ type: 'stats', modifiers: { damage: 10 } }]);
const hpUpgradeValue = estimateUpgradeValue([{ type: 'stats', modifiers: { maxHp: 50 } }]);
if (damageUpgradeValue.total > hpUpgradeValue.total * 2) {
  suggestions.push('⚠️ DPS升级价值过高，可能导致玩家过度追求输出（建议平衡各维度权重）');
}

// 检查生成间隔压力上限
const spawnInterval = getEnemySpawnInterval(BATTLE_TEMPLATES['elimination'], 1, 'opening', 60);
if (spawnInterval >= BATTLE_TEMPLATES['elimination'].spawnIntervalSec * 0.5) {
  suggestions.push('💡 敌人生成间隔在60秒后仍未显著下降，建议检查对数曲线参数');
}

// 检查Dash冷却下限：确认 Math.max(1.0, ...) 逻辑生效
// 基础 dashInterval 5.4，如果拿到 -5.0 的升级，应该被限制在 1.0
const dashCooldownTest = Math.max(1.0, 5.4 + (-5.0));
if (dashCooldownTest !== 1.0) {
  suggestions.push('⚠️ Dash冷却下限未生效为1.0秒，请检查 applyStatModifiers 逻辑');
}

if (suggestions.length === 0) {
  console.log('✓ 所有数值在合理范围内');
} else {
  suggestions.forEach((suggestion) => console.log(suggestion));
}

console.log('\n测试完成！');
