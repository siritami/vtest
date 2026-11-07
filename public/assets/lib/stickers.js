// Sticker albums, ported from the "Voz Emoji" userscript (v2.3, GM_setValue/GM_getValue)
// to browser localStorage so the same feature set works inside this client.
//
// Storage keys (mirrors the userscript, namespaced under voz-stickers):
//   voz-stickers:v1            → album list (see normalizeAlbum)
//   voz-stickers:recent:v1     → recently used stickers
//   voz-stickers:clientId:v1   → imgur Client-ID override

const ALBUM_KEY = 'voz-stickers:v1';
const RECENT_KEY = 'voz-stickers:recent:v1';
const CLIENT_KEY = 'voz-stickers:clientId:v1';

export const MAX_RECENT = 30;
export const PARALLEL_DOWNLOADS = 5;
// Same fallback Client-ID the userscript shipped with; users can override it in settings.
export const DEFAULT_CLIENT_ID = '66850c248e91c93';
export const MAX_ALBUMS = 100;
export const MAX_IMAGES = 500;
export const MAX_NAME = 60;
const MAX_BASE64 = 400_000;

export function makeStickerId(prefix = 'a') {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Storage full or disabled; the caller keeps the in-memory copy. */
  }
}

export function getClientId() {
  const stored = readJson(CLIENT_KEY, null);
  return typeof stored === 'string' && stored.trim() ? stored.trim() : DEFAULT_CLIENT_ID;
}

export function setClientId(value) {
  const id = String(value ?? '').trim().slice(0, 64);
  writeJson(CLIENT_KEY, id || DEFAULT_CLIENT_ID);
  return getClientId();
}

export function resetClientId() {
  writeJson(CLIENT_KEY, DEFAULT_CLIENT_ID);
  return DEFAULT_CLIENT_ID;
}

// https URLs only, or a data:image base64 preview. Never javascript:/http:.
export function normalizeStickerUrl(value) {
  const raw = String(value ?? '').trim();
  if (!raw || raw.length > 1000) return null;
  if (/^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,/i.test(raw)) return raw;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return null;
    if (url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

function normalizeBase64(value) {
  const raw = String(value ?? '').trim();
  if (!raw.startsWith('data:image/') || raw.length > MAX_BASE64) return null;
  return raw;
}

export function normalizeStickerImage(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const url = normalizeStickerUrl(raw.url);
  if (!url) return null;
  return {
    url,
    base64: normalizeBase64(raw.base64),
    deleteUrl: typeof raw.deleteUrl === 'string' && /^https:\/\//.test(raw.deleteUrl) ? raw.deleteUrl : null,
  };
}

export function normalizeAlbum(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = String(raw.name ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
  if (!name) return null;
  const images = (Array.isArray(raw.images) ? raw.images : []).slice(0, MAX_IMAGES).map(normalizeStickerImage).filter(Boolean);
  if (!images.length) return null;
  const type = raw.type === 'pikvn' ? 'pikvn' : 'imgur';
  const album = {
    id: typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 64) : makeStickerId(),
    name,
    type,
    preview: normalizeBase64(raw.preview) || images[0].base64 || images[0].url,
    images,
    savedAt: typeof raw.savedAt === 'string' ? raw.savedAt : new Date().toISOString(),
  };
  if (type === 'imgur') {
    const link = normalizeStickerUrl(raw.link);
    if (link) album.link = link;
    if (typeof raw.albumId === 'string' && /^[\w-]{1,32}$/.test(raw.albumId)) album.albumId = raw.albumId;
  }
  return album;
}

export function getAlbums() {
  const list = readJson(ALBUM_KEY, []);
  return (Array.isArray(list) ? list : []).map(normalizeAlbum).filter(Boolean);
}

export function saveAlbums(albums) {
  const clean = (Array.isArray(albums) ? albums : []).slice(0, MAX_ALBUMS).map(normalizeAlbum).filter(Boolean);
  writeJson(ALBUM_KEY, clean);
  return clean;
}

export function addAlbum(album) {
  const clean = normalizeAlbum(album);
  if (!clean) return { ok: false, error: 'Album không hợp lệ: cần tên và ít nhất một hình ảnh.' };
  const albums = getAlbums();
  if (albums.length >= MAX_ALBUMS) return { ok: false, error: `Tối đa ${MAX_ALBUMS} album.` };
  albums.push(clean);
  saveAlbums(albums);
  return { ok: true, album: clean, albums };
}

export function updateAlbum(id, patch) {
  const albums = getAlbums();
  const index = albums.findIndex((album) => album.id === id);
  if (index < 0) return { ok: false, error: 'Không tìm thấy album.' };
  const merged = normalizeAlbum({ ...albums[index], ...patch, id });
  if (!merged) return { ok: false, error: 'Album không hợp lệ: cần tên và ít nhất một hình ảnh.' };
  albums[index] = merged;
  saveAlbums(albums);
  return { ok: true, album: merged, albums };
}

export function renameAlbum(id, name) {
  const clean = String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
  if (!clean) return { ok: false, error: 'Tên album không được để trống.' };
  return updateAlbum(id, { name: clean });
}

export function removeAlbum(id) {
  const albums = getAlbums().filter((album) => album.id !== id);
  saveAlbums(albums);
  return albums;
}

export function removeAlbums(ids) {
  const drop = new Set(ids);
  const albums = getAlbums().filter((album) => !drop.has(album.id));
  saveAlbums(albums);
  return albums;
}

export function moveAlbum(id, toIndex) {
  const albums = getAlbums();
  const from = albums.findIndex((album) => album.id === id);
  if (from < 0) return albums;
  const target = Math.max(0, Math.min(albums.length - 1, toIndex));
  if (from === target) return albums;
  const [album] = albums.splice(from, 1);
  albums.splice(target, 0, album);
  return saveAlbums(albums);
}

export function setAlbumImages(id, images) {
  const clean = (Array.isArray(images) ? images : []).map(normalizeStickerImage).filter(Boolean);
  if (!clean.length) return { ok: false, error: 'Album cần ít nhất một hình ảnh.' };
  return updateAlbum(id, { images: clean, preview: clean[0].base64 || clean[0].url });
}

// Recent stickers are ordered newest-first and deduplicated by URL.
export function getRecentStickers() {
  const list = readJson(RECENT_KEY, []);
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => (typeof item === 'string' ? { url: item, base64: null } : item))
    .map(normalizeStickerImage)
    .filter(Boolean)
    .slice(0, MAX_RECENT);
}

export function addRecentSticker(url, base64 = null) {
  const sticker = normalizeStickerImage({ url, base64 });
  if (!sticker) return getRecentStickers();
  const recent = getRecentStickers().filter((item) => item.url !== sticker.url);
  recent.unshift(sticker);
  const trimmed = recent.slice(0, MAX_RECENT);
  writeJson(RECENT_KEY, trimmed);
  return trimmed;
}

export function removeRecentSticker(url) {
  const recent = getRecentStickers().filter((item) => item.url !== url);
  writeJson(RECENT_KEY, recent);
  return recent;
}

export function clearRecentStickers() {
  writeJson(RECENT_KEY, []);
  return [];
}

// Downscale to at most 400px and re-encode as WebP, exactly like the userscript.
// GIFs are returned as-is so animation survives.
export async function imageFileToBase64(file, maxSize = 400, quality = 0.8) {
  if (file.type === 'image/gif') return readAsDataUrl(file);
  const dataUrl = await readAsDataUrl(file);
  return downscaleDataUrl(dataUrl, maxSize, quality);
}

export async function downscaleDataUrl(dataUrl, maxSize = 400, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;
      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height);
        width = Math.max(1, Math.round(width * ratio));
        height = Math.max(1, Math.round(height * ratio));
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);
      try {
        resolve(canvas.toDataURL('image/webp', quality));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('Không đọc được hình ảnh'));
    img.src = dataUrl;
  });
}

export function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Không đọc được tệp'));
    reader.readAsDataURL(file);
  });
}

// Fetch a remote image and cache it as a downscaled data URL (userscript's urlToBase64).
export async function urlToBase64(url, { signal } = {}) {
  const response = await fetch(url, { signal, mode: 'cors', credentials: 'omit' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const blob = await response.blob();
  const dataUrl = await readAsDataUrl(blob);
  return downscaleDataUrl(dataUrl);
}

// Bounded-concurrency batch conversion, mirroring PARALLEL_DOWNLOADS.
export async function downloadImagesInParallel(urls, { onProgress } = {}) {
  const base64Images = [];
  const errors = [];
  for (let i = 0; i < urls.length; i += PARALLEL_DOWNLOADS) {
    const batch = urls.slice(i, i + PARALLEL_DOWNLOADS);
    const results = await Promise.all(
      batch.map(async (url) => {
        try {
          return { url, base64: await urlToBase64(url), error: null };
        } catch (error) {
          return { url, base64: null, error };
        }
      })
    );
    for (const result of results) {
      if (result.error) errors.push({ url: result.url, error: result.error });
      else base64Images.push({ url: result.url, base64: result.base64 });
    }
    if (onProgress) onProgress(Math.min(i + PARALLEL_DOWNLOADS, urls.length), urls.length, errors.length);
  }
  return { base64Images, errors };
}

export function albumToStickerCount(album) {
  return album?.images?.length || 0;
}

export function findAlbum(id) {
  return getAlbums().find((album) => album.id === id) || null;
}
