#!/usr/bin/env node
/**
 * 路线强化价值审计脚本
 * 审计所有 route category (crit/pierce/dash) 的强化牌价值
 * 输出价值评估报告，标记超出预算的牌
 */

import { UPGRADE_ARCHETYPES, estimateUpgradeValue } from '../src/data/upgrades.js';
import { getUpgradeRarityMultiplier } from '../src/data/balance.js';

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
  dashPulseDamage: 1,     // dashPulseDamage +3 ≈ 1点
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

// 路线优先级定义
const ROUTE_PRIORITY = {
  crit: ['critChance', 'critMultiplier', 'fireRate', 'damage', 'projectileSpeed'],
  pierce: ['pierce', 'projectileSpeed', 'multishot', 'damage'],
  dash: ['dashInterval', 'dashInvulnerability', 'dashPulseDamage', 'moveSpeed'],
};

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

  // 检查是否堆叠多个高价值属性
  const highValueStats = ['pierce', 'multishot', 'critChance', 'critMultiplier', 'dashInterval'];
  const hasHighValue = highValueStats.filter(k => modifiers[k] && modifiers[k] !== 0);

  // 检查pierce牌是否同时有高额伤害和弹速
  if (routeId === 'pierce' && modifiers.pierce > 0) {
    const hasHighDamage = modifiers.damage && modifiers.damage >= 1.5;
    const hasHighSpeed = modifiers.projectileSpeed && modifiers.projectileSpeed >= 20;
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
    violations.push(`价值${manualValue.total}点，超出预算${budget}点`);
  }

  return violations;
}

function auditRouteUpgrades() {
  console.log('='.repeat(100));
  console.log('路线强化价值审计报告');
  console.log('='.repeat(100));
  console.log();

  // 筛选所有路线强化
  const routeUpgrades = UPGRADE_ARCHETYPES.filter(a => a.category === 'route');

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

      // 使用系统estimateUpgradeValue计算
      const systemValue = estimateUpgradeValue(upgrade.effects);

      const overBudget = parseFloat(manualValue.total) > budget;
      if (overBudget) totalOverBudget++;
      if (violations.length > 0) totalViolations++;

      // 输出结果
      console.log(`\n  [${rarity.toUpperCase()}] ${upgrade.name} (${upgrade.id})`);
      console.log(`  标签: ${(upgrade.tags || []).join(', ')}`);
      console.log(`  属性: ${Object.entries(modifiers).map(([k, v]) => `${k}: ${v}`).join(', ')}`);
      console.log(`  估算价值: ${manualValue.total}点 (预算: ${budget}点) ${overBudget ? '【超预算】' : ''}`);
      console.log(`  系统评分: ${systemValue.total} (DPS:${systemValue.directDps} 实用:${systemValue.utility} 生存:${systemValue.survival} 机动:${systemValue.mobility})`);

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
