// "Tắt ảnh động ảnh đại diện" — freezes an animated avatar on its first frame.
//
// voz.vn lets members upload an animated GIF as their avatar and serves it from data.voz.vn.
// The extension lies: /avatars/l/15/15207.jpg is really a 53-frame looping GIF, so the URL
// cannot be used to recognise an animated avatar — the bytes have to be inspected.
//
// Two things this must get right:
//   - Only an *animated* avatar is replaced. A still avatar is left exactly as voz.vn served
//     it, so enabling the setting costs nothing visually for members with ordinary pictures.
//   - The still is decoded from the *blob*, not from the live <img>. Drawing the element
//     captures whichever frame happens to be on screen at that instant, which is not
//     necessarily the first one.
//
// The freeze happens in the page rather than in CSS: the `image-set()`/`cross-fade()` tricks
// that can stop a GIF are Chromium-only and would silently do nothing in Firefox, the browser
// this project is verified against.
import { getStaticAvatars } from './settings.js';

// data.voz.vn sends no CORS headers, so the bytes must come through the same-origin proxy;
// fetching an avatar directly would always fail and leave the animation running.
// One entry per avatar URL, holding the in-flight promise or its result. The same member
// appears several times on one page (post sidebar, thread rows, member cards) and those
// elements are processed in the same tick, so caching only the *result* would still download
// the file once per occurrence.
//   Promise  -> still being resolved; every caller awaits the same fetch
//   string   -> a frozen still (data URL)
//   null     -> leave this avatar alone (it is static, or it cannot be read)
const stills = new Map();

// Avatars already handed to `freeze()`. A WeakSet so a re-rendered view does not leak.
const seen = new WeakSet();

// Bytes needed to decide a format before downloading the whole file: a GIF's block structure
// and a WebP/PNG header all sit at the front, and the last frame's image data does not need to
// be read to know how many frames there are. 64 KiB comfortably covers the header of a large
// animated avatar while being small enough to fetch for every avatar on a list page.
const SNIFF_BYTES = 65_536;

function proxyUrl(url, limit = 0) {
  const query = `/api/image-download?url=${encodeURIComponent(url)}`;
  return limit ? `${query}&limit=${limit}` : query;
}

// --- format sniffing -------------------------------------------------------
//
// These read the raw bytes, before any decoding, so a still avatar is recognised without
// paying for a canvas round trip. All three animated containers voz.vn could plausibly serve
// are covered; anything else is static by construction.

function readAscii(bytes, start, length) {
  let text = '';
  for (let i = start; i < start + length && i < bytes.length; i += 1) text += String.fromCharCode(bytes[i]);
  return text;
}

// Walks the GIF block structure rather than counting byte patterns: 0x2C appears inside LZW
// image data too, so a naive scan reports "animated" for a single-frame GIF.
export function gifFrameCount(bytes) {
  if (readAscii(bytes, 0, 3) !== 'GIF') return 0;
  let i = 6;
  const packed = bytes[i + 4];
  i += 7;
  if (packed & 0x80) i += 3 * (1 << ((packed & 0x07) + 1));
  let frames = 0;
  const skipSubBlocks = () => {
    while (i < bytes.length) {
      const size = bytes[i];
      i += 1;
      if (!size) return;
      i += size;
    }
  };
  while (i < bytes.length) {
    const marker = bytes[i];
    if (marker === 0x3b) break;
    if (marker === 0x21) {
      i += 2;
      skipSubBlocks();
    } else if (marker === 0x2c) {
      frames += 1;
      const flags = bytes[i + 9];
      i += 10;
      if (flags & 0x80) i += 3 * (1 << ((flags & 0x07) + 1));
      i += 1;
      skipSubBlocks();
    } else {
      break;
    }
  }
  return frames;
}

export function isAnimatedWebp(bytes) {
  if (readAscii(bytes, 0, 4) !== 'RIFF' || readAscii(bytes, 8, 4) !== 'WEBP') return false;
  // ANIM/ANMF sit in the container header, ahead of the frame payload.
  const header = readAscii(bytes, 12, Math.min(65_536, bytes.length - 12));
  return header.includes('ANIM') && header.includes('ANMF');
}

export function isApng(bytes) {
  if (bytes[0] !== 0x89 || readAscii(bytes, 1, 3) !== 'PNG') return false;
  // `acTL` must precede the first `IDAT`; after that the file is only extra chunks.
  const text = readAscii(bytes, 8, Math.min(65_536, bytes.length - 8));
  const control = text.indexOf('acTL');
  const data = text.indexOf('IDAT');
  return control >= 0 && (data < 0 || control < data);
}

// True when the bytes describe more than one frame.
export function isAnimated(bytes) {
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return gifFrameCount(bytes) > 1;
  if (isAnimatedWebp(bytes)) return true;
  return isApng(bytes);
}

// --- freezing --------------------------------------------------------------

function toDataUrl(frame) {
  const width = frame.width || frame.naturalWidth;
  const height = frame.height || frame.naturalHeight;
  if (!width || !height) return '';
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return '';
  context.drawImage(frame, 0, 0, width, height);
  // PNG, not JPEG: an avatar may carry transparency and JPEG would fill it with black.
  return canvas.toDataURL('image/png');
}

// Decoding the blob yields the default image of an animated file — frame 1 — regardless of
// which frame the element was showing. Without `createImageBitmap` the live element is drawn
// instead: the frame may not be the first, but it is still a still.
async function firstFrame(blob, img) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob);
    } catch {
      // Fall through to the element.
    }
  }
  return img;
}

async function readBytes(source, limit) {
  const response = await fetch(proxyUrl(source, limit));
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return { bytes: new Uint8Array(await response.arrayBuffer()), headers: response.headers };
}

// Resolves one avatar URL to a still data URL, or null when it must be left alone.
//
// Two phases: most avatars on a page are ordinary stills, and answering "not animated" only
// needs the front of the file. The full download is paid for the few that really animate.
async function resolveStill(source, img) {
  const head = await readBytes(source, SNIFF_BYTES);
  const total = Number(head.headers.get('X-Image-Total')) || 0;
  const truncated = total > head.bytes.length;
  // A prefix holds no GIF trailer, so a frame count of 1 from it only means "no second frame
  // *yet*". Treating that as a verdict would miss an animation whose first frame is simply
  // large; the full read settles it. WebP and PNG declare themselves in the header, so a
  // prefix is always conclusive for those.
  const undecided = truncated && readAscii(head.bytes, 0, 3) === 'GIF';
  if (!isAnimated(head.bytes) && !undecided) return null;

  // Frame 1 has to be decoded, so the whole file is needed.
  const full = await readBytes(source, 0);
  if (!isAnimated(full.bytes)) return null;
  const type = full.headers.get('Content-Type') || '';
  return toDataUrl(await firstFrame(new Blob([full.bytes], { type }), img)) || null;
}

async function freeze(img) {
  const current = img.getAttribute('src') || '';
  // Already frozen: re-checking would refetch on every observer tick and every load event.
  if (!current || current.startsWith('data:')) return;
  // A decided avatar is not revisited: 'static' means it is already single-frame.
  if (img.dataset.avatarFreeze === 'static') return;
  img.dataset.avatarSource = current;
  if (!stills.has(current)) stills.set(current, resolveStill(current, img).catch(() => null));
  img.dataset.avatarFreeze = 'pending';
  const still = await stills.get(current);
  // The view may have re-rendered while the proxy was in flight; that element is gone.
  if (!img.isConnected) return;
  if (still) {
    img.src = still;
    delete img.dataset.avatarFreeze;
    return;
  }
  // Static, already single-frame, or undecodable: keep voz.vn's own image.
  img.dataset.avatarFreeze = 'static';
}

// Turning the setting back off restores the original URL, which is still on the element.
function restore(img) {
  const source = img.dataset.avatarSource;
  if (!source || !(img.getAttribute('src') || '').startsWith('data:')) return;
  img.src = source;
  delete img.dataset.avatarFreeze;
  // Re-enabling the setting must be able to freeze this avatar again.
  seen.delete(img);
}

// lib/avatar.js renders every avatar through `img.avatar-img` — post sidebars, thread rows,
// member cards, lists, conversation lists and the header account menu alike.
//
// Only avatars that have been on screen are resolved. A forum list page carries 40+ avatars
// and almost all of them are ordinary stills, so sniffing every one would cost a request per
// row for no visible benefit; an avatar that never scrolls into view is never animated on
// screen either. `seen` remembers the ones already handed to `freeze()` so the observer does
// not re-queue them on every tick.
function refresh() {
  const enabled = getStaticAvatars();
  for (const img of document.querySelectorAll('img.avatar-img')) {
    if (!enabled) {
      restore(img);
      continue;
    }
    if (seen.has(img)) continue;
    if (!isOnScreen(img)) continue;
    seen.add(img);
    freeze(img);
  }
}

function isOnScreen(img) {
  const box = img.getBoundingClientRect();
  if (!box.width || !box.height) return false;
  return box.bottom > -200 && box.top < window.innerHeight + 200;
}

let scheduled = false;
function schedule() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    refresh();
  });
}

export function wireStaticAvatars() {
  refresh();
  // Views re-render by replacing #app and infinite scroll appends whole pages, so one observer
  // on the body covers both. A processed avatar is skipped, so this cannot loop.
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  // Avatars are lazy-loaded, so a fresh one only has a usable src after its load event.
  document.addEventListener('load', (event) => {
    if (event.target instanceof HTMLImageElement && event.target.classList.contains('avatar-img')) schedule();
  }, true);
  // Scrolling brings avatars that were skipped off screen into range.
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('voz:settings', schedule);
}
