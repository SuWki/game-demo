/**
 * 批量提升异常事件的属性奖励
 * 将异常事件的属性数值提升到普通强化的1.3-1.5倍
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const eventsPath = path.join(__dirname, '../src/data/events.ts');
let content = fs.readFileSync(eventsPath, 'utf-8');

// 提升系数：1.4倍（介于1.3-1.5之间）
const BOOST_FACTOR = 1.4;

// 需要提升的属性及其精度
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
let inAnomalyEvent = false;
let anomalyDepth = 0;
let currentEventId = '';

// 逐行处理
const lines = content.split('\n');
const newLines = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // 检测是否进入异常事件
  if (line.includes("contentKind: 'anomaly'")) {
    inAnomalyEvent = true;
    anomalyDepth = 0;
    // 向上查找事件ID
    for (let j = i - 1; j >= 0; j--) {
      const idMatch = lines[j].match(/id: '([^']+)'/);
      if (idMatch) {
        currentEventId = idMatch[1];
        break;
      }
    }
    newLines.push(line);
    continue;
  }

  // 跟踪大括号深度
  if (inAnomalyEvent) {
    const openBraces = (line.match(/{/g) || []).length;
    const closeBraces = (line.match(/}/g) || []).length;
    anomalyDepth += openBraces - closeBraces;

    // 如果回到顶层，说明异常事件结束
    if (anomalyDepth <= 0 && line.includes('},')) {
      inAnomalyEvent = false;
      currentEventId = '';
    }
  }

  // 如果在异常事件内，提升属性数值（只提升正值，不提升负值）
  if (inAnomalyEvent) {
    let modifiedLine = line;

    for (const stat of STAT_PATTERNS) {
      // 只匹配正值
      const regex = new RegExp(`(${stat.name}:\\s*)(\\d+\\.?\\d*)`, 'g');
      modifiedLine = modifiedLine.replace(regex, (match, prefix, value) => {
        const oldValue = parseFloat(value);

        // 只提升正值
        if (oldValue > 0) {
          const newValue = oldValue * BOOST_FACTOR;
          const roundedValue = stat.precision === 0
            ? Math.round(newValue)
            : parseFloat(newValue.toFixed(stat.precision));

          if (oldValue !== roundedValue) {
            changeCount++;
            console.log(`  [${currentEventId}] ${stat.name}: ${oldValue} → ${roundedValue}`);
          }

          return prefix + roundedValue;
        }

        return match;
      });
    }

    newLines.push(modifiedLine);
  } else {
    newLines.push(line);
  }
}

// 写回文件
fs.writeFileSync(eventsPath, newLines.join('\n'), 'utf-8');

console.log(`\n✓ 完成异常事件属性奖励提升`);
console.log(`  总共修改了 ${changeCount} 个属性值`);
console.log(`  提升系数: ${BOOST_FACTOR}x`);
