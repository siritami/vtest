// The popup behind a post's `#13,661` number: it offers the two share links a reader
// actually wants — the canonical voz.vn permalink, and the permalink of whatever site is
// being browsed (the local clone, a mirror, a fork).
//
// It is deliberately *not* a modal: the number keeps its normal jump behaviour, and the
// popup is a non-blocking menu anchored to the number, like every other menu in the app.

import { esc } from '../core/utils.js';
import { threadPath, withPage } from '../core/paths.js';
import { toast } from './feedback.js';

// `voz.vn` is the upstream forum, independent of where this client is deployed.
const VOZ_ORIGIN = 'https://voz.vn';

// voz.vn's canonical permalink for one post. XenForo resolves `/t/<slug>.<id>/post-<postId>`
// to the right page server-side, so the page number does not have to be guessed here.
export function vozPostUrl(thread, postId) {
  if (!thread?.thread_id || !postId) return '';
  // `threadPath` already produces the slugged `/t/<slug>.<id>/` form.
  return `${VOZ_ORIGIN}${threadPath(thread).replace(/\/$/, '')}/post-${postId}`;
}

// The permalink as seen by the reader: current origin (localhost, a preview deploy, a fork),
// current page, and the `#post-…` fragment.
export function webPostUrl(thread, page, postId) {
  if (!thread?.thread_id || !postId) return '';
  return `${location.origin}${withPage(threadPath(thread), page)}#post-${postId}`;
}

async function copy(text) {
  if (!text) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Falls through to the legacy path — clipboard access needs a secure context and a
    // user gesture, and is unavailable on plain http:// in some browsers.
  }
  try {
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.top = '-1000px';
    document.body.append(field);
    field.select();
    const ok = document.execCommand('copy');
    field.remove();
    return ok;
  } catch {
    return false;
  }
}

let open = null;
let watchRaf = 0;

export function closePostNumberPopup() {
  if (watchRaf) {
    cancelAnimationFrame(watchRaf);
    watchRaf = 0;
  }
  if (!open) return;
  open.root.remove();
  open.trigger.setAttribute('aria-expanded', 'false');
  open = null;
  document.removeEventListener('click', onDocumentClick, true);
  document.removeEventListener('keydown', onKeydown, true);
  window.removeEventListener('scroll', closePostNumberPopup, true);
  window.removeEventListener('resize', closePostNumberPopup, true);
}

// The post list is replaced wholesale by `innerHTML` on some navigations, which detaches the
// trigger without any event we could listen for. Watching for that is more reliable than
// closing on every render — closing on render killed the popup that the same click had just
// opened, because a `#post-…` link can trigger a thread re-render.
function watchTrigger() {
  cancelAnimationFrame(watchRaf);
  const tick = () => {
    if (!open) return;
    if (!open.trigger.isConnected) return closePostNumberPopup();
    watchRaf = requestAnimationFrame(tick);
  };
  watchRaf = requestAnimationFrame(tick);
}

// A click on the trigger is a no-op here: the `thread` handler owns toggling, so a second
// click on the same number must be able to close it rather than be swallowed as a dismissal.
function onDocumentClick(event) {
  if (!open) return;
  if (open.root.contains(event.target) || open.trigger.contains(event.target)) return;
  closePostNumberPopup();
}

function onKeydown(event) {
  if (event.key === 'Escape') {
    const trigger = open?.trigger;
    closePostNumberPopup();
    trigger?.focus();
  }
}

export function openPostNumberPopup(trigger, thread, page, postId) {
  // Toggling: a click on the same number while its menu is open closes it.
  const wasOpen = open?.trigger === trigger;
  closePostNumberPopup();
  if (wasOpen) return;

  const links = [
    { label: 'Sao chép liên kết voz.vn', url: vozPostUrl(thread, postId) },
    { label: 'Sao chép liên kết web', url: webPostUrl(thread, page, postId) },
  ].filter((item) => item.url);

  const root = document.createElement('div');
  root.className = 'post-share-popup';
  root.setAttribute('role', 'menu');
  root.innerHTML = links
    .map(
      (item, index) =>
        `<button type="button" class="post-share-option" role="menuitem" data-index="${index}" title="${esc(item.url)}">${esc(item.label)}</button>`
    )
    .join('');
  document.body.append(root);

  // Anchor below the number, kept inside the viewport on narrow screens. Uses fixed
  // positioning so it escapes the post's stacking/overflow context.
  const rect = trigger.getBoundingClientRect();
  const width = root.offsetWidth;
  const left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8);
  root.style.left = `${left}px`;
  root.style.top = `${rect.bottom + 6}px`;

  trigger.setAttribute('aria-expanded', 'true');
  open = { root, trigger };
  watchTrigger();

  root.addEventListener('click', async (event) => {
    const option = event.target.closest('.post-share-option');
    if (!option) return;
    event.preventDefault();
    const item = links[Number(option.dataset.index)];
    const ok = await copy(item.url);
    toast(ok ? 'Đã sao chép liên kết' : 'Không sao chép được liên kết', !ok);
    if (ok) closePostNumberPopup();
  });

  // Registered on the next task: the opening click is still being dispatched, and a capture
  // listener added part-way through would otherwise run for that same gesture and close the
  // menu immediately.
  setTimeout(() => {
    if (!open || open.trigger !== trigger) return;
    document.addEventListener('click', onDocumentClick, true);
    document.addEventListener('keydown', onKeydown, true);
    window.addEventListener('scroll', closePostNumberPopup, true);
    window.addEventListener('resize', closePostNumberPopup, true);
  }, 0);

  root.querySelector('.post-share-option')?.focus();
}
