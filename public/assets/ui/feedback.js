// Toast, loading placeholder and error box.

import { app, toastEl } from '../core/dom.js';
import { esc } from '../core/utils.js';
import { ApiError } from '../api.js';

export function toast(message, isError = false) {
  toastEl.textContent = message;
  toastEl.className = `toast is-visible${isError ? ' is-error' : ''}`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toastEl.className = 'toast';
  }, 3200);
}

export function loading() {
  app.innerHTML = '<div class="loading"><span class="spinner"></span> Đang tải…</div>';
}

export function errorBox(err) {
  const message = err instanceof ApiError ? err.message : err && err.message ? err.message : String(err);
  const code = err instanceof ApiError && err.code ? ` <span class="u-dimmed">(${esc(err.code)})</span>` : '';
  return `<div class="error-box">${esc(message)}${code}</div>`;
}
