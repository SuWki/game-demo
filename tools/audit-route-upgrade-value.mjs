#!/usr/bin/env node
/**
 * 路线强化价值审计脚本
 * 审计所有 route category (crit/pierce/dash) 的强化牌价值
 * 输出价值评估报告，标记超出预算的牌
 *
 * 运行方式: node tools/audit-route-upgrade-value.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const upgradesPath = path.join(__dirname, '../src/data/upgrades.ts');
const balancePath = path.join(__dirname, '../src/data/balance.ts');

// 价值评估基准（按任务给定）
const VALUE_REFERENCE = {
  damage: 1,              // damage +1 = 1点
  projectileSpeed: 1 / 25, // projectileSpeed +25 = 1点
  critChance: 1 / 0.025,   // critChance +0.025 = 1点
  critMultiplier: 1 / 0.15, // critMultiplier +0.15 = 1点
  pierce: 2.5,            // pierce +1 = 2.5点（机制属性，高价值）
  multishot: 4,           // multishot +1 = 4点（机制属性，高价值）
  dashInterval: 1 / 0.18,  // dashInterval -0.18s = 1点（注意是负值）
  dashInvulnerability: 1 / 0.08, // dashInvulnerability +0.08s = 1点
  dashPulseDamage: 0.33,  // dashPulseDamage +3 ≈ 1点
  moveSpeed: 1 / 10,      // moveSpeed +10 = 1点
  regeneration: 8,        // regeneration 按高价值处理（每0.1约8点）
  maxHp: 1 / 8,           // maxHp +8 = 1点
  fireRate: 1 / 0.15,     // fireRate +0.15 = 1点（注意：路线牌不应有fireRate）
};

// 同品质预算上限
const RARITY_BUDGET = {
  common: 5,
  uncommon: 7,
  rare: 10,
  epic: 14,
  legendary: 20,
};

// 路线核心属性定义（只保留这些）
const ROUTE_CORE_STATS = {
  crit: ['critChance', 'critMultiplier'],
  pierce: ['pierce', 'projectileSpeed'], // projectileSpeed 作为穿透的辅助
  dash: ['dashInterval', 'dashInvulnerability', 'dashPulseDamage'],
};

// 不应该出现在路线牌中的属性
const ROUTE_EXCLUDED_STATS = {
  crit: ['damage', 'fireRate', 'multishot', 'regeneration'],
  pierce: ['damage', 'critChance', 'critMultiplier', 'multishot', 'regeneration'],
  dash: ['damage', 'fireRate', 'critChance', 'critMultiplier', 'multishot', 'regeneration'],
};

function parseTypeScriptFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');

  // 简单解析：提取 UPGRADE_ARCHETYPES 数组
  const match = content.match(/export\s+const\s+UPGRADE_ARCHETYPES:\s*UpgradeArchetype\[\]\s*=\s*(\[[\s\S]*?\]);/);
  if (!match) {
    // 尝试另一种匹配方式
    const altMatch = content.match(/export\s+const\s+UPGRADE_ARCHETYPES\s*=\s*(\[[\s\S]*?\])\s+as\s+const/);
    if (!altMatch) {
      throw new Error(`无法解析 ${filePath} 中的 UPGRADE_ARCHETYPES`);
    }
  }

  // 手动提取对象定义
  const archetypes = [];
  const objectPattern = /\{\s*id:\s*['"]([^'"]+)['"][\s\S]*?\n\s*\}(?=,\s*\{|\s*\];)/g;
  let objectMatch;

  while ((objectMatch = objectPattern.exec(content)) !== null) {
    const objText = objectMatch[0];
    const id = objectMatch[1];

    // 提取基本属性
    const nameMatch = objText.match(/name:\s*['"]([^'"]+)['"]/);
    const categoryMatch = objText.match(/category:\s*['"]([^'"]+)['"]/);
    const routeIdMatch = objText.match(/routeId:\s*['"]([^'"]+)['"]/);
    const contentTierMatch = objText.match(/contentTier:\s*['"]([^'"]+)['"]/);
    const tagsMatch = objText.match(/tags:\s*\[([^\]]*)\]/);

    // 提取 effects
    const effects = [];
    const effectPattern = /\{\s*type:\s*['"]stats['"][\s\S]*?modifiers:\s*\{([^}]+)\}[\s\S]*?\}/g;
    let effectMatch;
    while ((effectMatch = effectPattern.exec(objText)) !== null) {
      const modifiersText = effectMatch[1];
      const modifiers = {};
      const modifierPattern = /(\w+):\s*([\d.]+)/g;
      let modMatch;
      while ((modMatch = modifierPattern.exec(modifiersText)) !== null) {
        modifiers[modMatch[1]] = parseFloat(modMatch[2]);
      }
      effects.push({ type: 'stats', modifiers });
    }

    archetypes.push({
      id,
      name: nameMatch ? nameMatch[1] : id,
      category: categoryMatch ? categoryMatch[1] : 'generic',
      routeId: routeIdMatch ? routeIdMatch[1] : undefined,
      contentTier: contentTierMatch ? contentTierMatch[1] : 'common',
      tags: tagsMatch ? tagsMatch[1].split(',').map(t => t.trim().replace(/['"]/g, '')).filter(Boolean) : [],
      effects,
    });
  }

  return archetypes;
}

function calculateManualValue(modifiers) {
  let total = 0;
  const details = [];

  for (const [key, value] of Object.entries(modifiers)) {
    if (value === 0 || value === undefined) continue;

    const ref = VALUE_REFERENCE[key];
    if (!ref) continue;

    let pointValue;
    if (key === 'dashInterval') {
      // dashInterval 是负值表示减少（好事）
      pointValue = Math.abs(value) * ref;
    } else {
      pointValue = value * ref;
    }

    total += pointValue;
    details.push({ key, value, pointValue: pointValue.toFixed(1) });
  }

  return { total: total.toFixed(1), details };
}

function getRarityFromArchetype(archetype) {
  if (archetype.contentTier) return archetype.contentTier;
  return 'common';
}

function checkViolations(archetype, modifiers, manualValue, budget) {
  const violations = [];
  const routeId = archetype.routeId;

  if (!routeId) return violations;

  // 检查是否包含不应该出现的属性
  const excludedStats = ROUTE_EXCLUDED_STATS[routeId] || [];
  for (const stat of excludedStats) {
    if (modifiers[stat] && modifiers[stat] !== 0) {
      violations.push(`${routeId}牌不应包含 '${stat}'（混入泛属性）`);
    }
  }

  // 检查pierce牌是否同时有高额伤害和弹速
  if (routeId === 'pierce' && modifiers.pierce > 0) {
    const hasHighDamage = modifiers.damage && modifiers.damage >= 1.5;
    const hasHighSpeed = modifiers.projectileSpeed && modifiers.projectileSpeed >= 25;
    if (hasHighDamage && hasHighSpeed) {
      violations.push('pierce牌不应同时有高额伤害和高额弹速');
    }
    if (hasHighDamage) {
      violations.push('pierce牌不应有高额伤害（应专注穿透机制）');
    }
  }

  // 检查crit牌是否混入过多泛用输出
  if (routeId === 'crit') {
    const hasCritChance = modifiers.critChance && modifiers.critChance > 0;
    const hasCritMultiplier = modifiers.critMultiplier && modifiers.critMultiplier > 0;
    const hasDamage = modifiers.damage && modifiers.damage > 0;
    const hasProjectileSpeed = modifiers.projectileSpeed && modifiers.projectileSpeed > 15;

    if (hasDamage && !hasCritChance && !hasCritMultiplier) {
      violations.push('crit牌不应只有伤害而无暴击属性');
    }
  }

  // 检查dash牌是否混入泛用射速/高额伤害
  if (routeId === 'dash') {
    const hasFireRate = modifiers.fireRate && modifiers.fireRate > 0;
    const hasHighDamage = modifiers.damage && modifiers.damage >= 2;

    if (hasFireRate) {
      violations.push('dash牌不应有fireRate（已删除）');
    }
    if (hasHighDamage) {
      violations.push('dash牌不应有高额伤害（应专注穿梭机制）');
    }
  }

  // 检查是否超出预算
  if (parseFloat(manualValue.total) > budget * 1.3) {
    violations.push(`价值${manualValue.total}点，超出预算${budget}点 30%以上`);
  } else if (parseFloat(manualValue.total) > budget * 1.15) {
    violations.push(`价值${manualValue.total}点，超出预算${budget}点 15%以上`);
  }

  return violations;
}

function auditRouteUpgrades() {
  console.log('='.repeat(100));
  console.log('路线强化价值审计报告');
  console.log('='.repeat(100));
  console.log();

  let archetypes;
  try {
    archetypes = parseTypeScriptFile(upgradesPath);
  } catch (error) {
    console.error('解析 upgrades.ts 失败:', error.message);
    process.exit(1);
  }

  // 筛选所有路线强化
  const routeUpgrades = archetypes.filter(a => a.category === 'route');

  if (routeUpgrades.length === 0) {
    console.log('未找到任何路线强化牌，请检查解析逻辑');
    return;
  }

  console.log(`成功解析 ${archetypes.length} 张牌，其中路线牌 ${routeUpgrades.length} 张`);
  console.log();

  // 按路线分组
  const byRoute = { crit: [], pierce: [], dash: [] };
  for (const upgrade of routeUpgrades) {
    if (byRoute[upgrade.routeId]) {
      byRoute[upgrade.routeId].push(upgrade);
    }
  }

  let totalViolations = 0;
  let totalOverBudget = 0;

  for (const [routeId, upgrades] of Object.entries(byRoute)) {
    console.log(`\n${'='.repeat(100)}`);
    console.log(`路线: ${routeId.toUpperCase()} (${upgrades.length} 张牌)`);
    console.log('='.repeat(100));

    for (const upgrade of upgrades) {
      const rarity = getRarityFromArchetype(upgrade);
      const budget = RARITY_BUDGET[rarity];

      // 提取属性修饰符
      const modifiers = {};
      for (const effect of upgrade.effects) {
        if (effect.type === 'stats') {
          Object.assign(modifiers, effect.modifiers);
        }
      }

      // 计算手动评估价值
      const manualValue = calculateManualValue(modifiers);

      // 检查违规
      const violations = checkViolations(upgrade, modifiers, manualValue, budget);

      const overBudget = parseFloat(manualValue.total) > budget;
      if (overBudget) totalOverBudget++;
      if (violations.length > 0) totalViolations++;

      // 输出结果
      console.log(`\n  [${rarity.toUpperCase()}] ${upgrade.name} (${upgrade.id})`);
      console.log(`  标签: ${(upgrade.tags || []).join(', ')}`);
      console.log(`  属性: ${Object.entries(modifiers).map(([k, v]) => `${k}: ${v}`).join(', ')}`);
      console.log(`  估算价值: ${manualValue.total}点 (预算: ${budget}点) ${overBudget ? '【超预算】' : ''}`);

      if (violations.length > 0) {
        console.log(`  ⚠️ 问题:`);
        for (const v of violations) {
          console.log(`     - ${v}`);
        }
      }
    }
  }

  console.log(`\n${'='.repeat(100)}`);
  console.log('审计总结');
  console.log('='.repeat(100));
  console.log(`  总路线牌数: ${routeUpgrades.length}`);
  console.log(`  超预算牌数: ${totalOverBudget}`);
  console.log(`  有违规牌数: ${totalViolations}`);
  console.log(`  健康度: ${((1 - totalViolations / routeUpgrades.length) * 100).toFixed(1)}%`);
  console.log();

  // 输出需要修正的牌列表
  console.log('\n需要重点修正的路线牌：');
  console.log('-'.repeat(100));

  for (const [routeId, upgrades] of Object.entries(byRoute)) {
    for (const upgrade of upgrades) {
      const rarity = getRarityFromArchetype(upgrade);
      const budget = RARITY_BUDGET[rarity];

      const modifiers = {};
      for (const effect of upgrade.effects) {
        if (effect.type === 'stats') {
          Object.assign(modifiers, effect.modifiers);
        }
      }

      const manualValue = calculateManualValue(modifiers);
      const violations = checkViolations(upgrade, modifiers, manualValue, budget);

      if (violations.length > 0 || parseFloat(manualValue.total) > budget * 1.2) {
        console.log(`\n  ${upgrade.id} (${upgrade.name})`);
        console.log(`    路线: ${routeId}, 品质: ${rarity}`);
        console.log(`    当前属性:`, JSON.stringify(modifiers));
        console.log(`    问题:`);
        if (violations.length === 0 && parseFloat(manualValue.total) > budget * 1.2) {
          console.log(`      - 价值${manualValue.total}点，建议压缩到${budget}点以内`);
        }
        for (const v of violations) {
          console.log(`      - ${v}`);
        }
      }
    }
  }

  console.log('\n' + '='.repeat(100));
  console.log('审计完成');
  console.log('='.repeat(100));
}

auditRouteUpgrades();
