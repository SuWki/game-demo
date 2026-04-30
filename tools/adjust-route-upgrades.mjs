/**
 * 批量调整路线强化的属性数值
 * 降低约25%，使升级速度减缓
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const upgradesPath = path.join(__dirname, '../src/data/upgrades.ts');
let content = fs.readFileSync(upgradesPath, 'utf-8');

// 调整系数
const REDUCTION_FACTOR = 0.75;

// 需要调整的属性及其精度
const STAT_PATTERNS = [
  { name: 'damage', precision: 1 },
  { name: 'fireRate', precision: 2 },
  { name: 'maxHp', precision: 0 },
  { name: 'regeneration', precision: 2 },
  { name: 'moveSpeed', precision: 0 },
  { name: 'projectileSpeed', precision: 0 },
  { name: 'critChance', precision: 3 },
  { name: 'critMultiplier', precision: 2 },
  { name: 'multishot', precision: 0 },
  { name: 'pierce', precision: 0 },
];

let changeCount = 0;
let inRouteUpgrade = false;
let routeUpgradeDepth = 0;

// 逐行处理
const lines = content.split('\n');
const newLines = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // 检测是否进入路线强化
  if (line.includes("category: 'route'")) {
    inRouteUpgrade = true;
    routeUpgradeDepth = 0;
    newLines.push(line);
    continue;
  }

  // 跟踪大括号深度
  if (inRouteUpgrade) {
    const openBraces = (line.match(/{/g) || []).length;
    const closeBraces = (line.match(/}/g) || []).length;
    routeUpgradeDepth += openBraces - closeBraces;

    // 如果回到顶层，说明路线强化结束
    if (routeUpgradeDepth <= 0 && line.includes('},')) {
      inRouteUpgrade = false;
    }
  }

  // 如果在路线强化内，调整属性数值
  if (inRouteUpgrade) {
    let modifiedLine = line;

    for (const stat of STAT_PATTERNS) {
      const regex = new RegExp(`(${stat.name}:\\s*)(-?\\d+\\.?\\d*)`, 'g');
      modifiedLine = modifiedLine.replace(regex, (match, prefix, value) => {
        const oldValue = parseFloat(value);
        const newValue = oldValue * REDUCTION_FACTOR;
        const roundedValue = stat.precision === 0
          ? Math.round(newValue)
          : parseFloat(newValue.toFixed(stat.precision));

        if (oldValue !== roundedValue) {
          changeCount++;
          console.log(`  ${stat.name}: ${oldValue} → ${roundedValue}`);
        }

        return prefix + roundedValue;
      });
    }

    newLines.push(modifiedLine);
  } else {
    newLines.push(line);
  }
}

// 写回文件
fs.writeFileSync(upgradesPath, newLines.join('\n'), 'utf-8');

console.log(`\n✓ 完成路线强化数值调整`);
console.log(`  总共修改了 ${changeCount} 个属性值`);
