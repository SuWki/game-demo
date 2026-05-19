/**
 * 数据导出脚本
 * 将 TypeScript 数据文件导出为 JSON 格式到 public/data/
 * 
 * 使用方式: npx tsx scripts/export-data.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.resolve(ROOT_DIR, 'public', 'data');

// 确保输出目录存在
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * 将对象写入 JSON 文件
 */
function writeJson(filename, data) {
  const outputPath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`✓ 已导出 ${filename}`);
}

/**
 * 清理函数引用（JSON 不支持函数）
 */
function cleanForJson(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'function') return null;
  if (Array.isArray(obj)) return obj.map(cleanForJson);
  if (typeof obj === 'object') {
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      cleaned[key] = cleanForJson(value);
    }
    return cleaned;
  }
  return obj;
}

// ============================================================
// 导出 enemyArchetypes.json
// ============================================================
async function exportEnemyArchetypes() {
  console.log('\n--- 导出 enemyArchetypes.json ---');
  
  const { ENEMY_ARCHETYPES } = await import('../src/data/enemyArchetypes.ts');
  const archetypesArray = Object.values(ENEMY_ARCHETYPES).map(a => cleanForJson(a));
  
  writeJson('enemyArchetypes.json', archetypesArray);
  return archetypesArray;
}

// ============================================================
// 导出 battleTemplates.json
// ============================================================
async function exportBattleTemplates() {
  console.log('\n--- 导出 battleTemplates.json ---');
  
  const { BATTLE_TEMPLATES } = await import('../src/data/battleTemplates.ts');
  const templatesArray = Object.values(BATTLE_TEMPLATES).map(t => cleanForJson(t));
  
  writeJson('battleTemplates.json', templatesArray);
  return templatesArray;
}

// ============================================================
// 导出 upgrades.json
// ============================================================
async function exportUpgrades() {
  console.log('\n--- 导出 upgrades.json ---');
  
  const { UPGRADE_ARCHETYPES } = await import('../src/data/upgrades.ts');
  const upgradesArray = UPGRADE_ARCHETYPES.map(u => cleanForJson(u));
  
  writeJson('upgrades.json', upgradesArray);
  return upgradesArray;
}

// ============================================================
// 导出 balance.json（数值常量）
// ============================================================
async function exportBalance() {
  console.log('\n--- 导出 balance.json ---');
  
  const balanceModule = await import('../src/data/balance.ts');
  
  const balanceData = {
    VIEWPORT_WIDTH: balanceModule.VIEWPORT_WIDTH,
    VIEWPORT_HEIGHT: balanceModule.VIEWPORT_HEIGHT,
    ARENA_WIDTH: balanceModule.ARENA_WIDTH,
    ARENA_HEIGHT: balanceModule.ARENA_HEIGHT,
    PLAYER_BODY_RADIUS: balanceModule.PLAYER_BODY_RADIUS,
    PLAYER_COLLISION_RADIUS: balanceModule.PLAYER_COLLISION_RADIUS,
    UPGRADE_VALUE_BUCKET_THRESHOLDS: balanceModule.UPGRADE_VALUE_BUCKET_THRESHOLDS,
    RARITY_LABEL_MAP: balanceModule.RARITY_LABEL_MAP,
    RARITY_COLOR_MAP: balanceModule.RARITY_COLOR_MAP,
  };
  
  writeJson('balance.json', balanceData);
  return balanceData;
}

// ============================================================
// 主函数
// ============================================================
async function main() {
  console.log('=== 开始导出数据 ===');
  console.log(`输出目录: ${OUTPUT_DIR}`);
  
  try {
    await exportEnemyArchetypes();
    await exportBattleTemplates();
    await exportUpgrades();
    await exportBalance();
    
    console.log('\n=== 导出完成 ===');
    console.log('生成的文件:');
    fs.readdirSync(OUTPUT_DIR).forEach(file => {
      const stats = fs.statSync(path.join(OUTPUT_DIR, file));
      console.log(`  ${file} (${(stats.size / 1024).toFixed(1)} KB)`);
    });
  } catch (error) {
    console.error('导出失败:', error);
    process.exit(1);
  }
}

main();
