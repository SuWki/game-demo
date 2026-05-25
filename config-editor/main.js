import * as XLSX from 'xlsx';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { schemaMap, detectConfigType, fieldRelations, configDescriptions, enumFields, getFieldDescriptions, getFieldTypes } from './schemas.js';

// 全局状态
let table = null;
let currentData = [];
let originalData = [];
let currentFileName = '';
let currentConfigType = null;
let loadedConfigs = {}; // 存储已加载的配置表（用于跨表验证）
let filterVisible = false; // 筛选器显示状态
let nextAutoId = 0; // 自动 ID 计数器

// 自动保存相关
const AUTO_SAVE_KEY = 'config-editor-autosave';
const AUTO_SAVE_INTERVAL = 30000; // 30秒
let autoSaveTimer = null;
let lastAutoSaveTime = null;
let isDirty = false; // 数据是否已修改

// 撤销/重做管理器
class HistoryManager {
  constructor(maxSize = 50) {
    this.undoStack = [];
    this.redoStack = [];
    this.maxSize = maxSize;
    this.isUndoing = false;
  }

  push(action) {
    if (this.isUndoing) return;
    this.undoStack.push(action);
    this.redoStack = []; // 清空重做栈
    if (this.undoStack.length > this.maxSize) {
      this.undoStack.shift();
    }
    this.updateUI();
  }

  undo() {
    if (this.undoStack.length === 0) return null;
    const action = this.undoStack.pop();
    this.redoStack.push(action);
    this.isUndoing = true;
    this.updateUI();
    return action;
  }

  redo() {
    if (this.redoStack.length === 0) return null;
    const action = this.redoStack.pop();
    this.undoStack.push(action);
    this.updateUI();
    return action;
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.isUndoing = false;
    this.updateUI();
  }

  updateUI() {
    const undoBtn = document.getElementById('btn-undo');
    const redoBtn = document.getElementById('btn-redo');
    if (undoBtn) undoBtn.disabled = !this.canUndo();
    if (redoBtn) redoBtn.disabled = !this.canRedo();
    if (undoBtn) undoBtn.style.opacity = this.canUndo() ? '1' : '0.5';
    if (redoBtn) redoBtn.style.opacity = this.canRedo() ? '1' : '0.5';
  }

  setUndoing(value) {
    this.isUndoing = value;
  }
}

const historyManager = new HistoryManager(50);

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

      // 恢复原始内容
      dropContent.innerHTML = originalContent;

      // 显示导入预览
      showImportPreview(jsonData);
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
      if (!historyManager.isUndoing) {
        const action = {
          type: 'edit',
          rowIndex: cell.getRow().getPosition() - 1,
          field: cell.getField(),
          oldValue: cell.getOldValue(),
          newValue: cell.getValue()
        };
        historyManager.push(action);
      }
      updateCurrentData();
      highlightChanges();
      saveToHistory();
      // 实时验证
      validateCellRealtime(cell);
      // 更新 tooltip
      updateCellTooltip(cell);
    },
    rowDeleted: function(row) {
      if (!historyManager.isUndoing) {
        const action = {
          type: 'delete',
          rowIndex: row.getPosition() - 1,
          data: row.getData()
        };
        historyManager.push(action);
      }
      updateCurrentData();
      saveToHistory();
    },
  });
  
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

  // 新增列按钮
  const addColBtn = document.getElementById('btn-add-col');
  if (addColBtn) {
    addColBtn.removeEventListener('click', handleAddCol);
    addColBtn.addEventListener('click', handleAddCol);
  }

  // 撤销按钮
  const undoBtn = document.getElementById('btn-undo');
  if (undoBtn) {
    undoBtn.addEventListener('click', undoAction);
  }

  // 重做按钮
  const redoBtn = document.getElementById('btn-redo');
  if (redoBtn) {
    redoBtn.addEventListener('click', redoAction);
  }

  // 批量编辑按钮
  const batchEditBtn = document.getElementById('btn-batch-edit');
  if (batchEditBtn) {
    batchEditBtn.addEventListener('click', showBatchEditModal);
  }

  // 对比按钮
  const compareBtn = document.getElementById('btn-compare');
  if (compareBtn) {
    compareBtn.addEventListener('click', showCompareView);
  }

  // 关闭对比面板
  const closeCompareBtn = document.getElementById('btn-close-compare');
  if (closeCompareBtn) {
    closeCompareBtn.addEventListener('click', hideCompareView);
  }

  // 全局搜索按钮
  const globalSearchBtn = document.getElementById('btn-global-search');
  if (globalSearchBtn) {
    globalSearchBtn.addEventListener('click', toggleGlobalSearch);
  }

  // 快捷键帮助按钮
  const shortcutsBtn = document.getElementById('btn-shortcuts');
  if (shortcutsBtn) {
    shortcutsBtn.addEventListener('click', showShortcutsModal);
  }

  // 搜索面板事件
  const searchInput = document.getElementById('global-search-input');
  const searchPrev = document.getElementById('search-prev');
  const searchNext = document.getElementById('search-next');
  const searchClose = document.getElementById('search-close');

  if (searchInput) {
    searchInput.addEventListener('input', debounce(handleGlobalSearch, 200));
    searchInput.addEventListener('keydown', handleSearchKeydown);
  }
  if (searchPrev) searchPrev.addEventListener('click', () => navigateSearchResult(-1));
  if (searchNext) searchNext.addEventListener('click', () => navigateSearchResult(1));
  if (searchClose) searchClose.addEventListener('click', hideGlobalSearch);

  // 批量编辑弹窗事件
  const batchModalClose = document.getElementById('batch-modal-close');
  const batchCancel = document.getElementById('batch-cancel');
  const batchApply = document.getElementById('batch-apply');

  if (batchModalClose) batchModalClose.addEventListener('click', hideBatchEditModal);
  if (batchCancel) batchCancel.addEventListener('click', hideBatchEditModal);
  if (batchApply) batchApply.addEventListener('click', applyBatchEdit);

  // 键盘快捷键
  document.addEventListener('keydown', handleKeyboardShortcut);
}

function handleAddRow() {
  // 获取最后一行数据作为模板
  const lastRow = table.getRow(table.getDataCount());
  let newRowData = {};

  if (lastRow) {
    newRowData = JSON.parse(JSON.stringify(lastRow.getData()));
  } else if (table && table.getData().length > 0) {
    // 如果没有最后一行（可能分页等原因），用第一行作为模板
    const firstRow = table.getRow(1);
    if (firstRow) {
      newRowData = JSON.parse(JSON.stringify(firstRow.getData()));
    }
  }

  // 重新计算下一个自动 ID（从 0 开始的最大值 + 1）
  nextAutoId = 0;
  if (table) {
    const data = table.getData();
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
  }

  // 设置自增 ID
  newRowData.id = nextAutoId;

  // 清空其他字段
  Object.keys(newRowData).forEach(key => {
    if (key !== 'id') {
      newRowData[key] = '';
    }
  });

  table.addRow(newRowData, true);

  // 记录到历史
  const action = {
    type: 'add',
    data: newRowData
  };
  historyManager.push(action);

  showToast('已添加新行', 'success');
}

function undoAction() {
  const action = historyManager.undo();
  if (!action) {
    showToast('没有可撤销的操作', 'warning');
    return;
  }

  historyManager.setUndoing(true);
  try {
    switch (action.type) {
      case 'edit':
        const rows = table.getRows();
        if (rows[action.rowIndex]) {
          const row = rows[action.rowIndex];
          row.update({ [action.field]: action.oldValue });
        }
        break;
      case 'add':
        // 删除最后一行（假设新增行在最后）
        const lastRow = table.getRow(table.getDataCount());
        if (lastRow && lastRow.getData().id === action.data.id) {
          lastRow.delete();
        }
        break;
      case 'delete':
        // 恢复删除的行
        table.addRow(action.data, false);
        break;
    }
    updateCurrentData();
    highlightChanges();
    showToast('已撤销', 'success');
  } finally {
    historyManager.setUndoing(false);
  }
}

function redoAction() {
  const action = historyManager.redo();
  if (!action) {
    showToast('没有可重做的操作', 'warning');
    return;
  }

  historyManager.setUndoing(true);
  try {
    switch (action.type) {
      case 'edit':
        const rows = table.getRows();
        if (rows[action.rowIndex]) {
          const row = rows[action.rowIndex];
          row.update({ [action.field]: action.newValue });
        }
        break;
      case 'add':
        table.addRow(action.data, true);
        break;
      case 'delete':
        const rowToDelete = table.getRows()[action.rowIndex];
        if (rowToDelete && rowToDelete.getData().id === action.data.id) {
          rowToDelete.delete();
        }
        break;
    }
    updateCurrentData();
    highlightChanges();
    showToast('已重做', 'success');
  } finally {
    historyManager.setUndoing(false);
  }
}

function handleKeyboardShortcut(e) {
  // 全局搜索快捷键 (Ctrl+F)
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
    e.preventDefault();
    const searchPanel = document.getElementById('global-search-panel');
    if (searchPanel.style.display === 'none') {
      toggleGlobalSearch();
      document.getElementById('global-search-input').focus();
    } else {
      document.getElementById('global-search-input').focus();
    }
    return;
  }

  // 如果搜索面板打开，优先处理搜索导航
  const searchPanel = document.getElementById('global-search-panel');
  if (searchPanel.style.display !== 'none') {
    if (e.key === 'Escape') {
      hideGlobalSearch();
      return;
    }
  }

  // 忽略在输入框中的快捷键（搜索输入框除外）
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    return;
  }

  if (e.ctrlKey || e.metaKey) {
    switch (e.key.toLowerCase()) {
      case 'z':
        e.preventDefault();
        if (e.shiftKey) {
          redoAction();
        } else {
          undoAction();
        }
        break;
      case 'y':
        e.preventDefault();
        redoAction();
        break;
      case 's':
        e.preventDefault();
        // 触发JSON导出
        document.getElementById('btn-export-json').click();
        break;
      case 'e':
        e.preventDefault();
        // 触发Excel导出
        document.getElementById('btn-export-excel').click();
        break;
    }
  }

  // Delete 键删除选中行
  if (e.key === 'Delete' && table) {
    const selectedRows = table.getSelectedRows();
    if (selectedRows.length > 0) {
      e.preventDefault();
      if (confirm(`确定要删除选中的 ${selectedRows.length} 行吗？`)) {
        selectedRows.forEach(row => row.delete());
        updateCurrentData();
        saveToHistory();
        showToast(`已删除 ${selectedRows.length} 行`, 'info');
      }
    }
  }
}

// 列筛选弹出框状态
let activeFilterPopup = null;

function handleAddCol() {
  if (!table) {
    showToast('请先加载数据', 'warning');
    return;
  }

  const colName = prompt('请输入新列的名称：');
  if (!colName || !colName.trim()) {
    showToast('列名不能为空', 'warning');
    return;
  }

  const trimmedName = colName.trim();

  // 检查是否已存在
  const existingCols = table.getColumns();
  if (existingCols.some(col => col.getField() === trimmedName)) {
    showToast('该列名已存在', 'error');
    return;
  }

  // 添加新列到所有数据
  const newData = table.getData();
  newData.forEach(row => {
    row[trimmedName] = '';
  });

  // 更新表格数据
  table.setData(newData);

  // 添加新列定义
  table.addColumn({
    title: trimmedName,
    field: trimmedName,
    editor: 'input',
    resizable: true,
    headerSort: true,
    headerFilter: 'input',
    headerFilterPlaceholder: '筛选...',
    titleFormatter: function(cell) {
      const container = document.createElement('div');
      container.className = 'col-header-content';
      container.style.display = 'flex';
      container.style.alignItems = 'center';
      container.style.justifyContent = 'space-between';
      container.style.width = '100%';
      container.style.gap = '4px';

      const labelWrap = document.createElement('div');
      labelWrap.style.display = 'flex';
      labelWrap.style.alignItems = 'center';
      labelWrap.style.overflow = 'hidden';
      labelWrap.innerHTML = '<span>' + trimmedName + '</span>';

      const actionsWrap = document.createElement('div');
      actionsWrap.className = 'col-header-actions';
      actionsWrap.style.display = 'flex';
      actionsWrap.style.alignItems = 'center';
      actionsWrap.style.gap = '2px';
      actionsWrap.style.flexShrink = '0';

      const filterBtn = document.createElement('button');
      filterBtn.className = 'col-header-btn filter-btn';
      filterBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>';
      filterBtn.title = '筛选 ' + trimmedName;
      filterBtn.onclick = (e) => {
        e.stopPropagation();
        showColumnFilter(trimmedName, cell.getElement());
      };

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'col-header-btn delete-col-btn';
      deleteBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      deleteBtn.title = '删除列 ' + trimmedName;
      deleteBtn.onclick = (e) => {
        e.stopPropagation();
        if (confirm('确定要删除列 "' + trimmedName + '" 吗？')) {
          deleteColumn(trimmedName);
        }
      };

      actionsWrap.appendChild(filterBtn);
      actionsWrap.appendChild(deleteBtn);
      container.appendChild(labelWrap);
      container.appendChild(actionsWrap);

      return container;
    }
  });

  updateCurrentData();
  showToast('已添加新列：' + trimmedName, 'success');
}

function deleteColumn(key) {
  if (!table) return;

  table.deleteColumn(key);

  // 从数据中移除该字段
  const newData = table.getData().map(row => {
    const newRow = { ...row };
    delete newRow[key];
    return newRow;
  });
  table.setData(newData);

  updateCurrentData();
  showToast('已删除列：' + key, 'success');
}

function showColumnFilter(field, headerEl) {
  // 关闭已有的弹出框
  if (activeFilterPopup) {
    activeFilterPopup.remove();
    activeFilterPopup = null;
  }

  const popup = document.createElement('div');
  popup.className = 'column-filter-popup';
  popup.style.cssText = `
    position: fixed;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: 0.5rem;
    box-shadow: var(--shadow-lg);
    z-index: 200;
    min-width: 180px;
    animation: fadeIn 0.15s ease;
  `;

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = '筛选 ' + field + '...';
  input.style.cssText = `
    width: 100%;
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    background: var(--bg-card);
    color: var(--text-primary);
    font-size: 0.85rem;
    outline: none;
  `;

  // 恢复已有的筛选值
  const existingFilter = table.getHeaderFilterValue(field);
  if (existingFilter) {
    input.value = existingFilter;
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      applyFilter();
      closePopup();
    } else if (e.key === 'Escape') {
      closePopup();
    }
  });

  input.addEventListener('blur', () => {
    // 延迟关闭，以便点击其他元素
    setTimeout(() => {
      if (document.activeElement !== input) {
        applyFilter();
        closePopup();
      }
    }, 200);
  });

  const btnWrap = document.createElement('div');
  btnWrap.style.cssText = 'display: flex; gap: 0.35rem; margin-top: 0.5rem; justify-content: flex-end;';

  const clearBtn = document.createElement('button');
  clearBtn.textContent = '清除';
  clearBtn.className = 'btn btn-sm btn-secondary';
  clearBtn.style.cssText = 'padding: 0.25rem 0.5rem; font-size: 0.75rem;';
  clearBtn.onclick = (e) => {
    e.stopPropagation();
    table.setHeaderFilterValue(field, '');
    closePopup();
  };

  const okBtn = document.createElement('button');
  okBtn.textContent = '确定';
  okBtn.className = 'btn btn-sm btn-primary';
  okBtn.style.cssText = 'padding: 0.25rem 0.5rem; font-size: 0.75rem;';
  okBtn.onclick = (e) => {
    e.stopPropagation();
    applyFilter();
    closePopup();
  };

  btnWrap.appendChild(clearBtn);
  btnWrap.appendChild(okBtn);
  popup.appendChild(input);
  popup.appendChild(btnWrap);
  document.body.appendChild(popup);

  activeFilterPopup = popup;

  // 定位弹出框
  const rect = headerEl.getBoundingClientRect();
  popup.style.left = rect.left + 'px';
  popup.style.top = (rect.bottom + 4) + 'px';

  input.focus();

  function applyFilter() {
    const value = input.value.trim();
    table.setHeaderFilterValue(field, value || '');
  }

  function closePopup() {
    if (popup.parentNode) {
      popup.remove();
    }
    if (activeFilterPopup === popup) {
      activeFilterPopup = null;
    }
  }
}

function createColumnFilterPopup(key) {
  return false;
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
    ${isDirty ? '<span class="save-indicator unsaved">● 未保存</span>' : (lastAutoSaveTime ? `<span class="save-indicator saved">✓ ${lastAutoSaveTime.toLocaleTimeString()} 已保存</span>` : '')}
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

  // 获取当前配置类型的各种信息
  const relations = currentConfigType ? fieldRelations[currentConfigType] || {} : {};
  const enums = currentConfigType ? enumFields[currentConfigType] || {} : {};
  const descriptions = currentConfigType ? getFieldDescriptions(currentConfigType) : {};
  const fieldTypes = currentConfigType ? getFieldTypes(currentConfigType) : {};

  // 生成列定义
  const columns = Array.from(allKeys).map(key => {
    const relation = relations[key];
    const hasRelation = relation && relation.targetTable;
    const enumValues = enums[key];
    const isEnumField = enumValues && Array.isArray(enumValues);
    const typeInfo = fieldTypes[key] || { icon: '🔤', label: '文本', color: '#6366f1', editor: 'input' };

    // 根据字段类型确定编辑器
    let editor = 'input';
    let editorParams = {};

    if (isEnumField) {
      editor = 'select';
      editorParams = {
        values: enumValues.map(v => ({
          value: v,
          label: String(v)
        })),
        allowEmpty: true
      };
    } else if (typeInfo.editor === 'number') {
      editor = 'number';
      editorParams = {
        min: typeInfo.min,
        max: typeInfo.max,
        step: typeInfo.min !== undefined && typeInfo.min % 1 !== 0 ? 0.1 : 1
      };
    } else if (typeInfo.editor === 'toggle') {
      editor = 'tickCross';
    }

    // 构建标题，包含字段类型图标和描述
    let title = '';
    const typeIcon = `<span class="field-type-icon" style="color: ${typeInfo.color}; font-size: 0.75rem; margin-right: 4px;" title="类型: ${typeInfo.label}\n${descriptions[key] || ''}">${typeInfo.icon}</span>`;
    const desc = descriptions[key] || (hasRelation ? relation.relatesTo : '');

    if (hasRelation) {
      title = `${typeIcon}<span title="${desc}">${key}</span><span class="relation-badge" data-relation="${relation.relatesTo}" data-target="${relation.targetTable}" title="关联: ${relation.relatesTo}">🔗</span>`;
    } else if (desc) {
      title = `${typeIcon}<span title="${desc}">${key}</span>`;
    } else {
      title = `${typeIcon}<span>${key}</span>`;
    }

    return {
      title: title,
      field: key,
      editor: editor,
      editorParams: editorParams,
      resizable: true,
      headerSort: true,
      headerFilter: 'input',
      headerFilterPlaceholder: '筛选...',
      titleFormatter: function(cell) {
        const container = document.createElement('div');
        container.className = 'col-header-content';
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.justifyContent = 'space-between';
        container.style.width = '100%';
        container.style.gap = '4px';

        const labelWrap = document.createElement('div');
        labelWrap.style.display = 'flex';
        labelWrap.style.alignItems = 'center';
        labelWrap.style.overflow = 'hidden';
        labelWrap.innerHTML = title;

        const actionsWrap = document.createElement('div');
        actionsWrap.className = 'col-header-actions';
        actionsWrap.style.display = 'flex';
        actionsWrap.style.alignItems = 'center';
        actionsWrap.style.gap = '2px';
        actionsWrap.style.flexShrink = '0';

        const filterBtn = document.createElement('button');
        filterBtn.className = 'col-header-btn filter-btn';
        filterBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>';
        filterBtn.title = '筛选 ' + key;
        filterBtn.onclick = (e) => {
          e.stopPropagation();
          showColumnFilter(key, cell.getElement());
        };

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'col-header-btn delete-col-btn';
        deleteBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
        deleteBtn.title = '删除列 ' + key;
        deleteBtn.onclick = (e) => {
          e.stopPropagation();
          if (confirm('确定要删除列 "' + key + '" 吗？')) {
            deleteColumn(key);
          }
        };

        actionsWrap.appendChild(filterBtn);
        actionsWrap.appendChild(deleteBtn);
        container.appendChild(labelWrap);
        container.appendChild(actionsWrap);

        return container;
      },
      formatter: function(cell) {
        const value = cell.getValue();
        const fieldName = cell.getField();
        const displayValue = String(value ?? '');
        const fullValue = displayValue.length > 50 ? displayValue.substring(0, 100) + (displayValue.length > 100 ? '...' : '') : displayValue;

        // null/undefined/空字符串 - 显示为 placeholder 样式
        if (value === null || value === undefined || value === '') {
          const placeholderText = fieldName === 'id' ? '自动生成' : '请输入...';
          return `<span class="cell-placeholder" title="${fieldName}: ${placeholderText}">${placeholderText}</span>`;
        }

        // 布尔值
        if (typeof value === 'boolean') {
          const boolText = value ? 'true' : 'false';
          return `<span class="cell-boolean cell-boolean-${boolText}" title="${fieldName}: ${boolText}">${value ? '✓ true' : '✗ false'}</span>`;
        }

        // 对象/数组
        if (typeof value === 'object') {
          const objStr = JSON.stringify(value);
          const displayStr = objStr.substring(0, 40) + (objStr.length > 40 ? '...' : '');
          return `<span class="cell-object" title="${fieldName}: ${objStr}">${typeInfo.icon} ${displayStr}</span>`;
        }

        // 数字
        if (typeof value === 'number') {
          return `<span class="cell-number" title="${fieldName}: ${value}">${value}</span>`;
        }

        // 枚举字段高亮
        if (isEnumField) {
          return `<span class="cell-enum" style="color: ${typeInfo.color}" title="${fieldName}: ${value}">${value}</span>`;
        }

        // 普通文本 - 添加 title 属性以显示完整内容
        return `<span class="cell-text" title="${fieldName}: ${fullValue}">${value}</span>`;
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

          // 重新计算下一个自动 ID（从 0 开始的最大值 + 1）
          let newId = 0;
          const data = table.getData();
          if (data.length > 0) {
            const maxId = Math.max(...data.map(r => {
              const id = r.id;
              if (typeof id === 'number') return id;
              if (typeof id === 'string') {
                const num = parseInt(id);
                return isNaN(num) ? -1 : num;
              }
              return -1;
            }));
            newId = maxId >= 0 ? maxId + 1 : 0;
          }
          newData.id = newId;

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

// 实时单元格验证
function validateCellRealtime(cell) {
  const field = cell.getField();
  const value = cell.getValue();
  const row = cell.getRow();
  const cellEl = cell.getElement();

  // 清除之前的验证状态
  cellEl.classList.remove('validation-error', 'validation-warning');
  cellEl.removeAttribute('data-validation-message');

  let errors = [];
  let warnings = [];

  // 1. 必填字段检查
  if (field === 'id' && (value === '' || value === null || value === undefined)) {
    errors.push('ID 不能为空');
  }

  // 2. 数值字段检查
  if ((field.includes('damage') || field.includes('hp') || field.includes('speed') ||
       field.includes('Multiplier') || field.includes('Weight') ||
       field.includes('Sec') || field.includes('Interval')) &&
      value !== '' && value !== null && value !== undefined) {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      errors.push('必须是数字');
    } else if (numValue < 0) {
      errors.push('不能为负数');
    }
  }

  // 3. 枚举字段检查
  if (currentConfigType && enumFields[currentConfigType]) {
    const enumValues = enumFields[currentConfigType][field];
    if (enumValues && value !== '' && value !== null && value !== undefined) {
      if (!enumValues.includes(value)) {
        warnings.push(`建议值: ${enumValues.join(', ')}`);
      }
    }
  }

  // 4. 关联字段检查
  if (currentConfigType && fieldRelations[currentConfigType]) {
    const relation = fieldRelations[currentConfigType][field];
    if (relation && relation.targetTable && value) {
      const targetData = loadedConfigs[relation.targetTable];
      if (targetData) {
        const validIds = new Set(targetData.map(item => item.id));
        if (!validIds.has(value)) {
          warnings.push(`关联的 ${relation.relatesTo} 中不存在此值`);
        }
      }
    }
  }

  // 应用验证样式
  if (errors.length > 0) {
    cellEl.classList.add('validation-error');
    cellEl.setAttribute('data-validation-message', errors.join(', '));
    showCellTooltip(cellEl, errors.join(', '), 'error');
  } else if (warnings.length > 0) {
    cellEl.classList.add('validation-warning');
    cellEl.setAttribute('data-validation-message', warnings.join(', '));
    showCellTooltip(cellEl, warnings.join(', '), 'warning');
  }

  // 更新行级错误指示
  updateRowValidationIndicator(row);

  return { valid: errors.length === 0, errors, warnings };
}

// 显示单元格提示
function showCellTooltip(element, message, type) {
  // 移除旧的 tooltip
  const oldTooltip = element.querySelector('.cell-tooltip');
  if (oldTooltip) oldTooltip.remove();

  const tooltip = document.createElement('div');
  tooltip.className = `cell-tooltip cell-tooltip-${type}`;
  tooltip.textContent = message;
  tooltip.style.cssText = `
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.75rem;
    white-space: nowrap;
    z-index: 100;
    pointer-events: none;
    margin-bottom: 4px;
    background: ${type === 'error' ? '#ef4444' : '#f59e0b'};
    color: white;
  `;

  element.style.position = 'relative';
  element.appendChild(tooltip);

  // 3秒后移除
  setTimeout(() => {
    if (tooltip.parentNode) tooltip.remove();
  }, 3000);
}

// 更新行级验证指示器
function updateRowValidationIndicator(row) {
  const rowEl = row.getElement();
  if (!rowEl) return;

  const cells = row.getCells();
  let hasError = false;
  let hasWarning = false;

  cells.forEach(cell => {
    const cellEl = cell.getElement();
    if (cellEl) {
      if (cellEl.classList.contains('validation-error')) hasError = true;
      if (cellEl.classList.contains('validation-warning')) hasWarning = true;
    }
  });

  rowEl.classList.remove('row-validation-error', 'row-validation-warning');
  if (hasError) {
    rowEl.classList.add('row-validation-error');
  } else if (hasWarning) {
    rowEl.classList.add('row-validation-warning');
  }
}

// ============================================================
// 自动保存功能
// ============================================================

function scheduleAutoSave() {
  isDirty = true;
  updateSaveIndicator();

  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
  }

  autoSaveTimer = setTimeout(() => {
    performAutoSave();
  }, AUTO_SAVE_INTERVAL);
}

function performAutoSave() {
  if (!isDirty || currentData.length === 0) return;

  const saveData = {
    timestamp: new Date().toISOString(),
    fileName: currentFileName,
    configType: currentConfigType,
    data: currentData
  };

  localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(saveData));
  lastAutoSaveTime = new Date();
  isDirty = false;
  updateSaveIndicator();

  console.log('自动保存完成:', lastAutoSaveTime.toLocaleTimeString());
}

function updateSaveIndicator() {
  // 在状态栏显示保存状态
  const statusBar = document.getElementById('status-bar');
  if (!statusBar) return;

  const saveIndicator = statusBar.querySelector('.save-indicator') || document.createElement('span');
  saveIndicator.className = 'save-indicator';

  if (isDirty) {
    saveIndicator.innerHTML = ' <span style="color: #f59e0b;">● 未保存</span>';
  } else if (lastAutoSaveTime) {
    saveIndicator.innerHTML = ` <span style="color: #10b981;">✓ ${lastAutoSaveTime.toLocaleTimeString()} 已保存</span>`;
  } else {
    saveIndicator.innerHTML = '';
  }

  if (!statusBar.querySelector('.save-indicator')) {
    statusBar.appendChild(saveIndicator);
  }
}

function loadAutoSave() {
  try {
    const saved = localStorage.getItem(AUTO_SAVE_KEY);
    if (saved) {
      const saveData = JSON.parse(saved);
      return saveData;
    }
  } catch (e) {
    console.error('加载自动保存失败:', e);
  }
  return null;
}

function clearAutoSave() {
  localStorage.removeItem(AUTO_SAVE_KEY);
  isDirty = false;
  lastAutoSaveTime = null;
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
  }
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
    updateNotesPreview(savedNotes);
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
    updateNotesPreview(notes);
    closeModal();
    showToast('备注已保存', 'success');
  });
}

function updateNotesPreview(notes) {
  const previewEl = document.getElementById('header-notes-preview');
  if (!previewEl) return;
  if (notes && notes.trim()) {
    const firstLine = notes.trim().split('\n')[0];
    const truncated = firstLine.length > 30 ? firstLine.substring(0, 30) + '...' : firstLine;
    previewEl.textContent = truncated;
    previewEl.title = notes;
  } else {
    previewEl.textContent = '';
    previewEl.title = '';
  }
}

// ============================================================
// 数据对比功能
// ============================================================

function showCompareView() {
  if (!table || currentData.length === 0) {
    showToast('请先加载数据', 'warning');
    return;
  }

  const comparePanel = document.getElementById('compare-panel');
  const compareResults = document.getElementById('compare-results');

  // 计算差异
  const diffs = computeDataDiff(originalData, currentData);

  if (diffs.length === 0) {
    compareResults.innerHTML = '<div class="compare-empty">✅ 没有变更，当前数据与原始数据一致</div>';
  } else {
    compareResults.innerHTML = generateDiffView(diffs);
  }

  comparePanel.style.display = 'block';
}

function hideCompareView() {
  const comparePanel = document.getElementById('compare-panel');
  comparePanel.style.display = 'none';
}

function computeDataDiff(original, current) {
  const diffs = [];

  // 创建ID到数据的映射
  const originalMap = new Map(original.map((row, idx) => [row.id || idx, { ...row, _index: idx }]));
  const currentMap = new Map(current.map((row, idx) => [row.id || idx, { ...row, _index: idx }]));

  // 检查新增和修改
  current.forEach((currentRow, currentIdx) => {
    const id = currentRow.id || currentIdx;
    const originalRow = originalMap.get(id);

    if (!originalRow) {
      // 新增的行
      diffs.push({
        type: 'added',
        rowIndex: currentIdx,
        current: currentRow
      });
    } else {
      // 检查字段变更
      const fieldDiffs = [];
      const allKeys = new Set([...Object.keys(originalRow), ...Object.keys(currentRow)]);

      allKeys.forEach(key => {
        if (key === '_index') return;
        const oldVal = originalRow[key];
        const newVal = currentRow[key];
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          fieldDiffs.push({
            field: key,
            oldValue: oldVal,
            newValue: newVal
          });
        }
      });

      if (fieldDiffs.length > 0) {
        diffs.push({
          type: 'modified',
          rowIndex: currentIdx,
          current: currentRow,
          fieldDiffs: fieldDiffs
        });
      }
    }
  });

  // 检查删除的行
  original.forEach((originalRow, originalIdx) => {
    const id = originalRow.id || originalIdx;
    if (!currentMap.has(id)) {
      diffs.push({
        type: 'deleted',
        rowIndex: originalIdx,
        original: originalRow
      });
    }
  });

  return diffs.sort((a, b) => a.rowIndex - b.rowIndex);
}

function generateDiffView(diffs) {
  let html = '<div class="compare-summary">';
  const added = diffs.filter(d => d.type === 'added').length;
  const modified = diffs.filter(d => d.type === 'modified').length;
  const deleted = diffs.filter(d => d.type === 'deleted').length;

  html += `<span class="compare-badge added">新增 ${added}</span>`;
  html += `<span class="compare-badge modified">修改 ${modified}</span>`;
  html += `<span class="compare-badge deleted">删除 ${deleted}</span>`;
  html += '</div>';

  html += '<div class="compare-list">';
  diffs.forEach(diff => {
    html += '<div class="compare-item">';

    if (diff.type === 'added') {
      html += `<div class="compare-row-header compare-added">`;
      html += `<span class="compare-type">新增</span>`;
      html += `<span class="compare-row-id">行 ${diff.rowIndex + 1}: ${diff.current.id || '无ID'}</span>`;
      html += `</div>`;
    } else if (diff.type === 'deleted') {
      html += `<div class="compare-row-header compare-deleted">`;
      html += `<span class="compare-type">删除</span>`;
      html += `<span class="compare-row-id">行 ${diff.rowIndex + 1}: ${diff.original.id || '无ID'}</span>`;
      html += `</div>`;
      html += `<div class="compare-fields">`;
      Object.entries(diff.original).forEach(([key, value]) => {
        if (key !== '_index') {
          html += `<div class="compare-field"><span class="field-name">${key}:</span> <span class="field-value deleted">${formatValue(value)}</span></div>`;
        }
      });
      html += `</div>`;
    } else if (diff.type === 'modified') {
      html += `<div class="compare-row-header compare-modified">`;
      html += `<span class="compare-type">修改</span>`;
      html += `<span class="compare-row-id">行 ${diff.rowIndex + 1}: ${diff.current.id || '无ID'}</span>`;
      html += `</div>`;
      html += `<div class="compare-fields">`;
      diff.fieldDiffs.forEach(fieldDiff => {
        html += `<div class="compare-field">`;
        html += `<span class="field-name">${fieldDiff.field}:</span> `;
        html += `<span class="field-value old">${formatValue(fieldDiff.oldValue)}</span>`;
        html += `<span class="compare-arrow">→</span>`;
        html += `<span class="field-value new">${formatValue(fieldDiff.newValue)}</span>`;
        html += `</div>`;
      });
      html += `</div>`;
    }

    html += '</div>';
  });
  html += '</div>';

  return html;
}

function formatValue(value) {
  if (value === null || value === undefined) return '<em>null</em>';
  if (typeof value === 'object') return JSON.stringify(value).substring(0, 50);
  return String(value);
}

// ============================================================
// 全局搜索功能
// ============================================================

let searchResults = [];
let currentSearchIndex = -1;
let searchHighlightTimeout = null;

function toggleGlobalSearch() {
  const panel = document.getElementById('global-search-panel');
  if (panel.style.display === 'none') {
    panel.style.display = 'flex';
    document.getElementById('global-search-input').focus();
  } else {
    hideGlobalSearch();
  }
}

function hideGlobalSearch() {
  const panel = document.getElementById('global-search-panel');
  panel.style.display = 'none';
  clearSearchHighlights();
  searchResults = [];
  currentSearchIndex = -1;
}

function handleSearchKeydown(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (e.shiftKey) {
      navigateSearchResult(-1);
    } else {
      navigateSearchResult(1);
    }
  } else if (e.key === 'Escape') {
    hideGlobalSearch();
  }
}

function handleGlobalSearch() {
  clearSearchHighlights();

  const input = document.getElementById('global-search-input');
  const query = input.value.trim();

  if (!query || !table) {
    updateSearchCount(0);
    return;
  }

  const caseSensitive = document.getElementById('search-case-sensitive').checked;
  const useRegex = document.getElementById('search-regex').checked;
  const wholeWord = document.getElementById('search-whole-word').checked;

  searchResults = performGlobalSearch(query, caseSensitive, useRegex, wholeWord);
  currentSearchIndex = searchResults.length > 0 ? 0 : -1;

  updateSearchCount(searchResults.length);

  if (searchResults.length > 0) {
    highlightSearchResult(searchResults[0]);
  }
}

function performGlobalSearch(query, caseSensitive, useRegex, wholeWord) {
  const results = [];
  const rows = table.getRows();

  let pattern;
  try {
    if (useRegex) {
      const flags = caseSensitive ? 'g' : 'gi';
      pattern = new RegExp(query, flags);
    } else {
      let escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (wholeWord) {
        escaped = `\\b${escaped}\\b`;
      }
      const flags = caseSensitive ? 'g' : 'gi';
      pattern = new RegExp(escaped, flags);
    }
  } catch (e) {
    showToast('无效的正则表达式', 'error');
    return [];
  }

  rows.forEach((row, rowIdx) => {
    const data = row.getData();
    Object.entries(data).forEach(([field, value]) => {
      if (field === '_actions') return;
      const strValue = String(value ?? '');
      if (pattern.test(strValue)) {
        results.push({
          row: row,
          rowIndex: rowIdx,
          field: field,
          value: value
        });
        pattern.lastIndex = 0; // 重置正则 lastIndex
      }
    });
  });

  return results;
}

function highlightSearchResult(result) {
  if (!result) return;

  // 滚动到行
  result.row.scrollTo();

  // 高亮单元格
  const cell = result.row.getCell(result.field);
  if (cell) {
    const cellEl = cell.getElement();
    cellEl.classList.add('search-highlight');

    // 3秒后移除高亮
    if (searchHighlightTimeout) {
      clearTimeout(searchHighlightTimeout);
    }
    searchHighlightTimeout = setTimeout(() => {
      cellEl.classList.remove('search-highlight');
    }, 3000);
  }
}

function clearSearchHighlights() {
  if (!table) return;
  table.getRows().forEach(row => {
    row.getCells().forEach(cell => {
      const el = cell.getElement();
      if (el) el.classList.remove('search-highlight');
    });
  });
}

function navigateSearchResult(direction) {
  if (searchResults.length === 0) return;

  clearSearchHighlights();

  currentSearchIndex += direction;
  if (currentSearchIndex < 0) {
    currentSearchIndex = searchResults.length - 1;
  } else if (currentSearchIndex >= searchResults.length) {
    currentSearchIndex = 0;
  }

  const result = searchResults[currentSearchIndex];
  highlightSearchResult(result);
  updateSearchCount(searchResults.length, currentSearchIndex + 1);
}

function updateSearchCount(total, current = 0) {
  const countEl = document.getElementById('global-search-count');
  if (total === 0) {
    countEl.textContent = '无结果';
    countEl.className = 'global-search-count no-results';
  } else {
    countEl.textContent = current > 0 ? `${current}/${total}` : `${total} 个结果`;
    countEl.className = 'global-search-count';
  }
}

// 防抖函数
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function showBatchEditModal() {
  if (!table) {
    showToast('请先加载数据', 'warning');
    return;
  }

  const selectedRows = table.getSelectedRows();
  const modal = document.getElementById('batch-modal');
  const countSpan = document.getElementById('batch-selected-count');
  const fieldSelect = document.getElementById('batch-field-select');

  // 如果没有选中的行，默认选择所有行
  const targetRows = selectedRows.length > 0 ? selectedRows : table.getRows();
  countSpan.textContent = targetRows.length;

  // 填充字段选择下拉框
  fieldSelect.innerHTML = '<option value="">请选择字段...</option>';
  if (currentData.length > 0) {
    const keys = Object.keys(currentData[0]).filter(key => key !== '_actions');
    keys.forEach(key => {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = key;
      fieldSelect.appendChild(option);
    });
  }

  modal.style.display = 'flex';
}

function hideBatchEditModal() {
  const modal = document.getElementById('batch-modal');
  modal.style.display = 'none';
  // 清空输入
  document.getElementById('batch-field-select').value = '';
  document.getElementById('batch-value-input').value = '';
}

function applyBatchEdit() {
  const fieldSelect = document.getElementById('batch-field-select');
  const valueInput = document.getElementById('batch-value-input');

  const field = fieldSelect.value;
  const newValue = valueInput.value;

  if (!field) {
    showToast('请选择字段', 'warning');
    return;
  }

  if (!table) return;

  const selectedRows = table.getSelectedRows();
  const targetRows = selectedRows.length > 0 ? selectedRows : table.getRows();

  if (targetRows.length === 0) {
    showToast('没有可编辑的行', 'warning');
    return;
  }

  // 根据字段类型转换值
  let convertedValue = newValue;
  const sampleValue = currentData[0]?.[field];
  if (typeof sampleValue === 'number') {
    convertedValue = parseFloat(newValue);
    if (isNaN(convertedValue)) {
      showToast('请输入有效的数字', 'warning');
      return;
    }
  } else if (typeof sampleValue === 'boolean') {
    convertedValue = newValue.toLowerCase() === 'true';
  }

  // 批量更新
  let updatedCount = 0;
  targetRows.forEach(row => {
    row.update({ [field]: convertedValue });
    updatedCount++;
  });

  updateCurrentData();
  highlightChanges();
  saveToHistory();

  showToast(`已批量更新 ${updatedCount} 行的 ${field} 字段`, 'success');
  hideBatchEditModal();
}

// ============================================================
// 导入预览功能
// ============================================================

let pendingImportData = null;
let previewTable = null;

function showImportPreview(data) {
  pendingImportData = data;

  const modal = document.getElementById('import-preview-modal');
  const infoEl = document.getElementById('import-preview-info');
  const conflictsEl = document.getElementById('import-preview-conflicts');
  const tableWrapper = document.getElementById('import-preview-table');

  // 显示基本信息
  infoEl.innerHTML = `
    <p><strong>文件名:</strong> ${currentFileName}</p>
    <p><strong>记录数:</strong> ${data.length} 条</p>
    <p><strong>配置类型:</strong> ${currentConfigType || '未知'}</p>
  `;

  // 检查冲突（重复ID）
  const conflicts = checkImportConflicts(data);
  if (conflicts.length > 0) {
    conflictsEl.innerHTML = `
      <div class="import-conflicts-warning">
        <strong>⚠️ 发现 ${conflicts.length} 个重复ID:</strong>
        <ul>${conflicts.map(c => `<li>ID "${c.id}" 出现 ${c.count} 次</li>`).join('')}</ul>
      </div>
    `;
  } else {
    conflictsEl.innerHTML = '<div class="import-no-conflicts">✅ 未发现重复ID</div>';
  }

  // 销毁旧的预览表格
  if (previewTable) {
    previewTable.destroy();
  }

  // 创建预览表格（只显示前5行）
  const previewData = data.slice(0, 5);
  const allKeys = new Set();
  data.forEach(row => Object.keys(row).forEach(key => allKeys.add(key)));

  const columns = Array.from(allKeys).map(key => ({
    title: key,
    field: key,
    formatter: function(cell) {
      const value = cell.getValue();
      if (value === null || value === undefined) return '<span style="color: #94a3b8;">null</span>';
      if (typeof value === 'object') return JSON.stringify(value).substring(0, 50) + '...';
      return String(value).substring(0, 50);
    }
  }));

  previewTable = new Tabulator('#import-preview-table', {
    data: previewData,
    columns: columns,
    layout: 'fitColumns',
    height: '250px'
  });

  modal.style.display = 'flex';

  // 绑定预览弹窗事件
  document.getElementById('import-preview-close').onclick = hideImportPreview;
  document.getElementById('import-preview-cancel').onclick = hideImportPreview;
  document.getElementById('import-preview-confirm').onclick = confirmImport;
}

function hideImportPreview() {
  const modal = document.getElementById('import-preview-modal');
  modal.style.display = 'none';
  pendingImportData = null;
  if (previewTable) {
    previewTable.destroy();
    previewTable = null;
  }
}

function confirmImport() {
  if (!pendingImportData) return;

  loadData(pendingImportData);

  // 保存到已加载配置（用于跨表验证）
  if (currentConfigType) {
    loadedConfigs[currentConfigType] = pendingImportData;
  }

  historyManager.clear(); // 清除历史记录

  showToast(`成功导入 ${pendingImportData.length} 条记录`, 'success');
  hideImportPreview();
}

function checkImportConflicts(data) {
  const idCounts = {};
  data.forEach(row => {
    const id = row.id;
    if (id !== undefined && id !== null && id !== '') {
      idCounts[id] = (idCounts[id] || 0) + 1;
    }
  });

  return Object.entries(idCounts)
    .filter(([_, count]) => count > 1)
    .map(([id, count]) => ({ id, count }));
}

// ============================================================
// 快捷键帮助功能
// ============================================================

function showShortcutsModal() {
  const modal = document.getElementById('shortcuts-modal');
  const closeBtn = document.getElementById('shortcuts-close');

  modal.style.display = 'flex';

  closeBtn.onclick = () => {
    modal.style.display = 'none';
  };

  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  };

  // ESC 关闭
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      modal.style.display = 'none';
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

// ============================================================
// 单元格悬浮提示功能
// ============================================================

let currentTooltip = null;
let tooltipTimeout = null;

function initCellTooltip() {
  const tableContainer = document.getElementById('config-table');
  if (!tableContainer) return;

  tableContainer.addEventListener('mouseover', handleCellMouseOver);
  tableContainer.addEventListener('mouseout', handleCellMouseOut);
  tableContainer.addEventListener('mousemove', handleCellMouseMove);
}

function handleCellMouseOver(e) {
  const cell = e.target.closest('.tabulator-cell');
  if (!cell) return;

  // 获取单元格内的 span 元素
  const span = cell.querySelector('span[class^="cell-"]');
  if (!span) return;

  // 获取 title 属性
  const title = span.getAttribute('title');
  if (!title) return;

  // 检查内容是否被截断
  const isTruncated = span.scrollWidth > span.clientWidth;

  // 延迟显示 tooltip
  tooltipTimeout = setTimeout(() => {
    showCellTooltip(title, cell);
  }, 500);
}

function handleCellMouseOut(e) {
  const cell = e.target.closest('.tabulator-cell');
  if (!cell) return;

  // 清除延迟显示
  if (tooltipTimeout) {
    clearTimeout(tooltipTimeout);
    tooltipTimeout = null;
  }

  // 隐藏 tooltip
  hideCellTooltip();
}

function handleCellMouseMove(e) {
  // 如果 tooltip 已显示，更新位置
  if (currentTooltip) {
    updateTooltipPosition(e.clientX, e.clientY);
  }
}

function showCellTooltip(content, cellElement) {
  // 移除现有的 tooltip
  hideCellTooltip();

  // 创建新的 tooltip
  currentTooltip = document.createElement('div');
  currentTooltip.className = 'cell-tooltip';
  currentTooltip.textContent = content;
  document.body.appendChild(currentTooltip);

  // 定位 tooltip
  const rect = cellElement.getBoundingClientRect();
  currentTooltip.style.left = `${rect.left}px`;
  currentTooltip.style.top = `${rect.bottom + 4}px`;
}

function updateTooltipPosition(x, y) {
  if (!currentTooltip) return;

  // 简单的跟随鼠标，但保持在视窗内
  const tooltipRect = currentTooltip.getBoundingClientRect();
  let left = x;
  let top = y + 20;

  // 防止超出视窗右侧
  if (left + tooltipRect.width > window.innerWidth) {
    left = window.innerWidth - tooltipRect.width - 10;
  }

  // 防止超出视窗底部
  if (top + tooltipRect.height > window.innerHeight) {
    top = y - tooltipRect.height - 10;
  }

  currentTooltip.style.left = `${left}px`;
  currentTooltip.style.top = `${top}px`;
}

function hideCellTooltip() {
  if (currentTooltip) {
    currentTooltip.remove();
    currentTooltip = null;
  }
}

function updateCellTooltip(cell) {
  // 单元格编辑后更新 title 属性
  const cellElement = cell.getElement();
  if (!cellElement) return;

  const span = cellElement.querySelector('span[class^="cell-"]');
  if (!span) return;

  const value = cell.getValue();
  const fieldName = cell.getField();
  const displayValue = String(value ?? '');
  const fullValue = displayValue.length > 50 ? displayValue.substring(0, 100) + (displayValue.length > 100 ? '...' : '') : displayValue;

  if (value === null || value === undefined || value === '') {
    const placeholderText = fieldName === 'id' ? '自动生成' : '请输入...';
    span.setAttribute('title', `${fieldName}: ${placeholderText}`);
  } else {
    span.setAttribute('title', `${fieldName}: ${fullValue}`);
  }
}

// 初始化 tooltip
window.addEventListener('load', initCellTooltip);
