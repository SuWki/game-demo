/**
 * 生成测试用的 Excel 文件
 * 用于验证配置编辑器功能
 */

import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = __dirname;

// 升级配置测试数据
const upgradesData = [
  {
    id: 'generic-firepower',
    name: '火控强化',
    description: '提升武器火力输出',
    category: 'generic',
    rarity: 'common',
    repeatable: true,
    'effects.0.type': 'stats',
    'effects.0.modifiers.damage': 3,
    'selection.baseWeight': 4
  },
  {
    id: 'crit-aim',
    name: '聚焦瞄准',
    description: '命中时概率触发高伤',
    category: 'route',
    routeId: 'crit',
    rarity: 'common',
    repeatable: false,
    'effects.0.type': 'stats',
    'effects.0.modifiers.critChance': 0.03,
    'selection.baseWeight': 6
  },
  {
    id: 'test-invalid',
    name: '',  // 错误：name 为空
    description: '这是一个无效测试数据',
    category: 'invalid',  // 错误：category 无效
    rarity: 'mythic',  // 错误：rarity 无效
    repeatable: true,
    'effects.0.type': 'stats',
    'effects.0.modifiers.damage': -5,  // 警告：负数伤害
    'selection.baseWeight': 25  // 警告：权重过高
  }
];

// 战斗模板测试数据
const battleTemplatesData = [
  {
    id: 'elimination',
    name: '歼灭',
    description: '消灭敌人',
    durationSec: 25,
    spawnIntervalSec: 0.74,
    enemyHp: 17,
    enemySpeed: 60,
    enemyDamage: 7,
    regularEnemyCap: 9,
    pressureMultiplier: 1.06,
    'winCondition.type': 'kills',
    'winCondition.target': 22,
    'spawnRule.pattern': 'surround',
    'spawnRule.burstCount': 1
  },
  {
    id: 'elite',
    name: '精英战',
    description: '击败精英敌人',
    durationSec: 45,
    spawnIntervalSec: 0.6,
    enemyHp: 25,
    enemySpeed: 65,
    enemyDamage: 9,
    regularEnemyCap: 12,
    pressureMultiplier: 1.2,
    'winCondition.type': 'elite',
    'spawnRule.pattern': 'surround',
    'spawnRule.burstCount': 2,
    'eliteRule.spawnAtSec': 4,
    'eliteRule.hpMultiplier': 9.8,
    'eliteRule.speedMultiplier': 1.02,
    'eliteRule.damageMultiplier': 2.35
  }
];

// 敌人原型测试数据
const enemyArchetypesData = [
  {
    id: 'standard',
    name: '普通怪',
    hpMultiplier: 1,
    speedMultiplier: 1,
    radiusMultiplier: 1,
    contactDamageMultiplier: 1,
    experienceMultiplier: 1
  },
  {
    id: 'brute',
    name: '厚血慢速大型怪',
    hpMultiplier: 1.85,
    speedMultiplier: 0.7,
    radiusMultiplier: 1.48,
    contactDamageMultiplier: 1.2,
    experienceMultiplier: 1.32
  },
  {
    id: 'skirmisher',
    name: '高速脆皮怪',
    hpMultiplier: 0.72,
    speedMultiplier: 1.28,
    radiusMultiplier: 0.88,
    contactDamageMultiplier: 0.92,
    experienceMultiplier: 0.95,
    strafeStrength: 0.34
  },
  {
    id: 'ranged',
    name: '远程怪',
    hpMultiplier: 0.82,
    speedMultiplier: 0.86,
    radiusMultiplier: 1.02,
    contactDamageMultiplier: 0.74,
    experienceMultiplier: 1.12,
    preferredDistance: 210,
    strafeStrength: 0.24,
    shotIntervalSec: 2.35,
    projectileSpeed: 220,
    projectileDamageMultiplier: 0.76,
    projectileRadius: 5
  }
];

function createExcel(filename, data) {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
  
  const outputPath = path.join(OUTPUT_DIR, filename);
  XLSX.writeFile(workbook, outputPath);
  
  console.log(`✓ 已创建 ${filename} (${data.length} 条记录)`);
}

console.log('=== 生成测试 Excel 文件 ===\n');

createExcel('test-upgrades.xlsx', upgradesData);
createExcel('test-battleTemplates.xlsx', battleTemplatesData);
createExcel('test-enemyArchetypes.xlsx', enemyArchetypesData);

console.log('\n=== 生成完成 ===');
console.log('测试文件已保存到 config-editor/ 目录');
console.log('可以将这些文件拖拽到配置编辑器中进行测试');
