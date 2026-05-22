/**
 * 文件处理模块 - 导入导出功能
 */

import * as XLSX from 'xlsx';
import { showToast } from './utils.js';

// 导出 JSON
export function exportToJSON(data, fileName) {
  if (data.length === 0) {
    showToast('没有数据可导出', 'warning');
    return;
  }

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.replace(/\.[^/.]+$/, '.json');
  a.click();

  URL.revokeObjectURL(url);
  showToast(`已导出 JSON 文件: ${a.download}`, 'success');
}

// 导出 Excel
export function exportToExcel(data, fileName) {
  if (data.length === 0) {
    showToast('没有数据可导出', 'warning');
    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');

  const outFileName = fileName.replace(/\.[^/.]+$/, '.xlsx');
  XLSX.writeFile(workbook, outFileName);

  showToast(`已导出 Excel 文件: ${outFileName}`, 'success');
}

// 解析文件
export async function parseFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        // 读取第一个工作表
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: null });

        resolve(jsonData);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('文件读取失败'));
    };

    reader.readAsArrayBuffer(file);
  });
}
