import * as XLSX from 'xlsx';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { schemaMap, detectConfigType, fieldRelations, configDescriptions } from './schemas.js';

// 全局状态
let table = null;
let currentData = [];
let originalData = [];
let currentFileName = '';
let currentConfigType = null;
let loadedConfigs = {}; // 存储已加载的配置表（用于跨表验证）
let filterVisible = false; // 筛选器显示状态
let nextAutoId = 0; // 自动 ID 计数器

// Toast 通知系统
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    background: #ffffff;
    color: #0f172a;
    padding: 1rem 1.5rem;
    border-radius: 10px;
    box-shadow: 0 10px 15px rgba(0, 0, 0, 0.1);
    border: 1px solid #e2e8f0;
    z-index: 1000;
    animation: slideIn 0.3s ease;
    max-width: 400px;
    font-size: 0.9rem;
  `;
  
  if (type === 'success') {
    toast.style.borderLeft = '4px solid #10b981';
  } else if (type === 'error') {
    toast.style.borderLeft = '4px solid #ef4444';
  } else if (type === 'warning') {
    toast.style.borderLeft = '4px solid #f59e0b';
  }
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// 添加 toast 动画样式
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
`;
document.head.appendChild(style);

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
  
  // 显示加载状态
  const dropContent = dropZone.querySelector('.drop-content');
  const originalContent = dropContent.innerHTML;
  dropContent.innerHTML = '<div class="loading"></div><p style="margin-top: 1rem; color: #475569;">正在解析文件...</p>';
  
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
      
      // 恢复原始内容
      dropContent.innerHTML = originalContent;
      showToast(`成功加载 ${jsonData.length} 条记录`, 'success');
    } catch (error) {
      showToast(`文件解析失败: ${error.message}`, 'error');
      console.error(error);
      // 恢复原始内容
      dropContent.innerHTML = originalContent;
    }
  };
  
  reader.onerror = () => {
    showToast('文件读取失败', 'error');
    dropContent.innerHTML = originalContent;
  };
  
  reader.readAsArrayBuffer(file);
}

// ============================================================
// 表格功能
// ============================================================

function loadData(data) {
  currentData = JSON.parse(JSON.stringify(data));
  originalData = JSON.parse(JSON.stringify(data));
  
  // 计算下一个自动 ID
  nextAutoId = 0;
  if (data.length > 0) {
    const maxId = Math.max(...data.map(row => {
      const id = row.id;
      if (typeof id === 'number') return id;
      if (typeof id === 'string') {
        const num = parseInt(id);
        return isNaN(num) ? -1 : num;
      }
      return -1;
    }));
    nextAutoId = maxId >= 0 ? maxId + 1 : 0;
  }
  
  // 显示表格容器
  dropZone.style.display = 'none';
  tableContainer.style.display = 'block';
  
  // 显示配置说明
  showConfigDescription();
  
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
  
  // 初始化筛选器状态
  updateFilterVisibility();
  
  // 绑定工具栏事件
  bindToolbarEvents();
  
  // 更新状态栏
  updateStatusBar();
  
  console.log(`已加载 ${data.length} 条记录`);
  if (currentConfigType) {
    console.log(`识别配置类型: ${currentConfigType}`);
  }
}

function showConfigDescription() {
  // 移除旧的说明
  const oldDesc = document.getElementById('config-description');
  if (oldDesc) {
    oldDesc.remove();
  }
  
  if (!currentConfigType || !configDescriptions[currentConfigType]) {
    return;
  }
  
  const descDiv = document.createElement('div');
  descDiv.id = 'config-description';
  descDiv.style.cssText = `
    background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
    border: 1px solid #bae6fd;
    border-radius: 10px;
    padding: 1rem 1.25rem;
    margin-bottom: 1rem;
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    animation: fadeIn 0.3s ease;
  `;
  
  descDiv.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0; margin-top: 2px;">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="16" x2="12" y2="12"/>
      <line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
    <div>
      <strong style="color: #0369a1; font-size: 0.9rem;">${currentConfigType}</strong>
      <p style="color: #0c4a6e; font-size: 0.85rem; margin: 0.25rem 0 0; line-height: 1.5;">${configDescriptions[currentConfigType]}</p>
    </div>
  `;
  
  tableContainer.insertBefore(descDiv, tableContainer.children[0]);
}

function bindToolbarEvents() {
  // 新增行按钮
  const addRowBtn = document.getElementById('btn-add-row');
  if (addRowBtn) {
    addRowBtn.removeEventListener('click', handleAddRow);
    addRowBtn.addEventListener('click', handleAddRow);
  }
  
  // 筛选切换按钮
  const toggleFilterBtn = document.getElementById('btn-toggle-filter');
  if (toggleFilterBtn) {
    toggleFilterBtn.removeEventListener('click', toggleFilter);
    toggleFilterBtn.addEventListener('click', toggleFilter);
  }
}

function handleAddRow() {
  // 获取最后一行数据作为模板
  const lastRow = table.getRow(table.getDataCount());
  let newRowData = {};
  
  if (lastRow) {
    newRowData = JSON.parse(JSON.stringify(lastRow.getData()));
  }
  
  // 自增 ID
  newRowData.id = nextAutoId++;
  
  // 清空其他字段
  Object.keys(newRowData).forEach(key => {
    if (key !== 'id') {
      newRowData[key] = '';
    }
  });
  
  table.addRow(newRowData, true);
  showToast('已添加新行', 'success');
}

function toggleFilter() {
  filterVisible = !filterVisible;
  updateFilterVisibility();
  
  const toggleBtn = document.getElementById('btn-toggle-filter');
  if (toggleBtn) {
    toggleBtn.classList.toggle('active', filterVisible);
  }
}

function updateFilterVisibility() {
  const filterElements = document.querySelectorAll('.tabulator-header-filter');
  filterElements.forEach(el => {
    el.style.display = filterVisible ? 'block' : 'none';
  });
}

function updateStatusBar() {
  // 移除旧的状态栏
  const oldStatusBar = document.getElementById('status-bar');
  if (oldStatusBar) {
    oldStatusBar.remove();
  }
  
  // 创建新的状态栏
  const statusBar = document.createElement('div');
  statusBar.id = 'status-bar';
  statusBar.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    background: #f1f5f9;
    border-radius: 10px;
    margin-top: 1rem;
    font-size: 0.85rem;
    color: #475569;
    border: 1px solid #e2e8f0;
  `;
  
  const recordCount = currentData.length;
  const configType = currentConfigType || '未知类型';
  const fileName = currentFileName || '未命名';
  
  statusBar.innerHTML = `
    <span>📄 文件: ${fileName}</span>
    <span>📊 记录数: ${recordCount}</span>
    <span>🏷️ 类型: ${configType}</span>
  `;
  
  tableContainer.appendChild(statusBar);
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
  
  // 获取当前配置类型的关联字段
  const relations = currentConfigType ? fieldRelations[currentConfigType] || {} : {};
  
  // 生成列定义
  const columns = Array.from(allKeys).map(key => {
    const relation = relations[key];
    const hasRelation = relation && relation.targetTable;
    
    return {
      title: hasRelation 
        ? `<span>${key}</span><span class="relation-badge" data-relation="${relation.relatesTo}" data-target="${relation.targetTable}">🔗</span>`
        : key,
      field: key,
      editor: 'input',
      headerFilter: 'input',
      headerFilterPlaceholder: '筛选...',
      resizable: true,
      formatter: function(cell) {
        const value = cell.getValue();
        if (value === null || value === undefined) return '<span style="color: #94a3b8;">null</span>';
        if (typeof value === 'boolean') return value ? '<span style="color: #10b981;">true</span>' : '<span style="color: #ef4444;">false</span>';
        if (typeof value === 'object') return JSON.stringify(value).substring(0, 50) + '...';
        return value;
      },
      validator: getColumnValidator(key)
    };
  });
  
  // 添加操作列（复制上一行、删除）
  columns.push({
    title: '操作',
    field: '_actions',
    width: 100,
    frozen: true,
    hozAlign: 'center',
    headerSort: false,
    headerFilter: false,
    formatter: function(cell) {
      return `
        <div style="display: flex; gap: 4px; justify-content: center;">
          <button class="action-btn copy-btn" title="复制上一行" data-row="${cell.getRow().getPosition()}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>
          <button class="action-btn delete-btn" title="删除此行" data-row="${cell.getRow().getPosition()}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      `;
    },
    cellClick: function(e, cell) {
      const target = e.target.closest('.action-btn');
      if (!target) return;
      
      const row = cell.getRow();
      const rowPos = row.getPosition();
      
      if (target.classList.contains('copy-btn')) {
        // 复制上一行
        if (rowPos > 1) {
          const prevRow = table.getRow(rowPos - 1);
          const prevData = prevRow.getData();
          const newData = JSON.parse(JSON.stringify(prevData));
          
          // 自增 ID
          newData.id = nextAutoId++;
          
          row.update(newData);
          showToast('已复制上一行数据', 'success');
        } else {
          showToast('没有上一行可复制', 'warning');
        }
      } else if (target.classList.contains('delete-btn')) {
        // 删除当前行
        if (confirm('确定要删除此行吗？')) {
          row.delete();
          showToast('已删除该行', 'info');
        }
      }
    }
  });
  
  return columns;
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
    showToast('没有数据可导出', 'warning');
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
  showToast(`已导出 JSON 文件: ${a.download}`, 'success');
});

document.getElementById('btn-export-excel').addEventListener('click', () => {
  if (currentData.length === 0) {
    showToast('没有数据可导出', 'warning');
    return;
  }
  
  const worksheet = XLSX.utils.json_to_sheet(currentData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
  
  const fileName = currentFileName.replace(/\.[^/.]+$/, '.xlsx');
  XLSX.writeFile(workbook, fileName);
  
  showToast(`已导出 Excel 文件: ${fileName}`, 'success');
});

// ============================================================
// 验证功能
// ============================================================

document.getElementById('btn-validate').addEventListener('click', () => {
  if (currentData.length === 0) {
    showToast('没有数据可验证', 'warning');
    return;
  }
  
  showToast('正在验证配置...', 'info');
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
  
  // 滚动到验证面板
  validationPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  
  // 统计
  const errorCount = results.errors.length;
  const warningCount = results.warnings.length;
  
  if (errorCount === 0 && warningCount === 0) {
    validationResults.innerHTML = '<div class="validation-success">✅ 所有验证通过！配置数据完全正确。</div>';
    return;
  }
  
  // 显示摘要
  const summary = document.createElement('div');
  summary.className = results.success ? 'validation-success' : 'validation-error';
  summary.style.marginBottom = '1rem';
  summary.textContent = results.success 
    ? `✅ 验证通过（${warningCount} 个警告）` 
    : `❌ 验证失败（${errorCount} 个错误，${warningCount} 个警告）`;
  validationResults.appendChild(summary);
  
  // 显示错误
  if (errorCount > 0) {
    const errorHeader = document.createElement('div');
    errorHeader.style.cssText = 'color: var(--accent-error); font-weight: 600; margin: 1rem 0 0.5rem; font-size: 0.9rem;';
    errorHeader.textContent = `错误 (${errorCount}):`;
    validationResults.appendChild(errorHeader);
    
    results.errors.forEach(error => {
      const div = document.createElement('div');
      div.className = 'validation-error';
      div.textContent = ` ${error}`;
      validationResults.appendChild(div);
    });
  }
  
  // 显示警告
  if (warningCount > 0) {
    const warningHeader = document.createElement('div');
    warningHeader.style.cssText = 'color: var(--accent-warning); font-weight: 600; margin: 1rem 0 0.5rem; font-size: 0.9rem;';
    warningHeader.textContent = `警告 (${warningCount}):`;
    validationResults.appendChild(warningHeader);
    
    results.warnings.forEach(warning => {
      const div = document.createElement('div');
      div.className = 'validation-warning';
      div.textContent = `⚠️ ${warning}`;
      validationResults.appendChild(div);
    });
  }
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
    showToast('没有历史记录', 'warning');
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
      showToast('已从历史记录加载', 'success');
    } else {
      showToast('无效的历史记录编号', 'error');
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
        showToast('无效选择', 'error');
        return;
    }
    
    currentFileName = `${currentConfigType}-template.xlsx`;
    loadData(templateData);
    showToast(`已加载 ${currentConfigType} 模板`, 'success');
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
document.getElementById('btn-import').addEventListener('click', () => {
  fileInput.click();
});

// 添加重置按钮功能
function addResetButton() {
  const resetBtn = document.createElement('button');
  resetBtn.id = 'btn-reset';
  resetBtn.className = 'btn btn-secondary';
  resetBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
    重新加载
  `;
  resetBtn.addEventListener('click', () => {
    if (confirm('确定要重新加载吗？当前未保存的更改将丢失。')) {
      resetEditor();
    }
  });
  
  document.querySelector('.header-actions').appendChild(resetBtn);
}

function resetEditor() {
  // 隐藏表格容器
  tableContainer.style.display = 'none';
  validationPanel.style.display = 'none';
  
  // 显示拖拽区域
  dropZone.style.display = 'block';
  
  // 销毁表格
  if (table) {
    table.destroy();
    table = null;
  }
  
  // 清除数据
  currentData = [];
  originalData = [];
  currentFileName = '';
  currentConfigType = null;
  loadedConfigs = {};
  filterVisible = false;
  nextAutoId = 0;
  
  // 清除文件输入
  fileInput.value = '';
  
  showToast('编辑器已重置', 'info');
}

// ============================================================
// 初始化
window.addEventListener('load', () => {
  addHistoryButton();
  addTemplateButton();
  addResetButton();
  initNotesFeature();
});

// ============================================================
// 备注功能
// ============================================================

const NOTES_KEY = 'config-editor-notes';

function initNotesFeature() {
  const notesBtn = document.getElementById('btn-notes');
  const notesModal = document.getElementById('notes-modal');
  const notesClose = document.getElementById('notes-modal-close');
  const notesCancel = document.getElementById('notes-cancel');
  const notesSave = document.getElementById('notes-save');
  const notesTextarea = document.getElementById('notes-textarea');
  
  // 加载已保存的备注
  const savedNotes = localStorage.getItem(NOTES_KEY);
  if (savedNotes) {
    notesTextarea.value = savedNotes;
  }
  
  // 打开备注弹窗
  notesBtn.addEventListener('click', () => {
    notesModal.classList.add('active');
    notesTextarea.focus();
  });
  
  // 关闭备注弹窗
  function closeModal() {
    notesModal.classList.remove('active');
  }
  
  notesClose.addEventListener('click', closeModal);
  notesCancel.addEventListener('click', closeModal);
  
  // 点击弹窗外部关闭
  notesModal.addEventListener('click', (e) => {
    if (e.target === notesModal) {
      closeModal();
    }
  });
  
  // ESC 键关闭
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && notesModal.classList.contains('active')) {
      closeModal();
    }
  });
  
  // 保存备注
  notesSave.addEventListener('click', () => {
    const notes = notesTextarea.value.trim();
    localStorage.setItem(NOTES_KEY, notes);
    closeModal();
    showToast('备注已保存', 'success');
  });
}
