// Browser-local preferences. Nothing here is sent to voz.vn — it lives in
// localStorage so it survives reloads and is included in JSON backup/restore.

const KEY = 'voz-settings:v1';
const MAX_SHORTCUTS = 200;
const MAX_NAME = 40;

export function makeId() {
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

// Absolute http(s) URLs or site-relative paths only; never javascript:/data:.
export function normalizeUrl(value) {
  const raw = String(value ?? '').trim();
  if (!raw || raw.length > 500) return null;
  if (/^\/(?!\/)/.test(raw)) return raw.replace(/[\s"<>`]/g, '');
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function normalizeShortcut(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = String(raw.name ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
  const url = normalizeUrl(raw.url);
  if (!name || !url) return null;
  const id = typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 64) : makeId();
  return { id, name, url };
}

export const emptySettings = () => ({ version: 1, navShortcuts: [] });

// Shown until the user edits the list; saved on first change so removals stick.
export const DEFAULT_SHORTCUTS = [
  { name: 'F33', url: '/f/diem-bao.33/' },
  { name: 'F17', url: '/f/chuyen-tro-linh-tinh.17/' },
];

export function normalizeSettings(raw) {
  const out = emptySettings();
  const list = Array.isArray(raw?.navShortcuts) ? raw.navShortcuts : [];
  const seen = new Set();
  for (const item of list.slice(0, MAX_SHORTCUTS)) {
    const shortcut = normalizeShortcut(item);
    if (!shortcut || seen.has(shortcut.id)) continue;
    seen.add(shortcut.id);
    out.navShortcuts.push(shortcut);
  }
  return out;
}

export function loadSettings() {
  try {
    const stored = localStorage.getItem(KEY);
    if (!stored) return normalizeSettings({ navShortcuts: DEFAULT_SHORTCUTS });
    return normalizeSettings(JSON.parse(stored));
  } catch {
    return emptySettings();
  }
}

export function saveSettings(next) {
  const settings = normalizeSettings(next);
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* Storage may be full or disabled; keep the in-memory result. */
  }
  window.dispatchEvent(new CustomEvent('voz:settings', { detail: settings }));
  return settings;
}

export function addShortcut(name, url) {
  const shortcut = normalizeShortcut({ name, url });
  if (!shortcut) return { ok: false, error: 'Nhập tên và liên kết http(s) hoặc đường dẫn bắt đầu bằng /.' };
  const settings = loadSettings();
  if (settings.navShortcuts.length >= MAX_SHORTCUTS) return { ok: false, error: `Tối đa ${MAX_SHORTCUTS} phím tắt.` };
  settings.navShortcuts.push(shortcut);
  saveSettings(settings);
  return { ok: true, shortcut, settings };
}

export function updateShortcut(id, patch) {
  const settings = loadSettings();
  const index = settings.navShortcuts.findIndex((item) => item.id === id);
  if (index < 0) return { ok: false, error: 'Không tìm thấy phím tắt.' };
  const merged = normalizeShortcut({ ...settings.navShortcuts[index], ...patch });
  if (!merged) return { ok: false, error: 'Nhập tên và liên kết http(s) hoặc đường dẫn bắt đầu bằng /.' };
  merged.id = settings.navShortcuts[index].id;
  settings.navShortcuts[index] = merged;
  saveSettings(settings);
  return { ok: true, settings };
}

export function removeShortcut(id) {
  const settings = loadSettings();
  settings.navShortcuts = settings.navShortcuts.filter((item) => item.id !== id);
  saveSettings(settings);
  return settings;
}

export function moveShortcut(id, toIndex) {
  const settings = loadSettings();
  const from = settings.navShortcuts.findIndex((item) => item.id === id);
  if (from < 0) return settings;
  const target = Math.max(0, Math.min(settings.navShortcuts.length - 1, toIndex));
  if (from === target) return settings;
  const [item] = settings.navShortcuts.splice(from, 1);
  settings.navShortcuts.splice(target, 0, item);
  return saveSettings(settings);
}

export function exportSettingsJson({ albums = [], recent = [], clientId } = {}) {
  const settings = loadSettings();
  const payload = {
    app: 'voz-web',
    version: 1,
    exportedAt: new Date().toISOString(),
    navShortcuts: settings.navShortcuts,
  };
  // Sticker payload mirrors the userscript backup so either file can be restored.
  if (albums.length || recent.length || clientId) {
    payload.version = '1.2';
    payload.albums = albums;
    payload.recent = recent;
    payload.clientId = clientId;
  }
  return JSON.stringify(payload, null, 2);
}

export function importSettingsJson(text) {
  let parsed;
  try {
    parsed = JSON.parse(String(text ?? ''));
  } catch {
    return { ok: false, error: 'JSON không hợp lệ.' };
  }
  const source = parsed && typeof parsed === 'object' && parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : parsed;
  if (!source || typeof source !== 'object') {
    return { ok: false, error: 'JSON phải là một object.' };
  }
  // A sticker backup from the userscript has no navShortcuts — accept it as album-only.
  const albumSource = Array.isArray(source.albums) ? source.albums : null;
  if (!Array.isArray(source.navShortcuts) && !albumSource) {
    return { ok: false, error: 'JSON phải có mảng "navShortcuts" hoặc "albums".' };
  }
  const settings = Array.isArray(source.navShortcuts) ? normalizeSettings(source) : null;
  if (settings && source.navShortcuts.length && !settings.navShortcuts.length) {
    return { ok: false, error: 'Không có phím tắt hợp lệ trong JSON (tên rỗng hoặc liên kết sai).' };
  }
  if (settings) saveSettings(settings);
  return {
    ok: true,
    count: settings ? settings.navShortcuts.length : 0,
    settings: settings || loadSettings(),
    albums: albumSource,
    recent: Array.isArray(source.recent) ? source.recent : null,
    clientId: typeof source.clientId === 'string' ? source.clientId : null,
    addOnly: source.addOnly === true,
  };
}
