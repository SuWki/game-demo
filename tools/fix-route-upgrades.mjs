#!/usr/bin/env node
/**
 * 修复路线牌价值过高问题
 *
 * 问题：路线牌除了给路线进度，还额外给了属性加成（critChance, pierce, dashPulseDamage等）
 * 解决方案：移除所有路线牌的stats modifiers，只保留route effect
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const upgradesPath = path.join(__dirname, '../src/data/upgrades.ts');
let content = fs.readFileSync(upgradesPath, 'utf-8');

console.log('开始修复路线牌价值过高问题...\n');

// 统计修改
let routeUpgradesFixed = 0;
let statsRemoved = 0;

// 正则匹配路线牌的effects块，移除stats modifiers
// 匹配模式：category: 'route' 后面的 effects: [...] 块
const routeUpgradePattern = /(id: '[^']+',\s+name: '[^']+',\s+description: '[^']+',\s+category: 'route',[\s\S]*?effects: \[)\s*\{[^}]*type: 'stats',[^}]*modifiers: \{[^}]+\}[^}]*\},\s*(\{[^}]*type: 'route')/g;

content = content.replace(routeUpgradePattern, (match, before, routeEffect) => {
  routeUpgradesFixed++;
  statsRemoved++;
  console.log(`移除路线牌的stats modifiers (第${routeUpgradesFixed}个)`);
  return `${before}\n      ${routeEffect}`;
});

console.log(`\n修复完成！`);
console.log(`- 修复路线牌数量: ${routeUpgradesFixed}`);
console.log(`- 移除stats块数量: ${statsRemoved}`);

// 写回文件
fs.writeFileSync(upgradesPath, content, 'utf-8');
console.log(`\n已保存到: ${upgradesPath}`);
