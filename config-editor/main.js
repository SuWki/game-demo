import * as XLSX from 'xlsx';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { schemaMap, detectConfigType } from './schemas.js';

// 全局状态
let table = null;
let currentData = [];
let originalData = [];
let currentFileName = '';
let currentConfigType = null;
let loadedConfigs = {}; // 存储已加载的配置表（用于跨表验证）

// 初始化 Ajv 验证器
const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

// DOM 元素
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const tableContainer = document.getElementById('table-container');
const validationPanel = document.getElementById('validation-panel');
const validationResults = document.getElementById('validation-results');

// ============================================================
// 文件导入功能
// ============================================================

// 拖拽上传
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    handleFile(files[0]);
  }
});

// 点击上传
dropZone.addEventListener('click', () => {
  fileInput.click();
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    handleFile(e.target.files[0]);
  }
});

// 处理文件
function handleFile(file) {
  currentFileName = file.name;
  const reader = new FileReader();
  
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      
      // 读取第一个工作表
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: null });
      
      // 识别配置类型
      currentConfigType = detectConfigType(jsonData, file.name);
      
      loadData(jsonData);
      
      // 保存到已加载配置（用于跨表验证）
      if (currentConfigType) {
        loadedConfigs[currentConfigType] = jsonData;
      }
    } catch (error) {
      alert(`文件解析失败: ${error.message}`);
      console.error(error);
    }
  };
  
  reader.readAsArrayBuffer(file);
}

// ============================================================
// 表格功能
// ============================================================

function loadData(data) {
  currentData = JSON.parse(JSON.stringify(data));
  originalData = JSON.parse(JSON.stringify(data));
  
  // 显示表格容器
  dropZone.style.display = 'none';
  tableContainer.style.display = 'block';
  
  // 销毁旧表格
  if (table) {
    table.destroy();
  }
  
  // 创建新表格
  const columns = generateColumns(data);
  
  table = new Tabulator('#config-table', {
    data: data,
    columns: columns,
    layout: 'fitColumns',
    movableColumns: true,
    resizableRows: true,
    pagination: 'local',
    paginationSize: 20,
    editable: true,
    history: true,
    clipboard: true,
    clipboardPasteParser: 'table',
    clipboardCopyRowRange: 'active',
    cellEdited: function(cell) {
      updateCurrentData();
      highlightChanges();
      saveToHistory();
    },
    rowDeleted: function() {
      updateCurrentData();
      saveToHistory();
    },
  });
  
  console.log(`已加载 ${data.length} 条记录`);
  if (currentConfigType) {
    console.log(`识别配置类型: ${currentConfigType}`);
  }
}

function generateColumns(data) {
  if (data.length === 0) return [];
  
  // 收集所有键
  const allKeys = new Set();
  for (const row of data) {
    for (const key of Object.keys(row)) {
      allKeys.add(key);
    }
  }
  
  // 生成列定义
  return Array.from(allKeys).map(key => ({
    title: key,
    field: key,
    editor: 'input',
    headerFilter: 'input',
    resizable: true,
    formatter: function(cell) {
      const value = cell.getValue();
      if (value === null || value === undefined) return '<span style="color: #718096;">null</span>';
      if (typeof value === 'boolean') return value ? '✅' : '❌';
      if (typeof value === 'object') return JSON.stringify(value).substring(0, 50) + '...';
      return value;
    },
    validator: getColumnValidator(key)
  }));
}

function getColumnValidator(key) {
  // 根据列名返回验证器
  if (key.includes('damage') || key.includes('hp') || key.includes('speed')) {
    return 'numeric';
  }
  if (key.includes('id')) {
    return 'required';
  }
  return null;
}

function updateCurrentData() {
  if (table) {
    currentData = table.getData();
  }
}

function highlightChanges() {
  if (!table) return;
  
  const rows = table.getRows();
  rows.forEach((row, rowIndex) => {
    const originalRow = originalData[rowIndex];
    if (!originalRow) return;
    
    const cells = row.getCells();
    cells.forEach(cell => {
      const field = cell.getField();
      const currentValue = cell.getValue();
      const originalValue = originalRow[field];
      
      if (currentValue !== originalValue) {
        cell.getElement().style.backgroundColor = 'rgba(255, 255, 0, 0.2)';
      } else {
        cell.getElement().style.backgroundColor = '';
      }
    });
  });
}

// ============================================================
// 导出功能
// ============================================================

document.getElementById('btn-export-json').addEventListener('click', () => {
  if (currentData.length === 0) {
    alert('没有数据可导出');
    return;
  }
  
  const json = JSON.stringify(currentData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = currentFileName.replace(/\.[^/.]+$/, '.json');
  a.click();
  
  URL.revokeObjectURL(url);
  console.log('已导出 JSON 文件');
});

document.getElementById('btn-export-excel').addEventListener('click', () => {
  if (currentData.length === 0) {
    alert('没有数据可导出');
    return;
  }
  
  const worksheet = XLSX.utils.json_to_sheet(currentData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
  
  const fileName = currentFileName.replace(/\.[^/.]+$/, '.xlsx');
  XLSX.writeFile(workbook, fileName);
  
  console.log('已导出 Excel 文件');
});

// ============================================================
// 验证功能
// ============================================================

document.getElementById('btn-validate').addEventListener('click', () => {
  if (currentData.length === 0) {
    alert('没有数据可验证');
    return;
  }
  
  validateConfig(currentData);
});

function validateConfig(data) {
  const results = {
    errors: [],
    warnings: [],
    success: true
  };
  
  // 1. JSON Schema 验证
  if (currentConfigType && schemaMap[currentConfigType]) {
    const schema = schemaMap[currentConfigType];
    const validate = ajv.compile(schema);
    const valid = validate(data);
    
    if (!valid) {
      validate.errors.forEach(err => {
        const rowMatch = err.instancePath.match(/\/(\d+)/);
        const rowIndex = rowMatch ? parseInt(rowMatch[1]) + 1 : '?';
        
        if (err.keyword === 'required' || err.keyword === 'type') {
          results.errors.push(`第 ${rowIndex} 行: ${err.message} (${err.instancePath})`);
          results.success = false;
        } else {
          results.warnings.push(`第 ${rowIndex} 行: ${err.message} (${err.instancePath})`);
        }
      });
    }
  }
  
  // 2. 跨表引用验证
  if (currentConfigType === 'battleTemplates' && loadedConfigs.enemyArchetypes) {
    const validArchetypes = new Set(loadedConfigs.enemyArchetypes.map(e => e.id));
    
    data.forEach((row, index) => {
      if (row.regularArchetypes) {
        for (const archetype of Object.keys(row.regularArchetypes)) {
          if (!validArchetypes.has(archetype)) {
            results.errors.push(`第 ${index + 1} 行: regularArchetypes 引用了不存在的敌人类型 "${archetype}"`);
            results.success = false;
          }
        }
      }
    });
  }
  
  // 3. 数值平衡性分析
  if (currentConfigType === 'upgrades') {
    data.forEach((row, index) => {
      // 检查 baseWeight 是否合理
      if (row['selection.baseWeight'] !== undefined) {
        const weight = parseFloat(row['selection.baseWeight']);
        if (weight > 15) {
          results.warnings.push(`第 ${index + 1} 行: baseWeight 为 ${weight}，过高可能导致该升级频繁出现`);
        }
        if (weight < 0.5 && row.rarity !== 'legendary') {
          results.warnings.push(`第 ${index + 1} 行: baseWeight 为 ${weight}，过低可能导致该升级极少出现`);
        }
      }
      
      // 检查稀有度与权重的关系
      if (row.rarity === 'rare' && row['selection.baseWeight'] > 5) {
        results.warnings.push(`第 ${index + 1} 行: rare 稀有度的 baseWeight 为 ${row['selection.baseWeight']}，建议 ≤ 5`);
      }
    });
  }
  
  // 4. 战斗模板难度曲线检查
  if (currentConfigType === 'battleTemplates') {
    const battleTemplates = data.filter(t => !t.id?.startsWith('boss'));
    if (battleTemplates.length > 1) {
      const avgHp = battleTemplates.reduce((sum, t) => sum + (parseFloat(t.enemyHp) || 0), 0) / battleTemplates.length;
      const avgDuration = battleTemplates.reduce((sum, t) => sum + (parseFloat(t.durationSec) || 0), 0) / battleTemplates.length;
      
      if (avgHp > 100) {
        results.warnings.push(`战斗模板平均敌人血量较高: ${avgHp.toFixed(1)}`);
      }
      if (avgDuration > 60) {
        results.warnings.push(`战斗模板平均持续时间较长: ${avgDuration.toFixed(1)}秒`);
      }
      
      // 检查难度曲线
      for (let i = 1; i < battleTemplates.length; i++) {
        const prevHp = parseFloat(battleTemplates[i-1].enemyHp) || 0;
        const currHp = parseFloat(battleTemplates[i].enemyHp) || 0;
        
        if (currHp < prevHp * 0.8) {
          results.warnings.push(`第 ${i + 1} 个战斗模板的 enemyHp (${currHp}) 比前一个 (${prevHp}) 低很多，难度曲线可能不平滑`);
        }
      }
    }
  }
  
  displayValidationResults(results);
}

function displayValidationResults(results) {
  validationPanel.style.display = 'block';
  validationResults.innerHTML = '';
  
  // 统计
  const errorCount = results.errors.length;
  const warningCount = results.warnings.length;
  
  if (errorCount === 0 && warningCount === 0) {
    validationResults.innerHTML = '<div class="validation-success">✅ 所有验证通过！</div>';
    return;
  }
  
  // 显示摘要
  const summary = document.createElement('div');
  summary.className = results.success ? 'validation-success' : 'validation-error';
  summary.textContent = results.success 
    ? `✅ 验证通过（${warningCount} 个警告）` 
    : `❌ 验证失败（${errorCount} 个错误，${warningCount} 个警告）`;
  validationResults.appendChild(summary);
  
  // 显示错误
  results.errors.forEach(error => {
    const div = document.createElement('div');
    div.className = 'validation-error';
    div.textContent = `❌ ${error}`;
    validationResults.appendChild(div);
  });
  
  // 显示警告
  results.warnings.forEach(warning => {
    const div = document.createElement('div');
    div.className = 'validation-warning';
    div.textContent = `⚠️ ${warning}`;
    validationResults.appendChild(div);
  });
}

// ============================================================
// 版本历史（localStorage）
// ============================================================

const HISTORY_KEY = 'config-editor-history';

function saveToHistory() {
  if (currentData.length === 0) return;
  
  const history = getHistory();
  const entry = {
    timestamp: new Date().toISOString(),
    fileName: currentFileName,
    configType: currentConfigType,
    data: JSON.parse(JSON.stringify(currentData)),
    recordCount: currentData.length
  };
  
  // 保留最近 10 个版本
  history.unshift(entry);
  if (history.length > 10) {
    history.pop();
  }
  
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function getHistory() {
  try {
    const history = localStorage.getItem(HISTORY_KEY);
    return history ? JSON.parse(history) : [];
  } catch {
    return [];
  }
}

function loadFromHistory(index) {
  const history = getHistory();
  if (index >= 0 && index < history.length) {
    const entry = history[index];
    currentFileName = entry.fileName;
    currentConfigType = entry.configType;
    loadData(entry.data);
    console.log(`已从历史记录加载: ${entry.timestamp}`);
  }
}

// 添加历史记录按钮
function addHistoryButton() {
  const historyBtn = document.createElement('button');
  historyBtn.id = 'btn-history';
  historyBtn.className = 'btn btn-secondary';
  historyBtn.textContent = '📜 历史记录';
  historyBtn.addEventListener('click', showHistoryPanel);
  
  document.querySelector('.header-actions').appendChild(historyBtn);
}

function showHistoryPanel() {
  const history = getHistory();
  
  if (history.length === 0) {
    alert('没有历史记录');
    return;
  }
  
  let message = '历史记录（最近 10 个版本）:\n\n';
  history.forEach((entry, index) => {
    const date = new Date(entry.timestamp).toLocaleString('zh-CN');
    message += `${index + 1}. ${date} - ${entry.fileName} (${entry.recordCount} 条记录)\n`;
  });
  message += '\n输入编号加载历史记录:';
  
  const choice = prompt(message);
  if (choice) {
    const index = parseInt(choice) - 1;
    if (index >= 0 && index < history.length) {
      loadFromHistory(index);
    }
  }
}

// ============================================================
// 预设模板
// ============================================================

function addTemplateButton() {
  const templateBtn = document.createElement('button');
  templateBtn.id = 'btn-template';
  templateBtn.className = 'btn btn-secondary';
  templateBtn.textContent = '📋 加载模板';
  templateBtn.addEventListener('click', showTemplateMenu);
  
  document.querySelector('.header-actions').appendChild(templateBtn);
}

function showTemplateMenu() {
  const choice = prompt(
    '选择预设模板:\n\n' +
    '1. upgrades (升级配置)\n' +
    '2. battleTemplates (战斗模板)\n' +
    '3. enemyArchetypes (敌人原型)\n\n' +
    '输入编号:'
  );
  
  if (choice) {
    let templateData = [];
    
    switch (choice) {
      case '1':
        currentConfigType = 'upgrades';
        templateData = getUpgradeTemplate();
        break;
      case '2':
        currentConfigType = 'battleTemplates';
        templateData = getBattleTemplateTemplate();
        break;
      case '3':
        currentConfigType = 'enemyArchetypes';
        templateData = getEnemyArchetypeTemplate();
        break;
      default:
        alert('无效选择');
        return;
    }
    
    currentFileName = `${currentConfigType}-template.xlsx`;
    loadData(templateData);
  }
}

function getUpgradeTemplate() {
  return [
    {
      id: 'example-upgrade',
      name: '示例升级',
      description: '这是一个升级模板示例',
      category: 'generic',
      rarity: 'common',
      repeatable: true,
      'effects.0.type': 'stats',
      'effects.0.modifiers.damage': 3,
      'selection.baseWeight': 4
    }
  ];
}

function getBattleTemplateTemplate() {
  return [
    {
      id: 'example-battle',
      name: '示例战斗',
      description: '这是一个战斗模板示例',
      durationSec: 30,
      spawnIntervalSec: 0.8,
      enemyHp: 20,
      enemySpeed: 60,
      enemyDamage: 8,
      regularEnemyCap: 10,
      pressureMultiplier: 1.0,
      'winCondition.type': 'kills',
      'winCondition.target': 25,
      'spawnRule.pattern': 'surround',
      'spawnRule.burstCount': 1
    }
  ];
}

function getEnemyArchetypeTemplate() {
  return [
    {
      id: 'example-enemy',
      name: '示例敌人',
      hpMultiplier: 1.0,
      speedMultiplier: 1.0,
      radiusMultiplier: 1.0,
      contactDamageMultiplier: 1.0,
      experienceMultiplier: 1.0
    }
  ];
}

// ============================================================
// 按钮事件
// ============================================================

document.getElementById('btn-import').addEventListener('click', () => {
  fileInput.click();
});

// ============================================================
// 初始化
// ============================================================

window.addEventListener('load', () => {
  addHistoryButton();
  addTemplateButton();
});
