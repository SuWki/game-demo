/**
 * 撤销/重做管理器模块
 */

export class HistoryManager {
  constructor(maxSize = 50) {
    this.undoStack = [];
    this.redoStack = [];
    this.maxSize = maxSize;
    this.isUndoing = false;
  }

  push(action) {
    if (this.isUndoing) return;
    this.undoStack.push(action);
    this.redoStack = [];
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
