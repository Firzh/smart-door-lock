import { CONFIG } from '../config/config.js';

export function showToast(message, type = 'info', duration = 3200) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  window.setTimeout(() => {
    toast.remove();
  }, duration);
}

export function debugLog(checkpoint, message, detail) {
  if (!CONFIG.APP?.DEBUG) return;
  const prefix = `[DEBUG ${checkpoint}] ${message}`;
  if (detail !== undefined) {
    console.log(prefix, detail);
  } else {
    console.log(prefix);
  }
}

export function debugError(checkpoint, message, detail) {
  if (!CONFIG.APP?.DEBUG) return;
  const prefix = `[DEBUG ${checkpoint}] ${message}`;
  if (detail !== undefined) {
    console.error(prefix, detail);
  } else {
    console.error(prefix);
  }
}
