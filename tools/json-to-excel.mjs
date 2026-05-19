/**
 * JSON 转 Excel 导出工具
 * 将 JSON 数据文件导出为 Excel 格式到 tools/templates/
 * 
 * 使用方式: node tools/json-to-excel.mjs <json文件路径>
 * 示例: node tools/json-to-excel.mjs public/data/upgrades.json
 */

import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.resolve(ROOT_DIR, 'tools', 'templates');

// 确保输出目录存在
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * 将嵌套对象展平为点号分隔的键
 * 例如: { effects: [{ type: 'stats' }] } -> { 'effects.0.type': 'stats' }
 */
function flattenObject(obj, prefix = '') {
  const result = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        if (typeof value[i] === 'object' && value[i] !== null) {
          Object.assign(result, flattenObject(value[i], `${newKey}.${i}`));
        } else {
          result[`${newKey}.${i}`] = value[i];
        }
      }
    } else if (typeof value === 'object' && value !== null) {
      Object.assign(result, flattenObject(value, newKey));
    } else {
      result[newKey] = value;
    }
  }
  
  return result;
}

/**
 * 将 JSON 数据导出为 Excel
 */
function exportJSONToExcel(jsonPath) {
  console.log(`\n--- 导出 ${path.basename(jsonPath)} ---`);
  
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  
  if (!Array.isArray(data)) {
    console.error('错误: JSON 数据必须是数组格式');
    process.exit(1);
  }
  
  // 展平所有对象
  const flattenedData = data.map(item => flattenObject(item));
  
  // 收集所有列名
  const allKeys = new Set();
  for (const item of flattenedData) {
    for (const key of Object.keys(item)) {
      allKeys.add(key);
    }
  }
  
  // 排序列名
  const sortedKeys = Array.from(allKeys).sort();
  
  // 创建工作表
  const worksheet = XLSX.utils.json_to_sheet(flattenedData, { header: sortedKeys });
  
  // 设置列宽
  const colWidths = sortedKeys.map(key => {
    const maxLen = Math.max(
      key.length,
      ...flattenedData.map(item => String(item[key] ?? '').length)
    );
    return { wch: Math.min(maxLen + 2, 50) };
  });
  worksheet['!cols'] = colWidths;
  
  // 导出 Excel
  const baseName = path.basename(jsonPath, '.json');
  const outputPath = path.join(OUTPUT_DIR, `${baseName}.xlsx`);
  
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, baseName);
  XLSX.writeFile(workbook, outputPath);
  
  console.log(`✓ ${baseName}.xlsx (${data.length} 条记录, ${sortedKeys.length} 列)`);
}

/**
 * 主函数
 */
function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('用法: node tools/json-to-excel.mjs <json文件路径>');
    console.log('示例: node tools/json-to-excel.mjs public/data/upgrades.json');
    console.log('\n说明:');
    console.log('  - JSON 数据必须是数组格式');
    console.log('  - 嵌套对象会被展平为点号分隔的列名');
    console.log('  - 输出文件保存到 tools/templates/ 目录');
    process.exit(0);
  }
  
  for (const jsonPath of args) {
    const fullPath = path.resolve(jsonPath);
    
    if (!fs.existsSync(fullPath)) {
      console.error(`错误: 文件不存在 ${fullPath}`);
      process.exit(1);
    }
    
    exportJSONToExcel(fullPath);
  }
  
  console.log('\n=== 导出完成 ===');
  console.log(`输出目录: ${OUTPUT_DIR}`);
}

main();
