/**
 * 工具函数模块
 */

// Toast 通知系统
export function showToast(message, type = 'info') {
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

// 防抖函数
export function debounce(func, wait) {
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

// 格式化值显示
export function formatValue(value) {
  if (value === null || value === undefined) return '<em>null</em>';
  if (typeof value === 'object') return JSON.stringify(value).substring(0, 50);
  return String(value);
}
