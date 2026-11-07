// pik.vn image hosting, ported from the "Voz Emoji" userscript's 5.pik.vn bridge.
//
// The userscript loaded https://5.pik.vn/ in an iframe and posted the image to it with
// postMessage, because it needed that origin to reach /api/upload and wait for a
// Cloudflare Turnstile token. pik.vn has since moved to https://pik.vn and its uploader
// is now an open `POST /api/upload` (multipart: file + hash + format) with no token, but
// it still sends no CORS headers, so the browser cannot call it directly. We relay the
// request through our own edge proxy instead (`POST /api/pik/upload`).
//
// Server-side rules verified against pik.vn: the payload must be WebP (GIF is rejected),
// the `hash` field must be the SHA-256 of the exact bytes sent, long edges are capped at
// 1920px, and the same bytes are deduplicated by hash (`exists: true` reuses the URL).

export const PIK_PROXY = '/api/pik/upload';
// Mirrors pik.vn's own client constants.
export const PIK_MAX_SIZE = 1920;
export const PIK_QUALITY = 0.85;
export const PIK_ORIGINAL_MAX = 16384;
export const PIK_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/avif'];
export const PIK_PARALLEL = 3;
const MAX_BYTES = 12 * 1024 * 1024;

export function isPikImage(file) {
  return !!file && PIK_TYPES.includes(file.type) && file.size > 0;
}

// png/webp keep alpha in WebP, so the only reason to prefer JPEG is a browser that cannot
// encode WebP at all — the same fallback pik.vn itself uses.
let webpSupport = null;
export function supportsWebp() {
  if (webpSupport) return webpSupport;
  webpSupport = new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 2;
    try {
      canvas.toBlob((blob) => resolve(!!blob && blob.type === 'image/webp'), 'image/webp');
    } catch {
      resolve(false);
    }
  });
  return webpSupport;
}

export async function sha256Hex(buffer) {
  const view = new Uint8Array(await crypto.subtle.digest('SHA-256', buffer));
  // Indexed loop, not spread: spreading a cross-compartment typed array is blocked
  // (and slow) under Firefox's Xray vision.
  let hex = '';
  for (let i = 0; i < view.length; i++) hex += view[i].toString(16).padStart(2, '0');
  return hex;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Không đọc được ảnh.'));
    };
    image.src = url;
  });
}

// Downscales and re-encodes to what pik.vn accepts. GIFs are flattened to WebP because
// the server rejects the GIF container; that is also what pik.vn's own uploader does.
export async function preparePikImage(file) {
  if (!isPikImage(file)) throw new Error('Chỉ hỗ trợ JPEG, PNG, WebP, GIF, BMP hoặc AVIF.');
  if (file.size > MAX_BYTES) throw new Error('Ảnh quá lớn (tối đa 12 MB).');
  const format = (await supportsWebp()) ? 'webp' : 'jpeg';
  const image = await loadImage(file);
  const { naturalWidth: width, naturalHeight: height } = image;
  if (!width || !height) throw new Error('Ảnh không hợp lệ.');
  if (Math.max(width, height) > PIK_ORIGINAL_MAX) throw new Error('Ảnh vượt quá 16384px.');
  const scale = Math.min(1, PIK_MAX_SIZE / Math.max(width, height));
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext('2d');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  // JPEG has no alpha channel; fill white so transparent PNGs do not turn black.
  if (format === 'jpeg') {
    context.fillStyle = '#fff';
    context.fillRect(0, 0, targetWidth, targetHeight);
  }
  context.drawImage(image, 0, 0, targetWidth, targetHeight);
  const mime = `image/${format}`;
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => (result ? resolve(result) : reject(new Error('Không mã hoá được ảnh.'))), mime, PIK_QUALITY);
  });
  if (blob.type !== mime) throw new Error('Trình duyệt không mã hoá được ảnh này.');
  return { blob, format, width: targetWidth, height: targetHeight, originalWidth: width, originalHeight: height };
}

// Uploads one already-prepared image through the proxy and returns its hosted URL.
export async function uploadPikBlob(blob, { format = 'webp', name = 'image' } = {}) {
  const hash = await sha256Hex(await blob.arrayBuffer());
  const body = new FormData();
  body.append('file', blob, `${hash}.${format === 'jpeg' ? 'jpg' : format}`);
  body.append('hash', hash);
  body.append('format', format);
  body.append('name', name.slice(0, 120));
  const response = await fetch(PIK_PROXY, { method: 'POST', body, credentials: 'same-origin' });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok || !payload?.url) {
    const message = payload?.error || `Tải ảnh lên thất bại (${response.status}).`;
    throw new Error(message);
  }
  return { url: payload.url, deleteUrl: payload.deleteUrl || '', exists: !!payload.exists };
}

// End-to-end: validate, resize/encode, upload. Used by the toolbar, paste and drop.
export async function uploadImageFile(file) {
  const prepared = await preparePikImage(file);
  const uploaded = await uploadPikBlob(prepared.blob, { format: prepared.format, name: file.name || 'image' });
  return { ...uploaded, ...prepared };
}

// Files are processed a few at a time so a big paste does not flood the proxy.
export async function uploadImageFiles(files, onProgress) {
  const list = [...files].filter(isPikImage);
  const skipped = [...files].length - list.length;
  const results = [];
  let done = 0;
  const run = async (file) => {
    try {
      const uploaded = await uploadImageFile(file);
      results.push({ ok: true, file, ...uploaded });
    } catch (error) {
      results.push({ ok: false, file, error: error.message || 'Tải ảnh lên thất bại.' });
    } finally {
      done += 1;
      onProgress?.(done, list.length);
    }
  };
  let cursor = 0;
  const workers = Array.from({ length: Math.min(PIK_PARALLEL, list.length) }, async () => {
    while (cursor < list.length) await run(list[cursor++]);
  });
  await Promise.all(workers);
  return { results, skipped };
}

// BBCode for one hosted image, matching what voz.vn stores for a plain upload.
export function pikBbcode(url) {
  return `[IMG]${url}[/IMG]`;
}
