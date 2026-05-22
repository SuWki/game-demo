/**
 * 搜索模块 - 全局搜索功能
 */

import { showToast } from './utils.js';

export class SearchManager {
  constructor(table) {
    this.table = table;
    this.results = [];
    this.currentIndex = -1;
    this.highlightTimeout = null;
  }

  setTable(table) {
    this.table = table;
  }

  search(query, options = {}) {
    this.clearHighlights();

    const { caseSensitive = false, useRegex = false, wholeWord = false } = options;

    if (!query || !this.table) {
      return [];
    }

    this.results = this.performSearch(query, caseSensitive, useRegex, wholeWord);
    this.currentIndex = this.results.length > 0 ? 0 : -1;

    if (this.results.length > 0) {
      this.highlightResult(this.results[0]);
    }

    return this.results;
  }

  performSearch(query, caseSensitive, useRegex, wholeWord) {
    const results = [];
    const rows = this.table.getRows();

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
          pattern.lastIndex = 0;
        }
      });
    });

    return results;
  }

  highlightResult(result) {
    if (!result) return;

    result.row.scrollTo();

    const cell = result.row.getCell(result.field);
    if (cell) {
      const cellEl = cell.getElement();
      cellEl.classList.add('search-highlight');

      if (this.highlightTimeout) {
        clearTimeout(this.highlightTimeout);
      }
      this.highlightTimeout = setTimeout(() => {
        cellEl.classList.remove('search-highlight');
      }, 3000);
    }
  }

  clearHighlights() {
    if (!this.table) return;
    this.table.getRows().forEach(row => {
      row.getCells().forEach(cell => {
        const el = cell.getElement();
        if (el) el.classList.remove('search-highlight');
      });
    });
  }

  navigate(direction) {
    if (this.results.length === 0) return null;

    this.clearHighlights();

    this.currentIndex += direction;
    if (this.currentIndex < 0) {
      this.currentIndex = this.results.length - 1;
    } else if (this.currentIndex >= this.results.length) {
      this.currentIndex = 0;
    }

    const result = this.results[this.currentIndex];
    this.highlightResult(result);
    return result;
  }

  getCurrentIndex() {
    return this.currentIndex;
  }

  getResultsCount() {
    return this.results.length;
  }
}
