/**
 * 配置验证工具
 * 验证 JSON 配置文件的完整性和合理性
 * 
 * 使用方式: npx tsx tools/validate-configs.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.resolve(ROOT_DIR, 'public', 'data');

// 验证结果
interface ValidationResult {
  passed: boolean;
  warnings: string[];
  errors: string[];
}

// 加载 JSON 配置
function loadConfig<T>(filename: string): T {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`配置文件不存在: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

// ============================================================
// 升级验证
// ============================================================
function validateUpgrades(): ValidationResult {
  const result: ValidationResult = { passed: true, warnings: [], errors: [] };
  const upgrades = loadConfig<any[]>('upgrades.json');
  
  const validRouteIds = new Set(['crit', 'pierce', 'dash']);
  const validCategories = new Set(['generic', 'route']);
  const validRarities = new Set(['common', 'uncommon', 'rare', 'epic', 'legendary']);
  
  for (const upgrade of upgrades) {
    const id = upgrade.id || '未知';
    
    // 检查必需字段
    if (!upgrade.id) result.errors.push(`升级缺少 id 字段`);
    if (!upgrade.name) result.errors.push(`升级 ${id} 缺少 name`);
    if (!upgrade.description) result.warnings.push(`升级 ${id} 缺少 description`);
    if (!upgrade.category) result.errors.push(`升级 ${id} 缺少 category`);
    if (!upgrade.effects || upgrade.effects.length === 0) result.errors.push(`升级 ${id} 缺少 effects`);
    
    // 检查 category
    if (upgrade.category && !validCategories.has(upgrade.category)) {
      result.errors.push(`升级 ${id} 的 category 无效: ${upgrade.category}`);
    }
    
    // 检查 routeId
    if (upgrade.routeId && !validRouteIds.has(upgrade.routeId)) {
      result.errors.push(`升级 ${id} 的 routeId 无效: ${upgrade.routeId}`);
    }
    
    // 检查 rarity
    if (upgrade.rarity && !validRarities.has(upgrade.rarity)) {
      result.errors.push(`升级 ${id} 的 rarity 无效: ${upgrade.rarity}`);
    }
    
    // 检查 selection.baseWeight
    if (upgrade.selection) {
      if (upgrade.selection.baseWeight !== undefined) {
        if (upgrade.selection.baseWeight < 0) {
          result.errors.push(`升级 ${id} 的 baseWeight 不能为负数`);
        }
        if (upgrade.selection.baseWeight > 20) {
          result.warnings.push(`升级 ${id} 的 baseWeight 过高: ${upgrade.selection.baseWeight}`);
        }
      }
    }
    
    // 检查 effects 结构
    if (upgrade.effects) {
      for (let i = 0; i < upgrade.effects.length; i++) {
        const effect = upgrade.effects[i];
        if (!effect.type) {
          result.errors.push(`升级 ${id} 的 effects[${i}] 缺少 type`);
        }
        if (effect.type === 'stats' && !effect.modifiers) {
          result.errors.push(`升级 ${id} 的 effects[${i}] 缺少 modifiers`);
        }
        if (effect.type === 'heal' && effect.amount === undefined) {
          result.errors.push(`升级 ${id} 的 effects[${i}] 缺少 amount`);
        }
        if (effect.type === 'route' && !effect.routeId) {
          result.errors.push(`升级 ${id} 的 effects[${i}] 缺少 routeId`);
        }
      }
    }
  }
  
  result.passed = result.errors.length === 0;
  return result;
}

// ============================================================
// 战斗模板验证
// ============================================================
function validateBattleTemplates(): ValidationResult {
  const result: ValidationResult = { passed: true, warnings: [], errors: [] };
  const templates = loadConfig<any[]>('battleTemplates.json');
  
  const validWinConditionTypes = new Set(['kills', 'elite', 'survive']);
  const validSpawnPatterns = new Set(['surround', 'pincers', 'lanes']);
  const validEnemyArchetypes = new Set(['standard', 'brute', 'skirmisher', 'ranged']);
  
  for (const template of templates) {
    const id = template.id || '未知';
    
    // 检查必需字段
    if (!template.id) result.errors.push(`战斗模板缺少 id 字段`);
    if (!template.name) result.errors.push(`战斗模板 ${id} 缺少 name`);
    if (!template.description) result.warnings.push(`战斗模板 ${id} 缺少 description`);
    if (template.durationSec === undefined) result.errors.push(`战斗模板 ${id} 缺少 durationSec`);
    if (template.enemyHp === undefined) result.errors.push(`战斗模板 ${id} 缺少 enemyHp`);
    if (template.winCondition === undefined) result.errors.push(`战斗模板 ${id} 缺少 winCondition`);
    
    // 检查数值合理性
    if (template.durationSec !== undefined && template.durationSec <= 0) {
      result.errors.push(`战斗模板 ${id} 的 durationSec 必须大于 0`);
    }
    if (template.enemyHp !== undefined && template.enemyHp <= 0) {
      result.errors.push(`战斗模板 ${id} 的 enemyHp 必须大于 0`);
    }
    if (template.spawnIntervalSec !== undefined && template.spawnIntervalSec <= 0) {
      result.errors.push(`战斗模板 ${id} 的 spawnIntervalSec 必须大于 0`);
    }
    
    // 检查 winCondition
    if (template.winCondition) {
      if (!validWinConditionTypes.has(template.winCondition.type)) {
        result.errors.push(`战斗模板 ${id} 的 winCondition.type 无效: ${template.winCondition.type}`);
      }
      if (template.winCondition.type === 'kills' && template.winCondition.target === undefined) {
        result.warnings.push(`战斗模板 ${id} 的 winCondition 类型为 kills 但缺少 target`);
      }
    }
    
    // 检查 spawnRule
    if (template.spawnRule) {
      if (!validSpawnPatterns.has(template.spawnRule.pattern)) {
        result.errors.push(`战斗模板 ${id} 的 spawnRule.pattern 无效: ${template.spawnRule.pattern}`);
      }
    }
    
    // 检查 regularArchetypes
    if (template.regularArchetypes) {
      for (const [archetype, weight] of Object.entries(template.regularArchetypes)) {
        if (!validEnemyArchetypes.has(archetype)) {
          result.errors.push(`战斗模板 ${id} 的 regularArchetypes 包含无效的敌人类型: ${archetype}`);
        }
        if (typeof weight !== 'number' || weight < 0) {
          result.errors.push(`战斗模板 ${id} 的 regularArchetypes.${archetype} 权重无效`);
        }
      }
    }
    
    // 检查 eliteRule
    if (template.eliteRule) {
      if (template.eliteRule.spawnAtSec === undefined) {
        result.warnings.push(`战斗模板 ${id} 的 eliteRule 缺少 spawnAtSec`);
      }
      if (template.eliteRule.hpMultiplier !== undefined && template.eliteRule.hpMultiplier < 1) {
        result.warnings.push(`战斗模板 ${id} 的 eliteRule.hpMultiplier 小于 1`);
      }
    }
  }
  
  // 检查难度曲线
  const battleTemplates = templates.filter(t => !t.id?.startsWith('boss'));
  if (battleTemplates.length > 0) {
    const avgHp = battleTemplates.reduce((sum, t) => sum + (t.enemyHp || 0), 0) / battleTemplates.length;
    const avgDuration = battleTemplates.reduce((sum, t) => sum + (t.durationSec || 0), 0) / battleTemplates.length;
    
    if (avgHp > 100) {
      result.warnings.push(`战斗模板平均敌人血量较高: ${avgHp.toFixed(1)}`);
    }
    if (avgDuration > 60) {
      result.warnings.push(`战斗模板平均持续时间较长: ${avgDuration.toFixed(1)}秒`);
    }
  }
  
  result.passed = result.errors.length === 0;
  return result;
}

// ============================================================
// 敌人原型验证
// ============================================================
function validateEnemyArchetypes(): ValidationResult {
  const result: ValidationResult = { passed: true, warnings: [], errors: [] };
  const archetypes = loadConfig<any[]>('enemyArchetypes.json');
  
  for (const archetype of archetypes) {
    const id = archetype.id || '未知';
    
    // 检查必需字段
    if (!archetype.id) result.errors.push(`敌人原型缺少 id 字段`);
    if (!archetype.name) result.errors.push(`敌人原型 ${id} 缺少 name`);
    if (archetype.hpMultiplier === undefined) result.errors.push(`敌人原型 ${id} 缺少 hpMultiplier`);
    if (archetype.speedMultiplier === undefined) result.errors.push(`敌人原型 ${id} 缺少 speedMultiplier`);
    
    // 检查数值范围
    if (archetype.hpMultiplier !== undefined) {
      if (archetype.hpMultiplier < 0.1 || archetype.hpMultiplier > 10) {
        result.warnings.push(`敌人原型 ${id} 的 hpMultiplier 超出正常范围: ${archetype.hpMultiplier}`);
      }
    }
    if (archetype.speedMultiplier !== undefined) {
      if (archetype.speedMultiplier < 0.1 || archetype.speedMultiplier > 5) {
        result.warnings.push(`敌人原型 ${id} 的 speedMultiplier 超出正常范围: ${archetype.speedMultiplier}`);
      }
    }
    if (archetype.contactDamageMultiplier !== undefined) {
      if (archetype.contactDamageMultiplier < 0.1 || archetype.contactDamageMultiplier > 5) {
        result.warnings.push(`敌人原型 ${id} 的 contactDamageMultiplier 超出正常范围: ${archetype.contactDamageMultiplier}`);
      }
    }
    
    // 检查 ranged 敌人特殊字段
    if (id === 'ranged') {
      if (!archetype.shotIntervalSec) result.warnings.push(`ranged 敌人缺少 shotIntervalSec`);
      if (!archetype.projectileSpeed) result.warnings.push(`ranged 敌人缺少 projectileSpeed`);
      if (!archetype.projectileDamageMultiplier) result.warnings.push(`ranged 敌人缺少 projectileDamageMultiplier`);
    }
  }
  
  result.passed = result.errors.length === 0;
  return result;
}

// ============================================================
// 主函数
// ============================================================
async function main() {
  console.log('=== 配置验证工具 ===');
  console.log(`数据目录: ${DATA_DIR}\n`);
  
  const results: { name: string; result: ValidationResult }[] = [];
  
  // 验证升级
  try {
    const upgradeResult = validateUpgrades();
    results.push({ name: 'upgrades.json', result: upgradeResult });
  } catch (error) {
    results.push({ name: 'upgrades.json', result: { passed: false, warnings: [], errors: [String(error)] } });
  }
  
  // 验证战斗模板
  try {
    const battleResult = validateBattleTemplates();
    results.push({ name: 'battleTemplates.json', result: battleResult });
  } catch (error) {
    results.push({ name: 'battleTemplates.json', result: { passed: false, warnings: [], errors: [String(error)] } });
  }
  
  // 验证敌人原型
  try {
    const enemyResult = validateEnemyArchetypes();
    results.push({ name: 'enemyArchetypes.json', result: enemyResult });
  } catch (error) {
    results.push({ name: 'enemyArchetypes.json', result: { passed: false, warnings: [], errors: [String(error)] } });
  }
  
  // 输出结果
  console.log('验证结果:');
  console.log('─'.repeat(50));
  
  let totalErrors = 0;
  let totalWarnings = 0;
  
  for (const { name, result } of results) {
    const status = result.passed ? '✓ 通过' : '✗ 失败';
    const errorCount = result.errors.length;
    const warningCount = result.warnings.length;
    totalErrors += errorCount;
    totalWarnings += warningCount;
    
    console.log(`\n${status} ${name}`);
    if (errorCount > 0 || warningCount > 0) {
      console.log(`  错误: ${errorCount}, 警告: ${warningCount}`);
    }
    
    for (const error of result.errors) {
      console.log(`  ❌ ${error}`);
    }
    for (const warning of result.warnings) {
      console.log(`  ⚠️  ${warning}`);
    }
  }
  
  console.log('\n' + '─'.repeat(50));
  console.log(`总计: ${totalErrors} 个错误, ${totalWarnings} 个警告`);
  
  if (totalErrors === 0) {
    console.log('\n✓ 所有验证通过！');
    process.exit(0);
  } else {
    console.log(`\n✗ 验证失败，请修复 ${totalErrors} 个错误`);
    process.exit(1);
  }
}

main();
