// VOZ forum web client — hash router + views.
// All data comes from /api/xf/* (edge proxy) so the guest key and the OAuth
// bearer token never reach the browser.

import { api, auth, ApiError } from './api.js';

const app = document.getElementById('app');
const breadcrumbsEl = document.getElementById('breadcrumbs');
const accountEl = document.getElementById('header-account');
const navEl = document.getElementById('nav-list');
const toastEl = document.getElementById('toast');
const modalRoot = document.getElementById('modal-root');

const state = {
  me: null,
  loggedIn: false,
  reactions: null,
  nodes: null,
  config: null,
};

/* ------------------------------------------------------------------ icons */

const ICON_EYE_ON = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const ICON_EYE_OFF = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
const ICON_QUOTE = `<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M7.17 6A5.17 5.17 0 0 0 2 11.17V18h6.83v-6.83H5.17A2 2 0 0 1 7.17 9V6zm10 0A5.17 5.17 0 0 0 12 11.17V18h6.83v-6.83h-3.66A2 2 0 0 1 17.17 9V6z"/></svg>`;
const ICON_REPLY = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>`;
const ICON_REPORT = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>`;
const ICON_EDIT = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>`;
const ICON_DELETE = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;
const ICON_USER = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

/* ------------------------------------------------------------------ utils */

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// voz.vn rounds to whole K/M (12301 → 12K, 443764 → 444K, 1274095 → 1M).
const num = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  if (n >= 1_000_000) return `${Math.round(n / 1_000_000)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
};

const unix = (seconds) => (seconds ? Number(seconds) * 1000 : 0);

function timeAgo(seconds) {
  const ms = unix(seconds);
  if (!ms) return '';
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'vừa xong';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ngày trước`;
  return new Date(ms).toLocaleDateString('vi-VN');
}

function fullDate(seconds) {
  const ms = unix(seconds);
  if (!ms) return '';
  return new Date(ms).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/* --------------------------------------------------------------- url slugs */
// voz.vn canonical URLs carry a slug: /t/<slug>.<id>/page-<n>, /f/<slug>.<id>/page-<n>,
// /u/<slug>.<id>/, /direct-messages/<slug>.<id>/. The slug is cosmetic — the numeric
// id is what the API uses — but it is reproduced so links look identical to voz.vn.
function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Pull the numeric id out of "<slug>.<id>" or a bare "<id>".
function idFromSegment(segment) {
  const raw = String(segment || '');
  const tail = raw.includes('.') ? raw.slice(raw.lastIndexOf('.') + 1) : raw;
  return Number(tail) || 0;
}

function threadPath(thread) {
  const slug = slugify(thread.title);
  return slug ? `/t/${slug}.${thread.thread_id}/` : `/t/${thread.thread_id}/`;
}

function forumPath(forum) {
  const slug = slugify(forum.title);
  return slug ? `/f/${slug}.${forum.node_id}/` : `/f/${forum.node_id}/`;
}

function userPath(user) {
  const slug = slugify(user.username);
  return slug ? `/u/${slug}.${user.user_id}/` : `/u/${user.user_id}/`;
}

function dmPath(conversation) {
  const slug = slugify(conversation.title);
  return slug
    ? `/direct-messages/${slug}.${conversation.conversation_id}/`
    : `/direct-messages/${conversation.conversation_id}/`;
}

// voz.vn omits /page-1 and always keeps the trailing slash.
function withPage(path, page) {
  const n = Number(page) || 1;
  const base = path.endsWith('/') ? path : `${path}/`;
  return n > 1 ? `${base}page-${n}/` : base;
}

// voz.vn buckets avatar files by floor(user_id / 1000): /avatars/s/1680/1680514.jpg
function avatarUrlById(userId, size = 's') {
  const id = Number(userId);
  if (!id) return '';
  return `https://data.voz.vn/avatars/${size}/${Math.floor(id / 1000)}/${id}.jpg`;
}

// XenForo's generated avatars cycle through a fixed palette.
const DYNAMIC_AVATAR = [
  ['#66cc66', '#206020'],
  ['#669966', '#1f2e1f'],
  ['#33cc99', '#0f3d2e'],
  ['#339966', '#06130d'],
  ['#66cc33', '#1f3d0f'],
  ['#66cccc', '#206060'],
  ['#99cc66', '#406020'],
];

// Avatar with a coloured initial underneath, so a missing image degrades to the
// same generated avatar voz.vn shows instead of a broken-image icon.
function avatarMarkup(user, size = 's') {
  const id = Number(user && user.user_id) || 0;
  const urls = (user && user.avatar_urls) || {};
  // A stub user (only id + username) has no avatar_urls at all, so guess the
  // canonical path. A user whose avatar_urls are all null genuinely has no
  // avatar — guessing there would only produce 404s.
  const known = Object.keys(urls).length > 0;
  const src = known
    ? urls[size] || urls.m || urls.l || urls.o || ''
    : avatarUrlById(id, size);
  const [bg, fg] = DYNAMIC_AVATAR[id % DYNAMIC_AVATAR.length];
  const initial = esc(((user && user.username) || '?').slice(0, 1).toUpperCase());
  const img = src
    ? `<img class="avatar-img" src="${esc(src)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`
    : '';
  return `<span class="avatar-fallback" style="background:${bg};color:${fg}"><span aria-hidden="true">${initial}</span>${img}</span>`;
}

// Prefix ids are stable per forum; the label colour is what voz.vn renders.
const PREFIX_CLASS = {
  4: 'green', 5: 'red', 6: 'royalBlue', 7: 'orange',
  8: 'green', 9: 'red', 10: 'royalBlue', 11: 'orange',
  12: 'primary', 13: 'accent', 14: 'red', 15: 'green',
  16: 'orange', 17: 'royalBlue', 18: 'gray', 19: 'olive',
  20: 'red', 21: 'green', 22: 'royalBlue',
};

function prefixLabel(thread) {
  if (!thread || !thread.prefix) return '';
  const cls = PREFIX_CLASS[thread.prefix_id] || 'gray';
  return `<span class="label label--${cls}">${esc(thread.prefix)}</span> `;
}

const POSTS_PER_PAGE = 20;

function threadLastPage(thread) {
  return Math.max(1, Math.ceil(((Number(thread.reply_count) || 0) + 1) / POSTS_PER_PAGE));
}

// One row of a XenForo thread list: icon | main | meta | latest | iconEnd.
function threadRow(thread, { sticky = false, showForum = false } = {}) {
  const starter = thread.User || { user_id: thread.user_id, username: thread.username };
  const lastUser = { user_id: thread.last_post_user_id, username: thread.last_post_username };
  const lastPage = threadLastPage(thread);
  const statuses = [
    thread.discussion_open === false
      ? '<li><i class="structItem-status structItem-status--locked" title="Đã khóa"></i><span class="u-srOnly">Đã khóa</span></li>'
      : '',
    sticky
      ? '<li><i class="structItem-status structItem-status--sticky" title="Ghim"></i><span class="u-srOnly">Ghim</span></li>'
      : '',
  ].join('');
  const jumpCount = Math.min(3, lastPage);
  const jump =
    lastPage > 1
      ? `<span class="structItem-pageJump">${Array.from(
          { length: jumpCount },
          (_, i) => `<a href="${withPage(threadPath(thread), lastPage - jumpCount + 1 + i)}">${lastPage - jumpCount + 1 + i}</a>`
        ).join('')}</span>`
      : '';
  return `
    <li class="structItem structItem--thread">
      <div class="structItem-cell structItem-cell--icon">
        <div class="structItem-iconContainer">
          <a href="${userPath(starter)}" class="avatar avatar--s">${avatarMarkup(starter, 's')}</a>
        </div>
      </div>
      <div class="structItem-cell structItem-cell--main">
        ${statuses ? `<ul class="structItem-statuses">${statuses}</ul>` : ''}
        <div class="structItem-title">${prefixLabel(thread)}<a href="${threadPath(thread)}">${esc(thread.title)}</a></div>
        <div class="structItem-minor">
          <ul class="structItem-parts">
            <li><a href="${userPath(starter)}">${esc(thread.username)}</a></li>
            <li class="structItem-startDate"><a href="${threadPath(thread)}">${timeAgo(thread.post_date)}</a></li>
            ${showForum && thread.Forum ? `<li><a href="${forumPath(thread.Forum)}">${esc(thread.Forum.title)}</a></li>` : ''}
          </ul>${jump}
        </div>
      </div>
      <div class="structItem-cell structItem-cell--meta">
        <dl class="pairs pairs--justified"><dt>Trả lời</dt><dd>${num(thread.reply_count)}</dd></dl>
        <dl class="pairs pairs--justified structItem-minor"><dt>Lượt xem</dt><dd>${num(thread.view_count)}</dd></dl>
      </div>
      <div class="structItem-cell structItem-cell--latest">
        <a href="${withPage(threadPath(thread), lastPage)}"><time class="structItem-latestDate">${timeAgo(thread.last_post_date)}</time></a>
        <div class="structItem-minor"><a href="${userPath(lastUser)}">${esc(thread.last_post_username || '')}</a></div>
      </div>
      <div class="structItem-cell structItem-cell--icon structItem-cell--iconEnd">
        <div class="structItem-iconContainer">
          <a href="${userPath(lastUser)}" class="avatar avatar--xxs">${avatarMarkup(lastUser, 's')}</a>
        </div>
      </div>
    </li>`;
}

// Row for post-centric lists (bookmarks, search results).
function postRow(post, thread) {
  const author = post.User || { user_id: post.user_id, username: post.username };
  const title = (thread && thread.title) || `Bài #${post.post_id}`;
  const href = `${threadPath({ thread_id: post.thread_id, title })}?post=${post.post_id}`;
  return `
    <li class="structItem structItem--thread">
      <div class="structItem-cell structItem-cell--icon">
        <div class="structItem-iconContainer">
          <a href="${userPath(author)}" class="avatar avatar--s">${avatarMarkup(author, 's')}</a>
        </div>
      </div>
      <div class="structItem-cell structItem-cell--main">
        <div class="structItem-title"><a href="${href}">${esc(title)}</a></div>
        <div class="structItem-minor">
          <ul class="structItem-parts">
            <li><a href="${userPath(author)}">${esc(post.username)}</a></li>
            <li>${timeAgo(post.post_date)}</li>
          </ul>
        </div>
        <p class="structItem-snippet">${esc(bbcodeToPlain(post.message).replace(/\s+/g, ' ').slice(0, 240))}</p>
      </div>
    </li>`;
}

function toast(message, isError = false) {
  toastEl.textContent = message;
  toastEl.className = `toast is-visible${isError ? ' is-error' : ''}`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toastEl.className = 'toast';
  }, 3200);
}

function setBreadcrumbs(items) {
  if (!items || !items.length) {
    breadcrumbsEl.innerHTML = '';
    return;
  }
  breadcrumbsEl.innerHTML = items
    .map((item, index) => {
      const label = esc(item.label);
      const node = item.href ? `<a href="${esc(item.href)}">${label}</a>` : `<span>${label}</span>`;
      return index ? `<span class="sep">›</span>${node}` : node;
    })
    .join('');
}

function setActiveNav(name) {
  for (const link of navEl.querySelectorAll('a')) {
    link.classList.toggle('is-active', link.dataset.nav === name);
  }
}

function loading() {
  app.innerHTML = '<div class="loading"><span class="spinner"></span> Đang tải…</div>';
}

function errorBox(err) {
  const message = err instanceof ApiError ? err.message : err && err.message ? err.message : String(err);
  const code = err instanceof ApiError && err.code ? ` <span class="u-dimmed">(${esc(err.code)})</span>` : '';
  return `<div class="error-box">${esc(message)}${code}</div>`;
}

function pagination(p, makeHref, extraHtml = '') {
  if (!p || !p.last_page || p.last_page <= 1) return '';
  const current = p.current_page || 1;
  const last = p.last_page;
  const pages = new Set([1, last, current, current - 1, current + 1, current - 2, current + 2]);
  const list = [...pages].filter((n) => n >= 1 && n <= last).sort((a, b) => a - b);

  let items = '';
  let prev = 0;
  for (const n of list) {
    if (prev && n - prev > 1) {
      items += `<li class="pageNav-skip"><button type="button" class="pageNav-jumpBtn" data-last="${last}" title="Đi tới trang">…</button></li>`;
    }
    items +=
      n === current
        ? `<li class="pageNav-page is-current"><span class="current">${n}</span></li>`
        : `<li class="pageNav-page"><a href="${esc(makeHref(n))}">${n}</a></li>`;
    prev = n;
  }

  return `<div class="pageNav">
    ${current > 1 ? `<a href="${esc(makeHref(current - 1))}" class="pageNav-jump">‹ Trước</a>` : ''}
    <ul class="pageNav-main">${items}</ul>
    ${current < last ? `<a href="${esc(makeHref(current + 1))}" class="pageNav-jump">Sau ›</a>` : ''}
    ${extraHtml ? `<span class="pageNav-extra">${extraHtml}</span>` : ''}
  </div>`;
}

// Clicking "…" swaps it for a number input so any page can be jumped to.
function wirePageJump(makeHref) {
  for (const btn of app.querySelectorAll('.pageNav-jumpBtn')) {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      if (btn.dataset.active === '1') return;
      btn.dataset.active = '1';
      const last = Number(btn.dataset.last) || 1;
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '1';
      input.max = String(last);
      input.className = 'pageNav-input';
      input.placeholder = `1-${last}`;
      btn.replaceWith(input);
      input.focus();
      const go = () => {
        const n = Math.min(Math.max(Number(input.value) || 0, 1), last);
        if (n) navigate(makeHref(n));
      };
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          go();
        } else if (e.key === 'Escape') {
          input.replaceWith(btn);
          btn.dataset.active = '0';
        }
      });
      input.addEventListener('blur', () => {
        if (input.isConnected) {
          input.replaceWith(btn);
          btn.dataset.active = '0';
        }
      });
    });
  }
}

// message_parsed is server-rendered HTML; strip anything executable before injecting.
// The API drops every image size attribute, so sizes are re-applied from the raw BBCode.
function sanitizeHtml(html, bbcode) {
  const doc = new DOMParser().parseFromString(`<div id="root">${html || ''}</div>`, 'text/html');
  const root = doc.getElementById('root');
  root.querySelectorAll('script, style, iframe, object, embed, form, input, button').forEach((el) => el.remove());
  for (const el of root.querySelectorAll('*')) {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on')) el.removeAttribute(attr.name);
      if ((name === 'href' || name === 'src') && /^\s*javascript:/i.test(attr.value)) {
        el.removeAttribute(attr.name);
      }
    }
    if (el.tagName === 'A') {
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener nofollow ugc');
    }
  }
  applyImageSizes(root, bbcode);
  return root.innerHTML;
}

function normalizeImgSrc(src) {
  const raw = String(src || '').trim();
  // Attachment URLs come in two shapes: /attachments/3823398/ and
  // /attachments/1791259834896-webp.3823398/ — key both on the numeric id.
  const attach = raw.match(/\/attachments\/(?:[^/?#]*\.)?(\d+)\/?/i);
  if (attach) return `attach:${attach[1]}`;
  return raw
    .replace(/^https?:\/\/voz\.vn/i, '')
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '');
}

// [IMG size="80x80"]url[/IMG]      → width 80, height 80
// [IMG width="150px"]url[/IMG]     → width 150
// [ATTACH type="full" width="150px"]3823398[/ATTACH] → width 150 on /attachments/3823398/
function parseBbcodeImageSizes(bbcode) {
  const sizes = new Map();
  const re = /\[(IMG|ATTACH)([^\]]*)\]([\s\S]*?)\[\/\1\]/gi;
  let match;
  while ((match = re.exec(bbcode || ''))) {
    const tag = match[1].toUpperCase();
    const attrs = match[2];
    const inner = match[3].trim();
    let src;
    if (tag === 'IMG') {
      src = inner;
    } else {
      const id = inner.replace(/\D/g, '');
      if (!id) continue;
      src = `attach:${id}`;
    }
    const size = attrs.match(/size\s*=\s*"(\d+)\s*x\s*(\d+)"/i);
    const width = attrs.match(/width\s*=\s*"(\d+)/i);
    const height = attrs.match(/height\s*=\s*"(\d+)/i);
    const spec = {};
    if (size) {
      spec.width = Number(size[1]);
      spec.height = Number(size[2]);
    } else {
      if (width) spec.width = Number(width[1]);
      if (height) spec.height = Number(height[1]);
    }
    if (spec.width || spec.height) sizes.set(normalizeImgSrc(src), spec);
  }
  return sizes;
}

function applyImageSizes(root, bbcode) {
  const sizes = parseBbcodeImageSizes(bbcode);
  for (const img of root.querySelectorAll('img')) {
    img.classList.add('bbImage');
    if (!sizes.size) continue;
    const spec = sizes.get(normalizeImgSrc(img.getAttribute('src')));
    if (!spec) continue;
    if (spec.width) img.setAttribute('width', String(spec.width));
    if (spec.height) img.setAttribute('height', String(spec.height));
  }
}

function bbcodeToPlain(bbcode) {
  return String(bbcode || '')
    .replace(/\[quote(?:=[^\]]*)?\][\s\S]*?\[\/quote\]/gi, '')
    .replace(/\[\/?[a-z*][^\]]*\]/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripQuotes(bbcode) {
  let depth = 0;
  let out = '';
  let last = 0;
  const re = /\[(\/?)quote(?:=[^\]]*)?\]/gi;
  let match;
  while ((match = re.exec(bbcode))) {
    if (depth === 0) out += bbcode.slice(last, match.index);
    depth += match[1] ? -1 : 1;
    if (depth < 0) depth = 0;
    last = re.lastIndex;
  }
  if (depth === 0) out += bbcode.slice(last);
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

function quoteBlock(post) {
  const author = String(post.username || '').replace(/"/g, '');
  const member = post.user_id ? `, member: ${post.user_id}` : '';
  const body = stripQuotes(post.message || '');
  return `[QUOTE="${author}, post: ${post.post_id}${member}"]\n${body}\n[/QUOTE]\n\n`;
}

/* --------------------------------------------------------------- session */

async function loadSession() {
  try {
    const res = await auth.status();
    state.loggedIn = !!res.loggedIn;
    state.me = res.me || null;
  } catch {
    state.loggedIn = false;
    state.me = null;
  }
  renderAccount();
}

function renderAccount() {
  if (state.loggedIn && state.me) {
    const me = state.me;
    accountEl.innerHTML = `
      <a href="${userPath(me)}" class="u-nowrap avatar">${avatarMarkup(me, 's')}</a>
      <a href="${userPath(me)}" class="username">${esc(me.username)}</a>
      <button class="button button--small" id="logout-btn" type="button">Đăng xuất</button>
    `;
    const btn = document.getElementById('logout-btn');
    if (btn) {
      btn.addEventListener('click', async () => {
        await auth.logout();
        state.loggedIn = false;
        state.me = null;
        renderAccount();
        toast('Đã đăng xuất');
        navigate('/');
      });
    }
  } else {
    accountEl.innerHTML = `<a class="button button--small button--primary" href="/login">Đăng nhập</a>`;
  }
}

function requireLogin() {
  if (state.loggedIn) return true;
  app.innerHTML = `
    <div class="block">
      <div class="block-header">Cần đăng nhập</div>
      <div class="block-body block-body--pad">
        <p>Chức năng này cần tài khoản voz.vn.</p>
        <a class="button button--primary" href="/login">Đăng nhập bằng voz.vn</a>
      </div>
    </div>`;
  return false;
}

/* ------------------------------------------------------------------ views */

async function viewHome() {
  setActiveNav('home');
  setBreadcrumbs([{ label: 'Diễn đàn' }]);
  loading();
  try {
    if (!state.nodes) state.nodes = await api.nodes();
    const { nodes, tree_map: treeMap } = state.nodes;
    const byId = new Map(nodes.map((n) => [n.node_id, n]));
    const childrenOf = (id) => (treeMap[String(id)] || []).map((cid) => byId.get(cid)).filter(Boolean);

    const renderNode = (node, depth) => {
      const kids = childrenOf(node.node_id);
      const isForum = node.node_type_id === 'Forum';
      const count = node.type_data && node.type_data.discussion_count;
      const href = isForum ? forumPath(node) : null;
      const title = href
        ? `<a href="${href}">${esc(node.title)}</a>`
        : `<span>${esc(node.title)}</span>`;
      const desc = node.description ? `<div class="node-desc">${esc(node.description)}</div>` : '';
      const stats = isForum
        ? `<div class="node-stats"><strong>${num(count)}</strong><br>chủ đề</div>`
        : '';
      const row = `
        <li class="node-row">
          <span class="node-icon" aria-hidden="true">${esc(node.title.slice(0, 1).toUpperCase())}</span>
          <div class="node-main">
            <div class="node-title">${title}</div>
            ${desc}
            ${kids.length && depth < 2 ? `<ul class="node-children">${kids.map((k) => renderNode(k, depth + 1)).join('')}</ul>` : ''}
          </div>
          ${stats}
        </li>`;
      return row;
    };

    const roots = childrenOf(0);
    app.innerHTML = `
      <div class="block">
        <div class="block-header">Diễn đàn</div>
        <ul class="node-list">${roots.map((n) => renderNode(n, 0)).join('')}</ul>
      </div>`;
  } catch (err) {
    app.innerHTML = errorBox(err);
  }
}

async function viewForum(nodeId, page) {
  setActiveNav('home');
  loading();
  try {
    const [forumRes, threadsRes] = await Promise.all([api.forum(nodeId), api.forumThreads(nodeId, page)]);
    const forum = forumRes.forum;
    const crumbs = (forum.breadcrumbs || []).map((b) => ({ label: b.title }));
    setBreadcrumbs([{ label: 'Diễn đàn', href: '/' }, ...crumbs, { label: forum.title }]);

    const sticky = threadsRes.sticky || [];
    const threads = threadsRes.threads || [];

    app.innerHTML = `
      <div class="block">
        <div class="block-header">
          ${esc(forum.title)}
          <span class="block-header-extra">${num(threadsRes.pagination && threadsRes.pagination.total)} chủ đề</span>
        </div>
        <div class="structItemContainer">
          ${sticky.length ? `<div class="structItemContainer-group structItemContainer-group--sticky">${sticky.map((t) => threadRow(t, { sticky: true })).join('')}</div>` : ''}
          <div class="structItemContainer-group">${threads.map((t) => threadRow(t)).join('')}</div>
        </div>
        ${pagination(threadsRes.pagination, (p) => withPage(forumPath(forum), p))}
      </div>`;
  } catch (err) {
    app.innerHTML = errorBox(err);
  }
}

async function viewNewThreads(page) {
  setActiveNav('new');
  setBreadcrumbs([{ label: 'Diễn đàn', href: '/' }, { label: 'Bài mới' }]);
  loading();
  try {
    const res = await api.threads(page, 'post_date');
    const threads = res.threads || [];
    app.innerHTML = `
      <div class="block">
        <div class="block-header">Bài mới<span class="block-header-extra">${num(res.pagination && res.pagination.total)} chủ đề</span></div>
        <div class="structItemContainer">
          <div class="structItemContainer-group">${threads.map((t) => threadRow(t, { showForum: true })).join('')}</div>
        </div>
        ${pagination(res.pagination, (p) => withPage("/new", p))}
      </div>`;
  } catch (err) {
    app.innerHTML = errorBox(err);
  }
}

function reactionBar(post) {
  const counts = post.reaction_counts || {};
  const mine = post.visitor_reaction_id;
  const catalogue = state.reactions || [];

  const buttons = catalogue
    .filter((r) => r.active || counts[String(r.reaction_id)])
    .map((r) => {
      const count = Number(counts[String(r.reaction_id)]) || 0;
      const active = mine === r.reaction_id ? ' has-reaction' : '';
      return `<a href="#" class="reaction reaction--small actionBar-action${active}" data-react="${r.reaction_id}" data-post="${post.post_id}"
        title="${esc(r.title)}" ${post.can_react ? '' : 'aria-disabled="true"'}>
        <img src="${esc(r.image_url)}" alt="${esc(r.title)}" referrerpolicy="no-referrer" class="reaction-image">
        <span class="reaction-text">${esc(r.title)}</span>
        ${count ? `<span class="reaction-count">${count}</span>` : ''}
      </a>`;
    })
    .join('');

  return buttons;
}

// Grey strip under the action bar listing who reacted, like voz.vn.
// The member list is not in the REST API — it is scraped from the web route
// /p/{id}/reactions, which only the browser can reach (Cloudflare blocks server fetch).
const reactionUsersCache = new Map();

function parseReactionUsers(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const rows = [];
  for (const row of doc.querySelectorAll('.block-row--separated')) {
    const user = row.querySelector('.username[data-user-id]');
    if (!user) continue;
    const reaction = row.querySelector('.reaction[data-reaction-id]');
    const img = row.querySelector('.reaction-image');
    rows.push({
      userId: Number(user.getAttribute('data-user-id')),
      username: user.textContent.trim(),
      reactionId: reaction ? Number(reaction.getAttribute('data-reaction-id')) : null,
      reactionTitle: img ? img.getAttribute('alt') : null,
    });
  }
  return rows;
}

async function loadReactionUsers(postId) {
  if (reactionUsersCache.has(postId)) return reactionUsersCache.get(postId);
  const promise = fetch(`https://voz.vn/p/${postId}/reactions`, { credentials: 'omit' })
    .then((res) => (res.ok ? res.text() : Promise.reject(new Error(`HTTP ${res.status}`))))
    .then(parseReactionUsers)
    .catch(() => []);
  reactionUsersCache.set(postId, promise);
  return promise;
}

function reactionSummary(post) {
  const counts = post.reaction_counts || {};
  const total = Object.values(counts).reduce((sum, n) => sum + (Number(n) || 0), 0);
  if (!total) return '';
  return `<div class="reactionsBar" data-reaction-list="${post.post_id}">
    <span class="reactionsBar-loading">Đang tải thành viên…</span>
  </div>`;
}

async function hydrateReactionLists(root) {
  const strips = [...root.querySelectorAll('.reactionsBar[data-reaction-list]')];
  await Promise.all(
    strips.map(async (strip) => {
      const postId = strip.dataset.reactionList;
      const users = await loadReactionUsers(postId);
      if (!strip.isConnected) return;
      if (!users.length) {
        strip.remove();
        return;
      }
      const catalogue = state.reactions || [];
      const byId = new Map(catalogue.map((r) => [r.reaction_id, r]));
      const shown = users.slice(0, 6);
      const names = shown
        .map((u) => `<a href="${userPath({ user_id: u.userId, username: u.username })}" class="reactionsBar-user">${esc(u.username)}</a>`)
        .join(', ');
      const more = users.length > shown.length ? ` và ${users.length - shown.length} người khác` : '';
      const icons = [...new Set(users.map((u) => u.reactionId))]
        .filter(Boolean)
        .map((id) => {
          const r = byId.get(id);
          if (!r) return '';
          return `<img src="${esc(r.image_url)}" alt="${esc(r.title)}" title="${esc(r.title)}" referrerpolicy="no-referrer" class="reaction-image">`;
        })
        .join('');
      strip.innerHTML = `<span class="reactionsBar-icons">${icons}</span>
        <span class="reactionsBar-users">${names}${more}</span>`;
    })
  );
}

function postHtml(post, thread, page) {
  const user = post.User || {};
  const edited = post.last_edit_date ? `<span class="u-dimmed">· sửa ${timeAgo(post.last_edit_date)}</span>` : '';
  const ownerActions = [];
  if (post.can_edit) {
    ownerActions.push(`<a href="#" class="actionBar-action actionBar-action--icon" data-edit="${post.post_id}"
      title="Sửa bài viết" aria-label="Sửa bài viết">${ICON_EDIT}</a>`);
  }
  if (post.can_soft_delete) {
    ownerActions.push(`<a href="#" class="actionBar-action actionBar-action--icon actionBar-action--danger" data-delete="${post.post_id}"
      title="Xoá bài viết" aria-label="Xoá bài viết">${ICON_DELETE}</a>`);
  }

  return `
    <article class="message message--post" id="post-${post.post_id}" data-post-id="${post.post_id}">
      <div class="message-inner">
        <div class="message-cell message-cell--user">
          <section class="message-user">
            <div class="message-avatar">
              <a href="${userPath(user)}" class="avatar avatar--l">${avatarMarkup(user, 'l')}</a>
            </div>
            <div class="message-userDetails">
              <h4 class="message-name"><a class="username" href="${userPath(user)}">${esc(post.username)}</a></h4>
              ${user.user_title ? `<span class="userTitle">${esc(user.user_title)}</span>` : ''}
            </div>
            <ul class="message-userStats">
              <li><span>Bài viết</span><b>${num(user.message_count)}</b></li>
              <li><span>Điểm</span><b>${num(user.reaction_score)}</b></li>
              <li><span>Tham gia</span><b>${user.register_date ? new Date(unix(user.register_date)).getFullYear() : '—'}</b></li>
            </ul>
          </section>
        </div>
        <div class="message-cell message-cell--main">
          <div class="message-main">
            <header class="message-attribution">
              <ul class="message-attribution-main">
                <li><a href="${withPage(threadPath(thread), page)}#post-${post.post_id}"><time>${fullDate(post.post_date)}</time></a></li>
                ${edited ? `<li>${edited}</li>` : ''}
              </ul>
              <ul class="message-attribution-opposite">
                <li><a href="${withPage(threadPath(thread), page)}#post-${post.post_id}" class="message-postNumber">#${post.position + 1}</a></li>
              </ul>
            </header>
            <div class="message-content">
              <div class="message-userContent">
                <article class="message-body bbWrapper">${sanitizeHtml(post.message_parsed || esc(post.message), post.message)}</article>
              </div>
              ${user.signature ? `<div class="message-signature bbWrapper">${sanitizeHtml(user.signature)}</div>` : ''}
              <footer class="message-footer">
                <div class="message-actionBar actionBar">
                  <div class="actionBar-set actionBar-set--left">
                    <a href="#" class="actionBar-action actionBar-action--icon" data-report="${post.post_id}"
                       title="Báo cáo bài viết" aria-label="Báo cáo bài viết">${ICON_REPORT}</a>
                    ${ownerActions.join('')}
                  </div>
                  <div class="actionBar-set actionBar-set--right">
                    ${reactionBar(post)}
                    <a href="#" class="actionBar-action actionBar-action--icon" data-quote="${post.post_id}"
                       title="Trích dẫn" aria-label="Trích dẫn">${ICON_QUOTE}</a>
                    <a href="#" class="actionBar-action actionBar-action--icon" data-reply="${post.post_id}"
                       title="Trả lời" aria-label="Trả lời">${ICON_REPLY}</a>
                  </div>
                </div>
                ${reactionSummary(post)}
              </footer>
            </div>
          </div>
        </div>
      </div>
    </article>`;
}

function editorHtml(id, value = '', placeholder = 'Nội dung…') {
  return `
    <div class="editor-toolbar" data-editor="${id}">
      <button type="button" data-bb="b"><b>B</b></button>
      <button type="button" data-bb="i"><i>I</i></button>
      <button type="button" data-bb="u"><u>U</u></button>
      <button type="button" data-bb="s"><s>S</s></button>
      <button type="button" data-bb="url">Link</button>
      <button type="button" data-bb="img">Ảnh</button>
      <button type="button" data-bb="quote">Quote</button>
      <button type="button" data-bb="code">Code</button>
      <button type="button" data-bb="list">List</button>
    </div>
    <textarea class="textarea" id="${id}" placeholder="${esc(placeholder)}">${esc(value)}</textarea>`;
}

function wireEditor(container) {
  for (const bar of container.querySelectorAll('.editor-toolbar')) {
    const textarea = container.querySelector(`#${bar.dataset.editor}`);
    if (!textarea) continue;
    bar.addEventListener('click', (event) => {
      const btn = event.target.closest('button[data-bb]');
      if (!btn) return;
      event.preventDefault();
      const kind = btn.dataset.bb;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selected = textarea.value.slice(start, end);
      const wrap = (open, close) => {
        textarea.value = textarea.value.slice(0, start) + open + selected + close + textarea.value.slice(end);
        textarea.focus();
        textarea.selectionStart = start + open.length;
        textarea.selectionEnd = start + open.length + selected.length;
      };
      if (kind === 'url') wrap('[URL]', '[/URL]');
      else if (kind === 'img') wrap('[IMG]', '[/IMG]');
      else if (kind === 'quote') wrap('[QUOTE]', '[/QUOTE]');
      else if (kind === 'code') wrap('[CODE]', '[/CODE]');
      else if (kind === 'list') wrap('[LIST]\n[*]', '\n[/LIST]');
      else wrap(`[${kind}]`, `[/${kind}]`);
    });
  }
}

async function viewThread(threadId, page, focusPost) {
  setActiveNav('home');
  loading();
  try {
    if (!state.reactions) {
      try {
        const r = await api.reactions();
        state.reactions = r.reactions || [];
      } catch {
        state.reactions = [];
      }
    }
    const res = await api.thread(threadId, page === 'last' ? 1 : page);
    const thread = res.thread;
    const posts = res.posts || [];
    const forum = thread.Forum || {};

    // The API has no "last page" shortcut — resolve it from pagination and refetch.
    if (page === 'last' && res.pagination && res.pagination.last_page > 1) {
      return viewThread(threadId, res.pagination.last_page, focusPost);
    }
    setBreadcrumbs([
      { label: 'Diễn đàn', href: '/' },
      { label: forum.title || 'Chủ đề', href: forumPath(thread.Forum || { node_id: thread.node_id, title: "" }) },
      { label: thread.title },
    ]);

    const canReply = thread.can_reply;
    const watching = !!thread.is_watching;
    const authorHtml = `<a href="${userPath(thread.User || { user_id: thread.user_id, username: thread.username })}" class="pageNav-author">${ICON_USER}${esc(thread.username)}</a>`;
    app.innerHTML = `
      <div class="block block--messages">
        <div class="block-header">
          <span class="block-header-title">
            ${prefixLabel(thread)}${esc(thread.title)}
          </span>
          <span class="block-header-extra">${num(thread.reply_count)} trả lời · ${num(thread.view_count)} xem</span>
          <button type="button" class="block-header-icon${watching ? ' is-on' : ''}" id="watch-btn"
                  data-thread="${threadId}" data-watching="${watching ? '1' : '0'}"
                  title="${watching ? 'Bỏ theo dõi chủ đề' : 'Theo dõi chủ đề'}"
                  aria-label="${watching ? 'Bỏ theo dõi chủ đề' : 'Theo dõi chủ đề'}">
            ${watching ? ICON_EYE_ON : ICON_EYE_OFF}
          </button>
        </div>
        <div class="block-outer">
          <div class="block-outer-main">
            ${pagination(res.pagination, (p) => withPage(threadPath(thread), p), authorHtml)}
          </div>
        </div>
        <div class="block-body">
          ${posts.map((p) => postHtml(p, thread, res.pagination ? res.pagination.current_page : 1)).join('')}
        </div>
        <div class="block-outer block-outer--bottom">
          <div class="block-outer-main">
            ${pagination(res.pagination, (p) => withPage(threadPath(thread), p))}
          </div>
        </div>
      </div>
      <div class="block" id="reply-block">
        <div class="block-header">Trả lời</div>
        <div class="block-body block-body--pad">
          ${
            canReply
              ? `<form id="reply-form">
                   ${editorHtml('reply-message', '', 'Nội dung trả lời (BBCode)…')}
                   <div class="formRow" style="margin-top:10px">
                     <label><input type="checkbox" id="reply-silent"> Không đẩy chủ đề (silent)</label>
                   </div>
                   <button class="button button--primary" type="submit">Gửi trả lời</button>
                 </form>`
              : `<p class="u-dimmed">Bạn không thể trả lời chủ đề này${state.loggedIn ? '' : ' — <a href="/login">đăng nhập</a>'}.</p>`
          }
        </div>
      </div>`;

    wireEditor(app);
    wireThreadActions(threadId, posts, thread);
    wirePageJump((p) => withPage(threadPath(thread), p));
    hydrateReactionLists(app);

    if (focusPost) {
      const el = document.getElementById(`post-${focusPost}`);
      if (el) el.scrollIntoView({ block: 'center' });
    } else if (location.hash.startsWith('#post-')) {
      const el = document.getElementById(location.hash.slice(1));
      if (el) el.scrollIntoView({ block: 'center' });
    }
  } catch (err) {
    app.innerHTML = errorBox(err);
  }
}

function wireThreadActions(threadId, posts, thread) {
  const byId = new Map(posts.map((p) => [p.post_id, p]));

  if (app._threadHandler) app.removeEventListener('click', app._threadHandler);

  const onClick = async (event) => {
    const reactBtn = event.target.closest('[data-react]');
    if (reactBtn) {
      event.preventDefault();
      if (!state.loggedIn) return (navigate('/login'));
      if (reactBtn.getAttribute('aria-disabled') === 'true') return;
      const postId = Number(reactBtn.dataset.post);
      const reactionId = Number(reactBtn.dataset.react);
      reactBtn.setAttribute('aria-disabled', 'true');
      try {
        const res = await api.react(postId, reactionId);
        toast(res.action === 'insert' ? 'Đã thả cảm xúc' : 'Đã bỏ cảm xúc');
        await viewThread(threadId, currentPage(), null);
      } catch (err) {
        toast(err.message || 'Không thả được cảm xúc', true);
        reactBtn.removeAttribute('aria-disabled');
      }
      return;
    }

    const quoteLink = event.target.closest('[data-quote]');
    if (quoteLink) {
      event.preventDefault();
      if (!state.loggedIn) return (navigate('/login'));
      const post = byId.get(Number(quoteLink.dataset.quote));
      const textarea = document.getElementById('reply-message');
      if (!post || !textarea) return;
      textarea.value = quoteBlock(post) + textarea.value;
      document.getElementById('reply-block').scrollIntoView({ behavior: 'smooth', block: 'center' });
      textarea.focus();
      return;
    }

    const replyLink = event.target.closest('[data-reply]');
    if (replyLink) {
      event.preventDefault();
      if (!state.loggedIn) return (navigate('/login'));
      const textarea = document.getElementById('reply-message');
      if (!textarea) return;
      document.getElementById('reply-block').scrollIntoView({ behavior: 'smooth', block: 'center' });
      textarea.focus();
      return;
    }

    const editLink = event.target.closest('[data-edit]');
    if (editLink) {
      event.preventDefault();
      const post = byId.get(Number(editLink.dataset.edit));
      if (post) openEditModal(post, threadId);
      return;
    }

    const deleteLink = event.target.closest('[data-delete]');
    if (deleteLink) {
      event.preventDefault();
      const postId = Number(deleteLink.dataset.delete);
      if (!confirm('Xoá bài viết này? (xoá mềm, không khôi phục được từ API)')) return;
      try {
        await api.deletePost(postId);
        toast('Đã xoá bài viết');
        await viewThread(threadId, currentPage(), null);
      } catch (err) {
        toast(err.message || 'Không xoá được', true);
      }
      return;
    }

    const reportLink = event.target.closest('[data-report]');
    if (reportLink) {
      event.preventDefault();
      if (!state.loggedIn) return (navigate('/login'));
      openReportModal(Number(reportLink.dataset.report));
    }
  };

  app._threadHandler = onClick;
  app.addEventListener('click', onClick);

  const watchBtn = document.getElementById('watch-btn');
  if (watchBtn) {
    watchBtn.addEventListener('click', async (event) => {
      event.preventDefault();
      if (!state.loggedIn) return (navigate('/login'));
      const watching = watchBtn.dataset.watching === '1';
      watchBtn.setAttribute('aria-disabled', 'true');
      try {
        await api.watchThread(Number(watchBtn.dataset.thread), !watching);
        const nowWatching = !watching;
        watchBtn.dataset.watching = nowWatching ? '1' : '0';
        watchBtn.classList.toggle('is-on', nowWatching);
        watchBtn.innerHTML = nowWatching ? ICON_EYE_ON : ICON_EYE_OFF;
        const label = nowWatching ? 'Bỏ theo dõi chủ đề' : 'Theo dõi chủ đề';
        watchBtn.title = label;
        watchBtn.setAttribute('aria-label', label);
        toast(nowWatching ? 'Đã theo dõi chủ đề' : 'Đã bỏ theo dõi');
      } catch (err) {
        toast(err.message || 'Không đổi được trạng thái theo dõi', true);
      } finally {
        watchBtn.removeAttribute('aria-disabled');
      }
    });
  }

  const form = document.getElementById('reply-form');
  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const textarea = document.getElementById('reply-message');
      const message = textarea.value.trim();
      if (!message) return toast('Nội dung trống', true);
      const submit = form.querySelector('button[type=submit]');
      submit.disabled = true;
      submit.textContent = 'Đang gửi…';
      try {
        const body = { thread_id: threadId, message };
        if (document.getElementById('reply-silent').checked) body.silent = true;
        const res = await fetch('/api/xf/posts/', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
          body: new URLSearchParams(body).toString(),
        });
        const payload = await res.json();
        if (!res.ok) throw new ApiError(res.status, payload);
        toast('Đã gửi trả lời');
        navigate(`${withPage(threadPath(thread), res.pagination ? res.pagination.last_page : 1)}?post=${payload.post.post_id}`);
        await viewThread(threadId, 'last', payload.post.post_id);
      } catch (err) {
        toast(err.message || 'Gửi thất bại', true);
        submit.disabled = false;
        submit.textContent = 'Gửi trả lời';
      }
    });
  }
}

function currentPage() {
  const params = new URLSearchParams(location.search);
  const page = params.get('page');
  if (!page) return 1;
  if (page === 'last') return 'last';
  return Number(page) || 1;
}

function openModal(title, bodyHtml, footerHtml) {
  modalRoot.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-header">${esc(title)}<button type="button" data-close>&times;</button></div>
        <div class="modal-body">${bodyHtml}</div>
        ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
      </div>
    </div>`;
  const close = () => {
    modalRoot.innerHTML = '';
  };
  modalRoot.querySelector('[data-close]').addEventListener('click', close);
  modalRoot.querySelector('.modal-backdrop').addEventListener('click', (event) => {
    if (event.target.classList.contains('modal-backdrop')) close();
  });
  return { close, root: modalRoot };
}

function openEditModal(post, threadId) {
  const { close } = openModal(
    'Sửa bài viết',
    `<form id="edit-form">${editorHtml('edit-message', post.message || '')}</form>`,
    `<button class="button" type="button" data-cancel>Huỷ</button>
     <button class="button button--primary" type="submit" form="edit-form">Lưu</button>`
  );
  wireEditor(modalRoot);
  modalRoot.querySelector('[data-cancel]').addEventListener('click', close);
  modalRoot.querySelector('#edit-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = document.getElementById('edit-message').value.trim();
    if (!message) return toast('Nội dung trống', true);
    try {
      await api.editPost(post.post_id, message);
      close();
      toast('Đã lưu');
      await viewThread(threadId, currentPage(), post.post_id);
    } catch (err) {
      toast(err.message || 'Lưu thất bại', true);
    }
  });
}

function openReportModal(postId) {
  const { close } = openModal(
    'Báo cáo bài viết',
    `<form id="report-form">
       <div class="formRow">
         <label for="report-message">Lý do</label>
         <textarea class="textarea" id="report-message" placeholder="Mô tả vấn đề…"></textarea>
       </div>
     </form>`,
    `<button class="button" type="button" data-cancel>Huỷ</button>
     <button class="button button--primary" type="submit" form="report-form">Gửi báo cáo</button>`
  );
  modalRoot.querySelector('[data-cancel]').addEventListener('click', close);
  modalRoot.querySelector('#report-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = document.getElementById('report-message').value.trim();
    if (!message) return toast('Nhập lý do', true);
    try {
      await fetch(`/api/xf/posts/${postId}/report`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: new URLSearchParams({ message }).toString(),
      }).then(async (res) => {
        if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
      });
      close();
      toast('Đã gửi báo cáo');
    } catch (err) {
      toast(err.message || 'Gửi báo cáo thất bại', true);
    }
  });
}

async function viewSearch(query, searchId, page) {
  setActiveNav('search');
  setBreadcrumbs([{ label: 'Diễn đàn', href: '/' }, { label: 'Tìm kiếm' }]);
  if (!searchId) {
    app.innerHTML = `
      <div class="block">
        <div class="block-header">Tìm kiếm</div>
        <div class="block-body block-body--pad">
          <form id="search-form">
            <div class="formRow">
              <label for="search-keywords">Từ khoá</label>
              <input class="input" id="search-keywords" name="q" value="${esc(query || '')}" placeholder="Nhập từ khoá…">
            </div>
            <button class="button button--primary" type="submit">Tìm</button>
          </form>
        </div>
      </div>`;
    document.getElementById('search-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const value = document.getElementById('search-keywords').value.trim();
      if (value) navigate(`/search?q=${encodeURIComponent(value)}`);
    });
    if (query) await runSearch(query, 1);
    return;
  }
  await runSearch(query, page, searchId);
}

async function runSearch(query, page, searchId) {
  loading();
  try {
    let id = searchId;
    if (!id) {
      const created = await api.search(query);
      id = created.search.search_id;
    }
    const res = await api.searchResults(id, page);
    const results = res.results || [];
    app.innerHTML = `
      <div class="block">
        <div class="block-header">Kết quả cho “${esc(query || '')}”<span class="block-header-extra">${num(res.pagination && res.pagination.total)} kết quả</span></div>
        <div class="structItemContainer">
          <div class="structItemContainer-group">
            ${results
              .map((item) => {
                const p = item.result || {};
                return postRow(p, p.Thread || {});
              })
              .join('')}
          </div>
        </div>
        ${pagination(res.pagination, (p) => `/search?q=${encodeURIComponent(query || '')}&id=${id}&page=${p}`)}
      </div>`;
  } catch (err) {
    app.innerHTML = errorBox(err);
  }
}

async function viewDmList(page) {
  setActiveNav('dm');
  setBreadcrumbs([{ label: 'Diễn đàn', href: '/' }, { label: 'Hộp thư' }]);
  if (!requireLogin()) return;
  loading();
  try {
    const res = await api.conversations(page);
    const list = res.conversations || [];
    app.innerHTML = `
      <div class="block">
        <div class="block-header">
          Hộp thư
          <span class="block-header-extra"><a href="/direct-messages/new">+ Tin nhắn mới</a></span>
        </div>
        ${
          list.length
            ? `<ul class="dm-list">${list
                .map((c) => {
                  const others = Object.entries(c.recipients || {})
                    .filter(([id]) => String(id) !== String(c.user_id))
                    .map(([, name]) => name);
                  const who = others.length ? others.join(', ') : c.username;
                  return `<li class="dm-row${c.is_unread ? ' is-unread' : ''}">
                    <a href="${dmPath(c)}" class="avatar">${avatarMarkup(c.Starter, 's')}</a>
                    <div class="dm-main">
                      <a class="dm-title" href="${dmPath(c)}">${esc(c.title)}</a>
                      <div class="dm-meta">${esc(who)} · ${timeAgo(c.last_message_date)} · ${num(c.reply_count)} trả lời</div>
                    </div>
                  </li>`;
                })
                .join('')}</ul>`
            : '<div class="empty">Chưa có cuộc trò chuyện nào.</div>'
        }
        ${pagination(res.pagination, (p) => withPage("/direct-messages", p))}
      </div>`;
  } catch (err) {
    app.innerHTML = errorBox(err);
  }
}

async function viewDm(conversationId, page) {
  setActiveNav('dm');
  if (!requireLogin()) return;
  loading();
  try {
    const res = await api.conversation(conversationId, page);
    const conv = res.conversation;
    const messages = res.messages || [];
    setBreadcrumbs([
      { label: 'Diễn đàn', href: '/' },
      { label: 'Hộp thư', href: '/dm' },
      { label: conv.title },
    ]);
    app.innerHTML = `
      <div class="block">
        <div class="block-header">${esc(conv.title)}<span class="block-header-extra">${num(conv.reply_count)} trả lời</span></div>
        <div class="block-body block-body--pad">
          ${messages
            .map(
              (m) => `
            <div class="dm-message${state.me && m.user_id === state.me.user_id ? ' is-mine' : ''}">
              <div class="dm-message-head">
                <a class="username" href="${userPath(m.User || { user_id: m.user_id, username: m.username })}">${esc(m.username)}</a>
                <span>${fullDate(m.message_date)}</span>
              </div>
              <div class="bbWrapper">${sanitizeHtml(m.message_parsed || esc(m.message))}</div>
            </div>`
            )
            .join('')}
        </div>
        ${pagination(res.pagination, (p) => withPage(dmPath(conv), p))}
      </div>
      <div class="block">
        <div class="block-header">Trả lời</div>
        <div class="block-body block-body--pad">
          <form id="dm-reply-form">
            ${editorHtml('dm-reply', '', 'Nội dung tin nhắn…')}
            <button class="button button--primary" type="submit" style="margin-top:10px">Gửi</button>
          </form>
        </div>
      </div>`;
    wireEditor(app);
    document.getElementById('dm-reply-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const message = document.getElementById('dm-reply').value.trim();
      if (!message) return toast('Nội dung trống', true);
      try {
        await api.replyConversation(conversationId, message);
        toast('Đã gửi');
        await viewDm(conversationId, 1);
      } catch (err) {
        toast(err.message || 'Gửi thất bại', true);
      }
    });
  } catch (err) {
    app.innerHTML = errorBox(err);
  }
}

async function viewNewDm(prefillUser) {
  setActiveNav('dm');
  if (!requireLogin()) return;
  setBreadcrumbs([
    { label: 'Diễn đàn', href: '/' },
    { label: 'Hộp thư', href: '/dm' },
    { label: 'Tin nhắn mới' },
  ]);
  app.innerHTML = `
    <div class="block">
      <div class="block-header">Tin nhắn mới</div>
      <div class="block-body block-body--pad">
        <form id="new-dm-form">
          <div class="formRow">
            <label for="dm-recipient">Người nhận (tên tài khoản)</label>
            <input class="input" id="dm-recipient" value="${esc(prefillUser || '')}" placeholder="username">
            <div class="formHint" id="dm-recipient-hint"></div>
          </div>
          <div class="formRow">
            <label for="dm-title">Tiêu đề</label>
            <input class="input" id="dm-title" placeholder="Tiêu đề">
          </div>
          <div class="formRow">
            <label for="dm-message">Nội dung</label>
            <textarea class="textarea" id="dm-message" placeholder="Nội dung tin nhắn…"></textarea>
          </div>
          <button class="button button--primary" type="submit">Gửi</button>
        </form>
      </div>
    </div>`;

  const recipientInput = document.getElementById('dm-recipient');
  const hint = document.getElementById('dm-recipient-hint');
  let resolvedId = null;
  let timer = null;

  const resolve = async () => {
    const username = recipientInput.value.trim();
    resolvedId = null;
    if (!username) {
      hint.textContent = '';
      return;
    }
    hint.textContent = 'Đang tìm…';
    try {
      const res = await api.findUser(username);
      const exact = res.exact || res.users?.[0];
      if (exact && exact.user_id) {
        resolvedId = exact.user_id;
        hint.innerHTML = `Đã tìm thấy <a href="${userPath(exact)}">${esc(exact.username)}</a> (#${exact.user_id})`;
      } else {
        hint.textContent = 'Không tìm thấy tài khoản này.';
      }
    } catch {
      hint.textContent = 'Không tìm thấy tài khoản này.';
    }
  };

  recipientInput.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(resolve, 500);
  });
  if (prefillUser) resolve();

  document.getElementById('new-dm-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!resolvedId) return toast('Chưa xác định người nhận', true);
    const title = document.getElementById('dm-title').value.trim();
    const message = document.getElementById('dm-message').value.trim();
    if (!title || !message) return toast('Nhập đủ tiêu đề và nội dung', true);
    try {
      const res = await api.createConversation([resolvedId], title, message);
      toast('Đã gửi tin nhắn');
      navigate(dmPath(res.conversation));
    } catch (err) {
      toast(err.message || 'Gửi thất bại', true);
    }
  });
}

async function viewAlerts(page) {
  setActiveNav('alerts');
  setBreadcrumbs([{ label: 'Diễn đàn', href: '/' }, { label: 'Thông báo' }]);
  if (!requireLogin()) return;
  loading();
  try {
    const res = await api.alerts(page);
    const alerts = res.alerts || [];
    app.innerHTML = `
      <div class="block">
        <div class="block-header">Thông báo<span class="block-header-extra">${num(res.pagination && res.pagination.total)}</span></div>
        ${
          alerts.length
            ? `<div>${alerts
                .map(
                  (a) => `
              <div class="alert-row${a.read_date ? '' : ' is-unread'}">
                <a href="${userPath(a.User || { user_id: a.user_id, username: a.username })}" class="avatar">${avatarMarkup(a.User, 's')}</a>
                <div class="alert-main">
                  <div>${esc(a.alert_text)}</div>
                  ${a.content_title ? `<div class="u-smaller u-dimmed">${esc(a.content_title)}</div>` : ''}
                  <div class="alert-time">${timeAgo(a.event_date)}</div>
                </div>
              </div>`
                )
                .join('')}</div>`
            : '<div class="empty">Không có thông báo.</div>'
        }
        ${pagination(res.pagination, (p) => withPage("/alerts", p))}
      </div>`;
  } catch (err) {
    app.innerHTML = errorBox(err);
  }
}

async function viewBookmarks(page) {
  setActiveNav('bookmarks');
  setBreadcrumbs([{ label: 'Diễn đàn', href: '/' }, { label: 'Đánh dấu' }]);
  if (!requireLogin()) return;
  loading();
  try {
    const res = await api.bookmarks(page);
    const items = res.bookmarks || [];
    app.innerHTML = `
      <div class="block">
        <div class="block-header">Bài viết đã đánh dấu</div>
        ${
          items.length
            ? `<div class="structItemContainer"><div class="structItemContainer-group">${items
                .map((b) => postRow(b.Post || {}, (b.Post && b.Post.Thread) || {}))
                .join('')}</div></div>`
            : '<div class="empty">Chưa đánh dấu bài nào.</div>'
        }
        ${pagination(res.pagination, (p) => withPage("/bookmarks", p))}
      </div>`;
  } catch (err) {
    app.innerHTML = errorBox(err);
  }
}

async function viewWatched(page) {
  setActiveNav('watched');
  setBreadcrumbs([{ label: 'Diễn đàn', href: '/' }, { label: 'Theo dõi' }]);
  if (!requireLogin()) return;
  loading();
  try {
    const res = await api.watched(page);
    const threads = res.threads || [];
    app.innerHTML = `
      <div class="block">
        <div class="block-header">Chủ đề đang theo dõi</div>
        ${
          threads.length
            ? `<div class="structItemContainer"><div class="structItemContainer-group">${threads
                .map((t) => threadRow(t, { showForum: true }))
                .join('')}</div></div>`
            : '<div class="empty">Chưa theo dõi chủ đề nào.</div>'
        }
        ${pagination(res.pagination, (p) => withPage("/watched", p))}
      </div>`;
  } catch (err) {
    app.innerHTML = errorBox(err);
  }
}

async function viewUser(userId) {
  setActiveNav('');
  loading();
  try {
    const res = await api.user(userId);
    const user = res.user;
    setBreadcrumbs([{ label: 'Diễn đàn', href: '/' }, { label: user.username }]);
    const isMe = state.me && state.me.user_id === user.user_id;
    app.innerHTML = `
      <div class="block">
        <div class="block-header">${esc(user.username)}</div>
        <div class="profile-head">
          <span class="avatar avatar--l">${avatarMarkup(user, 'l')}</span>
          <div>
            <h1 class="profile-name">${esc(user.username)}</h1>
            ${user.user_title ? `<div class="profile-title">${esc(user.user_title)}</div>` : ''}
            ${user.is_staff ? '<div class="profile-title">Ban quản trị</div>' : ''}
            <ul class="profile-stats">
              <li><b>${num(user.message_count)}</b>Bài viết</li>
              <li><b>${num(user.reaction_score)}</b>Điểm</li>
              <li><b>${num(user.trophy_points)}</b>Trophy</li>
              <li><b>${user.register_date ? new Date(unix(user.register_date)).toLocaleDateString('vi-VN') : '—'}</b>Tham gia</li>
            </ul>
            <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
              ${!isMe && user.can_converse ? `<a class="button button--primary" href="/direct-messages/new?to=${encodeURIComponent(user.username)}">Gửi tin nhắn</a>` : ''}
              <a class="button" href="https://voz.vn${esc(user.view_url ? new URL(user.view_url).pathname : `/u/${user.user_id}/`)}" target="_blank" rel="noopener">Xem trên voz.vn</a>
            </div>
          </div>
        </div>
        ${user.about ? `<div class="profile-section"><h3>Giới thiệu</h3><div class="bbWrapper">${sanitizeHtml(user.about)}</div></div>` : ''}
        ${user.location ? `<div class="profile-section"><h3>Nơi ở</h3><div>${esc(user.location)}</div></div>` : ''}
        ${user.website ? `<div class="profile-section"><h3>Website</h3><div><a href="${esc(user.website)}" target="_blank" rel="noopener nofollow">${esc(user.website)}</a></div></div>` : ''}
        ${user.signature ? `<div class="profile-section"><h3>Chữ ký</h3><div class="bbWrapper">${sanitizeHtml(user.signature)}</div></div>` : ''}
      </div>`;
  } catch (err) {
    app.innerHTML = errorBox(err);
  }
}

/* ------------------------------------------------------------------ login */

function b64url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function makePkce() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = b64url(new Uint8Array(digest));
  const stateValue = b64url(crypto.getRandomValues(new Uint8Array(16)));
  return { verifier, challenge, state: stateValue };
}

async function viewLogin() {
  setActiveNav('');
  setBreadcrumbs([{ label: 'Diễn đàn', href: '/' }, { label: 'Đăng nhập' }]);
  if (!state.config) state.config = await auth.config();
  const cfg = state.config;

  app.innerHTML = `
    <div class="login-wrap">
      <div class="block">
        <div class="block-header">Đăng nhập bằng voz.vn</div>
        <div class="block-body block-body--pad">
          <p class="u-smaller u-dimmed">
            Ứng dụng OAuth <b>VOZ chính chủ</b> chỉ cho phép redirect về <code>vozma26://oauth</code>,
            nên trình duyệt không tự bắt được mã uỷ quyền. Dùng userscript bên dưới để lấy mã,
            hoặc dán thẳng access token.
          </p>

          <div class="tabs" id="login-tabs">
            <button type="button" data-tab="code" class="is-active">Lấy mã uỷ quyền</button>
            <button type="button" data-tab="token">Dán access token</button>
          </div>

          <div id="tab-code" style="padding-top:14px">
            <ol class="login-steps">
              <li>Cài userscript <a href="/userscript/voz-oauth-helper.user.js" target="_blank" rel="noopener">voz-oauth-helper.user.js</a> (Tampermonkey / Violentmonkey).</li>
              <li>Bấm <b>Mở trang uỷ quyền</b> — cửa sổ voz.vn mở ra, bấm <b>Authorize</b>.</li>
              <li>Userscript bắt mã và hiện nút <b>Copy code</b> (hoặc tự gửi về tab này).</li>
              <li>Dán mã vào ô dưới rồi bấm <b>Đăng nhập</b>.</li>
            </ol>
            <div class="formRow">
              <button class="button button--primary" type="button" id="open-authorize">Mở trang uỷ quyền</button>
            </div>
            <div class="formRow">
              <label for="auth-code">Mã uỷ quyền (code)</label>
              <textarea class="code-box" id="auth-code" placeholder="Dán code hoặc cả URL vozma26://oauth?code=..."></textarea>
              <div class="formHint" id="pkce-hint"></div>
            </div>
            <button class="button button--primary" type="button" id="exchange-btn">Đăng nhập</button>
          </div>

          <div id="tab-token" class="u-hidden" style="padding-top:14px">
            <div class="formRow">
              <label for="raw-token">Access token</label>
              <textarea class="code-box" id="raw-token" placeholder='{"accessToken":"...","refreshToken":"...","expiresAt":123}'></textarea>
              <div class="formHint">Dán chuỗi token, hoặc JSON đầy đủ từ <code>tokens.json</code>.</div>
            </div>
            <button class="button button--primary" type="button" id="token-btn">Đăng nhập</button>
          </div>
        </div>
      </div>
    </div>`;

  const tabs = document.getElementById('login-tabs');
  tabs.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-tab]');
    if (!btn) return;
    for (const b of tabs.querySelectorAll('button')) b.classList.toggle('is-active', b === btn);
    document.getElementById('tab-code').classList.toggle('u-hidden', btn.dataset.tab !== 'code');
    document.getElementById('tab-token').classList.toggle('u-hidden', btn.dataset.tab !== 'token');
  });

  let pkce = null;
  const hint = document.getElementById('pkce-hint');

  const ensurePkce = async () => {
    if (!pkce) {
      pkce = await makePkce();
      sessionStorage.setItem('voz_pkce', JSON.stringify(pkce));
      hint.textContent = `PKCE challenge: ${pkce.challenge.slice(0, 24)}…`;
    }
    return pkce;
  };

  const stored = sessionStorage.getItem('voz_pkce');
  if (stored) {
    try {
      pkce = JSON.parse(stored);
      hint.textContent = `PKCE challenge: ${pkce.challenge.slice(0, 24)}…`;
    } catch {
      pkce = null;
    }
  }

  document.getElementById('open-authorize').addEventListener('click', async () => {
    const p = await ensurePkce();
    const params = new URLSearchParams({
      client_id: cfg.clientId,
      redirect_uri: cfg.redirectUri,
      response_type: 'code',
      scope: cfg.scopes,
      code_challenge: p.challenge,
      code_challenge_method: 'S256',
      state: p.state,
    });
    const url = `${cfg.authorizeUrl}?${params.toString()}`;
    const popup = window.open(url, 'voz-oauth', 'width=560,height=760');
    if (!popup) toast('Trình duyệt chặn popup — cho phép popup rồi thử lại', true);
  });

  window.addEventListener('message', async (event) => {
    if (event.origin !== location.origin && !/voz\.vn$/.test(new URL(event.origin).hostname)) return;
    const data = event.data || {};
    if (data.type !== 'voz-oauth-code' || !data.code) return;
    document.getElementById('auth-code').value = data.code;
    toast('Đã nhận code từ userscript');
  });

  document.getElementById('exchange-btn').addEventListener('click', async () => {
    const raw = document.getElementById('auth-code').value.trim();
    if (!raw) return toast('Chưa có code', true);
    const match = raw.match(/[?&]code=([^&\s]+)/);
    const code = match ? decodeURIComponent(match[1]) : raw;
    const p = await ensurePkce();
    const btn = document.getElementById('exchange-btn');
    btn.disabled = true;
    btn.textContent = 'Đang đổi token…';
    try {
      const { ok, data } = await auth.exchange(code, p.verifier);
      if (!ok) throw new Error(data.detail || data.error || 'Đổi token thất bại');
      sessionStorage.removeItem('voz_pkce');
      state.loggedIn = true;
      state.me = data.me;
      renderAccount();
      toast(`Xin chào ${data.me.username}`);
      navigate('/');
    } catch (err) {
      toast(err.message, true);
      btn.disabled = false;
      btn.textContent = 'Đăng nhập';
    }
  });

  document.getElementById('token-btn').addEventListener('click', async () => {
    const raw = document.getElementById('raw-token').value.trim();
    if (!raw) return toast('Chưa có token', true);
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = { accessToken: raw };
    }
    const btn = document.getElementById('token-btn');
    btn.disabled = true;
    btn.textContent = 'Đang kiểm tra…';
    try {
      const { ok, data } = await auth.useToken(payload);
      if (!ok) throw new Error(data.error === 'token_rejected' ? 'Token không hợp lệ' : data.error || 'Thất bại');
      state.loggedIn = true;
      state.me = data.me;
      renderAccount();
      toast(`Xin chào ${data.me.username}`);
      navigate('/');
    } catch (err) {
      toast(err.message, true);
      btn.disabled = false;
      btn.textContent = 'Đăng nhập';
    }
  });
}

/* ----------------------------------------------------------------- router */

// Path-based routing (History API) so URLs look like /t/845346 instead of /#/t/845346.
function navigate(path, { replace = false } = {}) {
  if (replace) history.replaceState({}, '', path);
  else history.pushState({}, '', path);
  window.scrollTo({ top: 0 });
  route();
}
function parsePath() {
  const segments = location.pathname.split('/').filter(Boolean);
  const params = new URLSearchParams(location.search);
  // voz.vn puts the page in the path (/t/slug.123/page-2), not in a query string.
  let page = 1;
  const last = segments[segments.length - 1] || '';
  const pageMatch = last.match(/^page-(\d+)$/);
  if (pageMatch) {
    page = Number(pageMatch[1]) || 1;
    segments.pop();
  }
  if (params.get('page')) page = Number(params.get('page')) || page;
  return { segments, params, page };
}

async function route() {
  const { segments, params, page } = parsePath();
  const head = segments[0] || '';

  try {
    if (!head) return await viewHome();
    if (head === 'f') return await viewForum(idFromSegment(segments[1]), page);
    if (head === 't') {
      return await viewThread(idFromSegment(segments[1]), page, Number(params.get('post')) || null);
    }
    if (head === 'new') return await viewNewThreads(page);
    if (head === 'search') return await viewSearch(params.get('q') || '', params.get('id'), page);
    if (head === 'direct-messages' || head === 'dm') {
      if (segments[1] === 'new') return await viewNewDm(params.get('to') || '');
      if (segments[1]) return await viewDm(idFromSegment(segments[1]), page);
      return await viewDmList(page);
    }
    if (head === 'alerts') return await viewAlerts(page);
    if (head === 'bookmarks') return await viewBookmarks(page);
    if (head === 'watched') return await viewWatched(page);
    if (head === 'u') return await viewUser(idFromSegment(segments[1]));
    if (head === 'login') return await viewLogin();
    app.innerHTML = '<div class="empty">Không tìm thấy trang.</div>';
  } catch (err) {
    app.innerHTML = errorBox(err);
  }
}

// Intercept same-origin link clicks so navigation never reloads the page.
document.addEventListener('click', (event) => {
  if (event.defaultPrevented || event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = event.target.closest('a[href]');
  if (!link) return;
  const href = link.getAttribute('href');
  if (!href || link.target === '_blank' || link.hasAttribute('download')) return;
  const url = new URL(link.href, location.origin);
  if (url.origin !== location.origin) return;
  if (/^\/(api|assets|userscript)\//.test(url.pathname)) return;
  // Same page, only a #post-… fragment: let the browser scroll, no re-render.
  if (url.pathname === location.pathname && url.search === location.search && url.hash) {
    const target = document.getElementById(url.hash.slice(1));
    if (target) {
      event.preventDefault();
      target.scrollIntoView({ block: 'center' });
      history.replaceState({}, '', url.pathname + url.search + url.hash);
    }
    return;
  }
  event.preventDefault();
  navigate(url.pathname + url.search + url.hash);
});

document.getElementById('header-search').addEventListener('submit', (event) => {
  event.preventDefault();
  const value = event.target.q.value.trim();
  if (value) navigate(`/search?q=${encodeURIComponent(value)}`);
});

window.addEventListener('popstate', () => {
  window.scrollTo({ top: 0 });
  route();
});

(async function boot() {
  // Legacy hash URLs (#/t/123) are rewritten to the path form.
  if (location.hash.startsWith('#/')) {
    history.replaceState({}, '', location.hash.slice(1));
  }
  await loadSession();
  await route();
})();
