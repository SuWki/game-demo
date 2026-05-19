/**
 * Excel 转 JSON 转换工具
 * 将 Excel 文件转换为 JSON 格式到 public/data/
 * 
 * 使用方式: node tools/excel-to-json.mjs <excel文件路径>
 * 示例: node tools/excel-to-json.mjs tools/templates/upgrades.xlsx
 */

import XLSX from 'xlsx';
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
 * 将点号分隔的键路径转换为嵌套对象
 * 例如: "effects.0.type" -> { effects: [{ type: value }] }
 */
function setNestedValue(obj, path, value) {
  const parts = path.split('.');
  let current = obj;
  
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const nextPart = parts[i + 1];
    const isIndex = /^\d+$/.test(nextPart);
    
    if (!(part in current)) {
      current[part] = isIndex ? [] : {};
    }
    
    current = current[part];
  }
  
  const lastPart = parts[parts.length - 1];
  
  // 处理数组索引
  if (/^\d+$/.test(lastPart)) {
    const index = parseInt(lastPart, 10);
    while (current.length <= index) {
      current.push({});
    }
    current[index] = value;
  } else {
    current[lastPart] = value;
  }
}

/**
 * 处理单元格值（转换类型）
 */
function processCellValue(value) {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  
  // 处理布尔值
  if (typeof value === 'boolean') return value;
  
  // 处理数字
  if (typeof value === 'number') return value;
  
  // 处理字符串
  if (typeof value === 'string') {
    // 尝试解析 JSON
    if (value.startsWith('{') || value.startsWith('[')) {
      try {
        return JSON.parse(value);
      } catch {
        // 不是有效的 JSON，返回原字符串
      }
    }
    
    // 转换为数字（如果是数字字符串）
    if (!isNaN(value) && value.trim() !== '') {
      return Number(value);
    }
    
    // 布尔值字符串
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
    
    return value;
  }
  
  return value;
}

/**
 * 将 Excel 工作表转换为 JSON
 */
function sheetToJson(worksheet) {
  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: null });
  const result = [];
  
  for (const row of rows) {
    const obj = {};
    
    for (const [key, value] of Object.entries(row)) {
      const processedValue = processCellValue(value);
      
      if (key.includes('.')) {
        // 嵌套对象
        setNestedValue(obj, key, processedValue);
      } else {
        obj[key] = processedValue;
      }
    }
    
    result.push(obj);
  }
  
  return result;
}

/**
 * 转换单个 Excel 文件
 */
function convertExcelToJSON(excelPath) {
  console.log(`\n--- 转换 ${path.basename(excelPath)} ---`);
  
  const workbook = XLSX.readFile(excelPath);
  
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const data = sheetToJson(worksheet);
    
    const outputPath = path.join(OUTPUT_DIR, `${sheetName}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');
    
    console.log(`✓ ${sheetName}.json (${data.length} 条记录)`);
  }
}

/**
 * 主函数
 */
function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('用法: node tools/excel-to-json.mjs <excel文件路径>');
    console.log('示例: node tools/excel-to-json.mjs tools/templates/upgrades.xlsx');
    console.log('\n支持的 Excel 文件格式:');
    console.log('  - .xlsx');
    console.log('  - .xls');
    console.log('\n列命名规则:');
    console.log('  - 普通字段: 直接使用字段名 (如: id, name, damage)');
    console.log('  - 嵌套对象: 使用点号分隔 (如: effects.0.type, selection.baseWeight)');
    console.log('  - 数组索引: 使用数字索引 (如: effects.0, effects.1)');
    process.exit(0);
  }
  
  for (const excelPath of args) {
    const fullPath = path.resolve(excelPath);
    
    if (!fs.existsSync(fullPath)) {
      console.error(`错误: 文件不存在 ${fullPath}`);
      process.exit(1);
    }
    
    convertExcelToJSON(fullPath);
  }
  
  console.log('\n=== 转换完成 ===');
  console.log(`输出目录: ${OUTPUT_DIR}`);
}

main();
