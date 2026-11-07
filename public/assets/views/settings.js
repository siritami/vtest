// Browser-local settings: nav bar shortcuts plus JSON backup/restore.

import { app } from '../core/dom.js';
import { esc } from '../core/utils.js';
import { setBreadcrumbs } from '../ui/chrome.js';
import { toast } from '../ui/feedback.js';
import {
  loadSettings, addShortcut, updateShortcut, removeShortcut, moveShortcut,
  exportSettingsJson, importSettingsJson,
} from '../lib/settings.js';
import {
  getAlbums, addAlbum, renameAlbum, removeAlbums, moveAlbum, setAlbumImages,
  getRecentStickers, addRecentSticker, clearRecentStickers, getClientId, setClientId, resetClientId,
  DEFAULT_CLIENT_ID, imageFileToBase64, MAX_NAME, MAX_RECENT,
} from '../lib/stickers.js';
import { importImgurAlbum } from '../lib/imgurImport.js';
import { ICON_DELETE, ICON_EDIT } from '../core/icons.js';

const dragIcon = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>';

function shortcutRows() {
  const { navShortcuts } = loadSettings();
  if (!navShortcuts.length) return '<li class="shortcut-empty">Chưa có phím tắt nào. Thêm ở khung bên dưới.</li>';
  return navShortcuts
    .map(
      (item, index) => `<li class="shortcut-row" draggable="true" data-shortcut-id="${esc(item.id)}" data-index="${index}">
        <span class="shortcut-handle" title="Kéo để đổi thứ tự" aria-hidden="true">${dragIcon}</span>
        <span class="shortcut-index">${index + 1}</span>
        <span class="shortcut-main">
          <span class="shortcut-name">${esc(item.name)}</span>
          <span class="shortcut-url">${esc(item.url)}</span>
        </span>
        <button type="button" class="button button--small shortcut-edit" data-edit="${esc(item.id)}" title="Sửa" aria-label="Sửa ${esc(item.name)}">${ICON_EDIT}</button>
        <button type="button" class="button button--small button--danger shortcut-delete" data-delete="${esc(item.id)}" title="Xoá" aria-label="Xoá ${esc(item.name)}">${ICON_DELETE}</button>
      </li>`
    )
    .join('');
}

function stickerAlbumRows() {
  const albums = getAlbums();
  if (!albums.length) return '<li class="sticker-album-empty">Chưa có album nào. Thêm album imgur hoặc tạo album từ ảnh bên dưới.</li>';
  return albums
    .map(
      (album, index) => `<li class="sticker-album-row" draggable="true" data-album-id="${esc(album.id)}" data-index="${index}">
        <span class="shortcut-handle" title="Kéo để đổi thứ tự" aria-hidden="true">${dragIcon}</span>
        <span class="shortcut-index">${index + 1}</span>
        <span class="sticker-album-preview"><img src="${esc(album.preview)}" alt="" loading="lazy"></span>
        <span class="shortcut-main">
          <span class="shortcut-name">${esc(album.name)}</span>
          <span class="shortcut-url">${esc(album.images.length)} hình · <span class="sticker-badge sticker-badge--${album.type}">${album.type}</span></span>
        </span>
        <label class="sticker-album-select"><input type="checkbox" class="album-select" data-id="${esc(album.id)}" aria-label="Chọn ${esc(album.name)}"></label>
        <button type="button" class="button button--small sticker-rename" data-rename="${esc(album.id)}" title="Đổi tên" aria-label="Đổi tên ${esc(album.name)}">${ICON_EDIT}</button>
        <button type="button" class="button button--small sticker-export" data-export="${esc(album.id)}" title="Xuất album" aria-label="Xuất album ${esc(album.name)}">⇩</button>
        <button type="button" class="button button--small sticker-images" data-images="${esc(album.id)}" title="Xem/sửa hình ảnh" aria-label="Xem hình ảnh ${esc(album.name)}">🖼️</button>
        <button type="button" class="button button--small button--danger sticker-delete" data-delete="${esc(album.id)}" title="Xoá album" aria-label="Xoá ${esc(album.name)}">${ICON_DELETE}</button>
      </li>`
    )
    .join('');
}

function recentPreviewHtml() {
  const recent = getRecentStickers();
  if (!recent.length) return '<p class="u-dimmed">Chưa có sticker gần đây.</p>';
  return recent
    .map((img) => `<span class="sticker-recent-item"><img src="${esc(img.base64 || img.url)}" alt="" loading="lazy" title="${esc(img.url)}"></span>`)
    .join('');
}

function settingsHtml() {
  const { navShortcuts } = loadSettings();
  const albums = getAlbums();
  return `<div class="block settings-block">
      <h1 class="block-header">Cài đặt</h1>
      <p class="settings-note">Các thiết lập dưới đây chỉ lưu trên trình duyệt này (localStorage), không gửi lên voz.vn.</p>
    </div>
    <section class="block">
      <h2 class="block-header">Phím tắt trên thanh điều hướng<span class="block-header-extra">${navShortcuts.length}</span></h2>
      <div class="block-body--pad">
        <p class="formHint">Phím tắt hiện cạnh <strong>Bài mới</strong> trên thanh trên cùng, theo thứ tự từ trên xuống dưới, trái sang phải. Kéo thả để đổi thứ tự.</p>
        <ul class="shortcut-list" id="shortcut-list">${shortcutRows()}</ul>
        <form id="shortcut-form" class="shortcut-form" autocomplete="off">
          <div class="formRow">
            <label for="shortcut-name">Tên phím tắt</label>
            <input class="input" id="shortcut-name" name="name" maxlength="40" placeholder="Ví dụ: Overclock" required>
          </div>
          <div class="formRow">
            <label for="shortcut-url">Liên kết</label>
            <input class="input" id="shortcut-url" name="url" maxlength="500" placeholder="Ví dụ: http://localhost:3111/f/overclocking-cooling-modding.6/" required>
          </div>
          <p class="formError" id="shortcut-error" hidden></p>
          <div class="shortcut-form-actions">
            <button class="button button--primary" type="submit" id="shortcut-submit">Thêm phím tắt</button>
            <button class="button" type="button" id="shortcut-cancel" hidden>Huỷ sửa</button>
          </div>
        </form>
      </div>
    </section>
    <section class="block" id="stickers">
      <h2 class="block-header">Sticker<span class="block-header-extra" id="sticker-count">${albums.length}</span></h2>
      <div class="block-body--pad">
        <p class="formHint">Album sticker dùng trong nút <strong>Sticker</strong> ở thanh công cụ soạn thảo. Thêm album từ imgur (tải ảnh về máy dưới dạng base64) hoặc tạo album từ ảnh tự chọn.</p>
        <ul class="sticker-album-list" id="sticker-album-list">${stickerAlbumRows()}</ul>
        <div class="sticker-actions">
          <button class="button button--primary" type="button" id="sticker-add-imgur">+ Thêm album imgur</button>
          <button class="button" type="button" id="sticker-add-local">+ Tạo album từ ảnh</button>
          <button class="button" type="button" id="sticker-import-json">📥 Nhập album từ JSON</button>
          <button class="button button--danger" type="button" id="sticker-delete-selected">Xoá album đã chọn</button>
        </div>
        <form id="sticker-imgur-form" class="sticker-form" hidden autocomplete="off">
          <div class="formRow">
            <label for="sticker-imgur-name">Tên album</label>
            <input class="input" id="sticker-imgur-name" maxlength="${MAX_NAME}" placeholder="Ví dụ: Pepe" required>
          </div>
          <div class="formRow">
            <label for="sticker-imgur-link">URL album imgur</label>
            <input class="input" id="sticker-imgur-link" maxlength="500" placeholder="https://imgur.com/a/liverpool-emoticons-saitlzr" required>
          </div>
          <p class="formHint">Hỗ trợ cả <code>https://imgur.com/a/saitlzr</code> và <code>https://imgur.com/a/liverpool-emoticons-saitlzr</code>.</p>
          <p class="formError" id="sticker-imgur-error" hidden></p>
          <p class="sticker-progress" id="sticker-imgur-progress" hidden></p>
          <div class="shortcut-form-actions">
            <button class="button button--primary" type="submit" id="sticker-imgur-submit">Lưu &amp; tải hình ảnh</button>
            <button class="button" type="button" id="sticker-imgur-cancel">Huỷ</button>
          </div>
        </form>
        <form id="sticker-local-form" class="sticker-form" hidden autocomplete="off">
          <div class="formRow">
            <label for="sticker-local-name">Tên album</label>
            <input class="input" id="sticker-local-name" maxlength="${MAX_NAME}" placeholder="Ví dụ: Pepe Collection" required>
          </div>
          <div class="formRow">
            <label for="sticker-local-files">Hình ảnh</label>
            <input class="input" id="sticker-local-files" type="file" accept="image/*" multiple required>
          </div>
          <p class="formHint">Ảnh được thu nhỏ tối đa 400px và lưu base64 trên trình duyệt này.</p>
          <p class="formError" id="sticker-local-error" hidden></p>
          <p class="sticker-progress" id="sticker-local-progress" hidden></p>
          <div class="shortcut-form-actions">
            <button class="button button--primary" type="submit" id="sticker-local-submit">Tạo album</button>
            <button class="button" type="button" id="sticker-local-cancel">Huỷ</button>
          </div>
        </form>
        <form id="sticker-import-form" class="sticker-form" hidden autocomplete="off">
          <p class="formHint">Nhập tệp <code>.json</code> xuất từ đây hoặc từ userscript (file một album có
            <code>addOnly</code> chỉ <strong>thêm</strong> album mới, bỏ qua album trùng tên).
            File sao lưu đầy đủ sẽ thay thế toàn bộ album, sticker gần đây và Client-ID.</p>
          <div class="formRow">
            <label for="sticker-import-files">Tệp JSON</label>
            <input class="input" id="sticker-import-files" type="file" accept=".json,application/json" multiple>
          </div>
          <p class="formHint">Hoặc dán JSON trực tiếp:</p>
          <textarea class="textarea code-box" id="sticker-import-text" spellcheck="false" rows="6" aria-label="JSON album"></textarea>
          <p class="formError" id="sticker-import-error" hidden></p>
          <p class="sticker-progress" id="sticker-import-progress" hidden></p>
          <div class="shortcut-form-actions">
            <button class="button button--primary" type="button" id="sticker-import-submit">Nhập album</button>
            <button class="button" type="button" id="sticker-import-cancel">Huỷ</button>
          </div>
        </form>
        <div class="formRow sticker-client-id">
          <label for="sticker-client-id">imgur Client-ID</label>
          <input class="input" id="sticker-client-id" maxlength="64" spellcheck="false" value="${esc(getClientId())}">
          <p class="formHint">Lấy key riêng tại <a href="https://imgur.com/account/settings/apps" target="_blank" rel="noopener">imgur.com/account/settings/apps</a>. Mặc định: <code>${esc(DEFAULT_CLIENT_ID)}</code>.</p>
          <div class="shortcut-form-actions">
            <button class="button" type="button" id="sticker-client-save">Lưu Client-ID</button>
            <button class="button" type="button" id="sticker-client-reset">Về mặc định</button>
          </div>
        </div>
        <div class="formRow">
          <label>Sticker gần đây<span class="u-dimmed" id="sticker-recent-count"></span></label>
          <div class="sticker-recent-preview" id="sticker-recent-preview">${recentPreviewHtml()}</div>
          <div class="shortcut-form-actions">
            <button class="button button--danger" type="button" id="sticker-recent-clear">Xoá hết gần đây</button>
          </div>
        </div>
      </div>
    </section>
    <section class="block">
      <h2 class="block-header">Sao lưu / phục hồi</h2>
      <div class="block-body--pad settings-backup">
        <p class="formHint">JSON chứa thiết lập của trang này <strong>và</strong> toàn bộ album sticker (kèm ảnh base64). Dán JSON vào ô dưới rồi bấm Phục hồi để ghi đè.</p>
        <label class="u-srOnly" for="settings-json">JSON thiết lập</label>
        <textarea class="textarea code-box" id="settings-json" spellcheck="false" rows="10"></textarea>
        <p class="formError" id="settings-json-error" hidden></p>
        <div class="shortcut-form-actions">
          <button class="button" type="button" id="settings-export">Xuất JSON</button>
          <button class="button" type="button" id="settings-download">Tải tệp .json</button>
          <button class="button button--primary" type="button" id="settings-import">Phục hồi từ JSON</button>
          <button class="button button--danger" type="button" id="settings-reset">Xoá toàn bộ thiết lập</button>
        </div>
      </div>
    </section>`;
}

// Writes an imported JSON payload into storage and reports what changed.
// Shared by the sticker import panel and the backup/restore section.
function applyImported(result) {
  const parts = [];
  if (result.albums) {
    if (result.addOnly) {
      // Single-album file: only add names that are not already present.
      const names = new Set(getAlbums().map((album) => album.name));
      let added = 0;
      let skipped = 0;
      for (const raw of result.albums) {
        const name = String(raw?.name ?? '').replace(/\s+/g, ' ').trim();
        if (!name || names.has(name)) { skipped += 1; continue; }
        const res = addAlbum(raw);
        if (res.ok) { names.add(name); added += 1; } else skipped += 1;
      }
      parts.push(`thêm ${added} album (bỏ qua ${skipped} trùng tên)`);
    } else {
      const saved = result.albums.map((raw) => addAlbum(raw)).filter((res) => res.ok).length;
      parts.push(`${saved} album`);
    }
    // Only a full backup carries these; add-only files must not clear them.
    if (!result.addOnly) {
      if (Array.isArray(result.recent)) {
        clearRecentStickers();
        for (const item of [...result.recent].reverse()) {
          const url = typeof item === 'string' ? item : item?.url;
          if (url) addRecentSticker(url, typeof item === 'object' ? item?.base64 : null);
        }
        parts.push(`${getRecentStickers().length} gần đây`);
      }
      if (result.clientId) {
        setClientId(result.clientId);
        parts.push('Client-ID');
      }
    }
  }
  renderStickerExtras();
  return parts;
}

// Refreshes whatever sticker UI is currently mounted (settings page only).
function renderStickerExtras() {
  if (typeof window.__stickerRerenderExtras === 'function' && document.getElementById('sticker-album-list')) {
    window.__stickerRerenderExtras();
  }
}

// Sticker album management: add (imgur import / local files / JSON), rename, reorder,
// bulk delete, per-album export, image viewer, Client-ID and recents.
function wireStickerSettings() {
  const albumList = document.getElementById('sticker-album-list');
  if (!albumList) return () => {};
  const countEl = document.getElementById('sticker-count');
  const recentBox = document.getElementById('sticker-recent-preview');
  const recentCount = document.getElementById('sticker-recent-count');
  let draggedId = null;

  const rerenderExtras = () => {
    albumList.innerHTML = stickerAlbumRows();
    if (countEl) countEl.textContent = String(getAlbums().length);
    if (recentBox) recentBox.innerHTML = recentPreviewHtml();
    if (recentCount) recentCount.textContent = ` · ${getRecentStickers().length}/${MAX_RECENT}`;
    const clientInput = document.getElementById('sticker-client-id');
    if (clientInput) clientInput.value = getClientId();
  };
  window.__stickerRerenderExtras = rerenderExtras;
  rerenderExtras();

  const imgurForm = document.getElementById('sticker-imgur-form');
  const localForm = document.getElementById('sticker-local-form');
  const importForm = document.getElementById('sticker-import-form');
  const toggle = (form, show) => {
    form.hidden = !show;
    if (show) form.querySelector('input').focus();
  };
  document.getElementById('sticker-add-imgur').addEventListener('click', () => { toggle(localForm, false); toggle(importForm, importForm.hidden); });
  document.getElementById('sticker-add-local').addEventListener('click', () => { toggle(importForm, false); toggle(localForm, localForm.hidden); });
  document.getElementById('sticker-import-json').addEventListener('click', () => { toggle(localForm, false); toggle(importForm, importForm.hidden); });
  document.getElementById('sticker-imgur-cancel').addEventListener('click', () => { imgurForm.reset(); toggle(imgurForm, false); });
  document.getElementById('sticker-local-cancel').addEventListener('click', () => { localForm.reset(); toggle(localForm, false); });
  document.getElementById('sticker-import-cancel').addEventListener('click', () => { importForm.reset(); toggle(importForm, false); });

  const setStatus = (el, message, isError = false) => {
    el.textContent = message;
    el.hidden = !message;
    el.classList.toggle('is-error', isError);
  };

  const imgurError = document.getElementById('sticker-imgur-error');
  const imgurProgress = document.getElementById('sticker-imgur-progress');
  imgurForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = document.getElementById('sticker-imgur-name').value.trim();
    const link = document.getElementById('sticker-imgur-link').value.trim();
    const submit = document.getElementById('sticker-imgur-submit');
    setStatus(imgurError, '');
    submit.disabled = true;
    submit.textContent = 'Đang tải…';
    try {
      const result = await importImgurAlbum({ name, link, onProgress: (message) => setStatus(imgurProgress, message) });
      if (!result.ok) {
        setStatus(imgurError, `❌ ${result.error}`, true);
        setStatus(imgurProgress, '');
        return;
      }
      const saved = addAlbum(result.album);
      if (!saved.ok) {
        setStatus(imgurError, `❌ ${saved.error}`, true);
        return;
      }
      setStatus(imgurProgress, `✅ Đã lưu ${result.album.images.length} hình ảnh${result.errors ? ` (${result.errors} lỗi)` : ''}.`);
      imgurForm.reset();
      rerenderExtras();
      toast(`Đã thêm album "${saved.album.name}"`);
      setTimeout(() => { setStatus(imgurProgress, ''); toggle(imgurForm, false); }, 1200);
    } catch (err) {
      setStatus(imgurError, `❌ ${err.message || err}`, true);
      setStatus(imgurProgress, '');
    } finally {
      submit.disabled = false;
      submit.textContent = 'Lưu & tải hình ảnh';
    }
  });

  const localError = document.getElementById('sticker-local-error');
  const localProgress = document.getElementById('sticker-local-progress');
  localForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = document.getElementById('sticker-local-name').value.trim();
    const files = [...document.getElementById('sticker-local-files').files].filter((file) => file.type.startsWith('image/'));
    if (!files.length) return setStatus(localError, '❌ Chọn ít nhất một tệp hình ảnh.', true);
    const submit = document.getElementById('sticker-local-submit');
    setStatus(localError, '');
    submit.disabled = true;
    submit.textContent = 'Đang xử lý…';
    const images = [];
    let failed = 0;
    for (let i = 0; i < files.length; i += 1) {
      setStatus(localProgress, `⬇️ ${i + 1}/${files.length}: ${files[i].name}`);
      try {
        const base64 = await imageFileToBase64(files[i]);
        images.push({ url: base64, base64 });
      } catch {
        failed += 1;
      }
    }
    const saved = addAlbum({ name, type: 'pikvn', preview: images[0]?.base64, images });
    if (!saved.ok) {
      setStatus(localError, `❌ ${saved.error}`, true);
      setStatus(localProgress, '');
    } else {
      setStatus(localProgress, `✅ Đã lưu ${images.length} hình ảnh${failed ? ` (${failed} lỗi)` : ''}.`);
      localForm.reset();
      rerenderExtras();
      toast(`Đã thêm album "${saved.album.name}"`);
      setTimeout(() => { setStatus(localProgress, ''); toggle(localForm, false); }, 1200);
    }
    submit.disabled = false;
    submit.textContent = 'Tạo album';
  });

  // JSON album import: accepts files exported here and files exported by the userscript.
  const importError = document.getElementById('sticker-import-error');
  const importProgress = document.getElementById('sticker-import-progress');
  const importFiles = document.getElementById('sticker-import-files');
  const importText = document.getElementById('sticker-import-text');

  const importOne = (text, label) => {
    const result = importSettingsJson(text);
    if (!result.ok) return { ok: false, error: `${label}: ${result.error}` };
    if (!result.albums) return { ok: false, error: `${label}: tệp không có mảng "albums".` };
    const applied = applyImported(result);
    return { ok: true, applied };
  };

  const runImport = async () => {
    const files = [...importFiles.files];
    setStatus(importError, '');
    const applied = [];
    let failed = 0;
    if (files.length) {
      for (let i = 0; i < files.length; i += 1) {
        setStatus(importProgress, `📥 ${i + 1}/${files.length}: ${files[i].name}`);
        try {
          const outcome = importOne(await files[i].text(), files[i].name);
          if (outcome.ok) applied.push(...outcome.applied);
          else { failed += 1; setStatus(importError, `❌ ${outcome.error}`, true); }
        } catch (err) {
          failed += 1;
          setStatus(importError, `❌ ${files[i].name}: ${err.message || err}`, true);
        }
      }
    } else if (importText.value.trim()) {
      const outcome = importOne(importText.value, 'JSON dán');
      if (outcome.ok) applied.push(...outcome.applied);
      else { failed += 1; setStatus(importError, `❌ ${outcome.error}`, true); }
    } else {
      return setStatus(importError, '❌ Chọn tệp .json hoặc dán JSON vào ô bên dưới.', true);
    }
    rerenderExtras();
    if (applied.length) {
      setStatus(importProgress, `✅ Đã nhập: ${applied.join(' · ')}${failed ? ` (${failed} tệp lỗi)` : ''}.`);
      toast('Đã nhập album từ JSON');
      importForm.reset();
      setTimeout(() => { setStatus(importProgress, ''); toggle(importForm, false); }, 1500);
    } else {
      setStatus(importProgress, '');
    }
  };
  document.getElementById('sticker-import-submit').addEventListener('click', runImport);
  importFiles.addEventListener('change', () => setStatus(importError, ''));
  albumList.addEventListener('click', (event) => {
    const renameBtn = event.target.closest('[data-rename]');
    if (renameBtn) {
      const album = getAlbums().find((item) => item.id === renameBtn.dataset.rename);
      if (!album) return;
      const next = window.prompt('Tên album mới:', album.name);
      if (next === null) return;
      const result = renameAlbum(album.id, next);
      if (!result.ok) return toast(result.error, true);
      rerenderExtras();
      toast('Đã đổi tên album');
      return;
    }
    const exportBtn = event.target.closest('[data-export]');
    if (exportBtn) {
      const album = getAlbums().find((item) => item.id === exportBtn.dataset.export);
      if (!album) return;
      // Single-album files are add-only for stickers (never a full wipe).
      const payload = JSON.stringify(
        { version: '1.3', exportDate: new Date().toISOString(), addOnly: true, albums: [album] },
        null,
        2
      );
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const safe = album.name.replace(/[^a-zA-Z0-9\u00C0-\u1EF9]/g, '_').slice(0, 30);
      link.href = url;
      link.download = `voz-sticker-album-${safe}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('Đã xuất album');
      return;
    }
    const imagesBtn = event.target.closest('[data-images]');
    if (imagesBtn) {
      openAlbumImages(imagesBtn.dataset.images, rerenderExtras);
      return;
    }
    const deleteBtn = event.target.closest('[data-delete]');
    if (deleteBtn) {
      const album = getAlbums().find((item) => item.id === deleteBtn.dataset.delete);
      if (!album) return;
      const extra = album.type === 'pikvn'
        ? '\n\nẢnh đã tải lên máy chủ sẽ không bị xoá, chỉ dữ liệu album trong trình duyệt bị xoá.'
        : '';
      if (!window.confirm(`Xoá album "${album.name}"?${extra}`)) return;
      removeAlbums([album.id]);
      rerenderExtras();
      toast('Đã xoá album');
    }
  });

  document.getElementById('sticker-delete-selected').addEventListener('click', () => {
    const ids = [...albumList.querySelectorAll('.album-select:checked')].map((box) => box.dataset.id);
    if (!ids.length) return toast('Chọn album cần xoá trước.', true);
    const albums = getAlbums();
    const selected = albums.filter((album) => ids.includes(album.id));
    const pikvn = selected.filter((album) => album.type === 'pikvn').length;
    const warning = pikvn ? `\n\n${pikvn} album pikvn: ảnh trên máy chủ vẫn còn, chỉ xoá dữ liệu album.` : '';
    if (!window.confirm(`Xoá ${ids.length} album? Không thể hoàn tác.${warning}`)) return;
    removeAlbums(ids);
    rerenderExtras();
    toast(`Đã xoá ${ids.length} album`);
  });

  albumList.addEventListener('dragstart', (event) => {
    const row = event.target.closest('.sticker-album-row');
    if (!row) return;
    draggedId = row.dataset.albumId;
    row.classList.add('is-dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', draggedId);
  });
  albumList.addEventListener('dragend', () => {
    draggedId = null;
    for (const row of albumList.querySelectorAll('.sticker-album-row')) row.classList.remove('is-dragging', 'is-drop-before', 'is-drop-after');
  });
  albumList.addEventListener('dragover', (event) => {
    if (!draggedId) return;
    event.preventDefault();
    const row = event.target.closest('.sticker-album-row');
    for (const item of albumList.querySelectorAll('.sticker-album-row')) item.classList.remove('is-drop-before', 'is-drop-after');
    if (!row || row.dataset.albumId === draggedId) return;
    const rect = row.getBoundingClientRect();
    row.classList.add(event.clientY < rect.top + rect.height / 2 ? 'is-drop-before' : 'is-drop-after');
  });
  albumList.addEventListener('drop', (event) => {
    if (!draggedId) return;
    event.preventDefault();
    const row = event.target.closest('.sticker-album-row');
    if (!row) return;
    const rows = [...albumList.querySelectorAll('.sticker-album-row')];
    let targetIndex = rows.indexOf(row);
    const rect = row.getBoundingClientRect();
    if (event.clientY >= rect.top + rect.height / 2) targetIndex += 1;
    const fromIndex = rows.findIndex((item) => item.dataset.albumId === draggedId);
    if (fromIndex < targetIndex) targetIndex -= 1;
    moveAlbum(draggedId, targetIndex);
    draggedId = null;
    rerenderExtras();
  });

  document.getElementById('sticker-client-save').addEventListener('click', () => {
    const input = document.getElementById('sticker-client-id');
    setClientId(input.value);
    input.value = getClientId();
    toast('Đã lưu Client-ID');
  });
  document.getElementById('sticker-client-reset').addEventListener('click', () => {
    document.getElementById('sticker-client-id').value = resetClientId();
    toast('Đã đặt lại Client-ID mặc định');
  });
  document.getElementById('sticker-recent-clear').addEventListener('click', () => {
    if (!window.confirm('Xoá toàn bộ sticker gần đây?')) return;
    clearRecentStickers();
    rerenderExtras();
    toast('Đã xoá sticker gần đây');
  });
  return rerenderExtras;
}

// Per-album image manager: reorder by drag, remove single images, then save.
function openAlbumImages(albumId, onChange) {
  const album = getAlbums().find((item) => item.id === albumId);
  if (!album) return;
  let images = [...album.images];
  const modal = document.createElement('div');
  modal.className = 'confirm-modal';
  modal.innerHTML = `<div class="confirm-box sticker-images-box" role="dialog" aria-modal="true" aria-label="Hình ảnh album ${esc(album.name)}">
    <h3>📷 ${esc(album.name)}<span class="sticker-images-count" id="sticker-images-count">${images.length} hình ảnh</span></h3>
    <p class="formHint">Kéo thả để sắp xếp · Nhấn ✕ để xoá hình ảnh.</p>
    <div class="sticker-images-grid" id="sticker-images-grid"></div>
    <div class="confirm-actions">
      <button class="button button--primary" type="button" data-save>Lưu thay đổi</button>
      <button class="button" type="button" data-close>Huỷ</button>
    </div>
  </div>`;
  const grid = modal.querySelector('#sticker-images-grid');
  const countEl = modal.querySelector('#sticker-images-count');
  let dragFrom = null;

  const render = () => {
    grid.replaceChildren();
    countEl.textContent = `${images.length} hình ảnh`;
    images.forEach((img, index) => {
      const cell = document.createElement('div');
      cell.className = 'sticker-images-cell';
      cell.draggable = true;
      cell.dataset.index = index;
      const image = document.createElement('img');
      image.src = img.base64 || img.url;
      image.alt = '';
      image.loading = 'lazy';
      const badge = document.createElement('span');
      badge.className = 'sticker-images-index';
      badge.textContent = index + 1;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'sticker-remove';
      remove.innerHTML = '✕';
      remove.setAttribute('aria-label', `Xoá hình ảnh ${index + 1}`);
      remove.addEventListener('click', (event) => {
        event.stopPropagation();
        if (!window.confirm(`Xóa hình ảnh #${index + 1}?`)) return;
        images.splice(index, 1);
        render();
      });
      cell.addEventListener('dragstart', (event) => {
        dragFrom = index;
        cell.classList.add('is-dragging');
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(index));
      });
      cell.addEventListener('dragend', () => cell.classList.remove('is-dragging'));
      cell.addEventListener('dragover', (event) => { event.preventDefault(); cell.classList.add('is-drop-target'); });
      cell.addEventListener('dragleave', () => cell.classList.remove('is-drop-target'));
      cell.addEventListener('drop', (event) => {
        event.preventDefault();
        cell.classList.remove('is-drop-target');
        const from = dragFrom ?? Number(event.dataTransfer.getData('text/plain'));
        if (!Number.isInteger(from) || from === index) return;
        const [moved] = images.splice(from, 1);
        images.splice(index, 0, moved);
        dragFrom = null;
        render();
      });
      cell.append(image, badge, remove);
      grid.append(cell);
    });
  };
  render();

  modal.querySelector('[data-close]').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (event) => { if (event.target === modal) modal.remove(); });
  modal.querySelector('[data-save]').addEventListener('click', () => {
    if (!images.length) {
      if (!window.confirm('Album sẽ trống. Bạn có muốn xoá album này không?')) return;
      removeAlbums([album.id]);
      modal.remove();
      onChange();
      toast('Đã xoá album');
      return;
    }
    const result = setAlbumImages(album.id, images);
    if (!result.ok) return toast(result.error, true);
    modal.remove();
    onChange();
    toast('Đã lưu thay đổi album');
  });
  document.body.append(modal);
}

export function viewSettings() {
  setBreadcrumbs([{ label: 'Diễn đàn', href: '/' }, { label: 'Cài đặt' }]);
  app.innerHTML = settingsHtml();

  const list = document.getElementById('shortcut-list');
  const form = document.getElementById('shortcut-form');
  const nameInput = document.getElementById('shortcut-name');
  const urlInput = document.getElementById('shortcut-url');
  const errorEl = document.getElementById('shortcut-error');
  const submitBtn = document.getElementById('shortcut-submit');
  const cancelBtn = document.getElementById('shortcut-cancel');
  const rerenderExtras = wireStickerSettings();
  let editingId = null;
  let draggedId = null;

  const showError = (message) => {
    errorEl.textContent = message;
    errorEl.hidden = !message;
  };
  const rerenderList = () => {
    list.innerHTML = shortcutRows();
    const count = document.querySelector('.block-header-extra');
    if (count && count.closest('section')?.querySelector('#shortcut-list')) count.textContent = String(loadSettings().navShortcuts.length);
  };
  const resetForm = () => {
    editingId = null;
    form.reset();
    submitBtn.textContent = 'Thêm phím tắt';
    cancelBtn.hidden = true;
    showError('');
    nameInput.focus();
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const result = editingId ? updateShortcut(editingId, { name: nameInput.value, url: urlInput.value }) : addShortcut(nameInput.value, urlInput.value);
    if (!result.ok) return showError(result.error);
    const wasEditing = Boolean(editingId);
    resetForm();
    rerenderList();
    toast(wasEditing ? 'Đã cập nhật phím tắt' : 'Đã thêm phím tắt');
  });

  cancelBtn.addEventListener('click', resetForm);

  list.addEventListener('click', (event) => {
    const editBtn = event.target.closest('[data-edit]');
    if (editBtn) {
      const shortcut = loadSettings().navShortcuts.find((item) => item.id === editBtn.dataset.edit);
      if (!shortcut) return;
      editingId = shortcut.id;
      nameInput.value = shortcut.name;
      urlInput.value = shortcut.url;
      submitBtn.textContent = 'Lưu thay đổi';
      cancelBtn.hidden = false;
      showError('');
      nameInput.focus();
      return;
    }
    const deleteBtn = event.target.closest('[data-delete]');
    if (deleteBtn) {
      removeShortcut(deleteBtn.dataset.delete);
      if (editingId === deleteBtn.dataset.delete) resetForm();
      rerenderList();
      toast('Đã xoá phím tắt');
    }
  });

  // Drag and drop to reorder; drop position is derived from the pointer's vertical midpoint.
  list.addEventListener('dragstart', (event) => {
    const row = event.target.closest('.shortcut-row');
    if (!row) return;
    draggedId = row.dataset.shortcutId;
    row.classList.add('is-dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', draggedId);
  });
  list.addEventListener('dragend', () => {
    draggedId = null;
    for (const row of list.querySelectorAll('.shortcut-row')) row.classList.remove('is-dragging', 'is-drop-before', 'is-drop-after');
  });
  list.addEventListener('dragover', (event) => {
    if (!draggedId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const row = event.target.closest('.shortcut-row');
    for (const item of list.querySelectorAll('.shortcut-row')) item.classList.remove('is-drop-before', 'is-drop-after');
    if (!row || row.dataset.shortcutId === draggedId) return;
    const rect = row.getBoundingClientRect();
    row.classList.add(event.clientY < rect.top + rect.height / 2 ? 'is-drop-before' : 'is-drop-after');
  });
  list.addEventListener('drop', (event) => {
    if (!draggedId) return;
    event.preventDefault();
    const row = event.target.closest('.shortcut-row');
    if (!row) return;
    const rows = [...list.querySelectorAll('.shortcut-row')];
    let targetIndex = rows.indexOf(row);
    const rect = row.getBoundingClientRect();
    if (event.clientY >= rect.top + rect.height / 2) targetIndex += 1;
    const fromIndex = rows.findIndex((item) => item.dataset.shortcutId === draggedId);
    if (fromIndex < targetIndex) targetIndex -= 1;
    moveShortcut(draggedId, targetIndex);
    draggedId = null;
    rerenderList();
  });

  const jsonBox = document.getElementById('settings-json');
  const jsonError = document.getElementById('settings-json-error');
  const showJsonError = (message) => {
    jsonError.textContent = message;
    jsonError.hidden = !message;
  };

  // Full payload = nav shortcuts + sticker albums + recents + imgur key,
  // shaped like the userscript backup so either file restores in full.
  const buildBackup = () =>
    exportSettingsJson({
      albums: getAlbums(),
      recent: getRecentStickers(),
      clientId: getClientId(),
    });

  document.getElementById('settings-export').addEventListener('click', () => {
    jsonBox.value = buildBackup();
    showJsonError('');
    toast('Đã xuất JSON thiết lập');
  });
  document.getElementById('settings-download').addEventListener('click', () => {
    const blob = new Blob([buildBackup()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `voz-settings-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Đã tải tệp thiết lập');
  });
  document.getElementById('settings-import').addEventListener('click', () => {
    const result = importSettingsJson(jsonBox.value);
    if (!result.ok) return showJsonError(result.error);
    showJsonError('');
    resetForm();
    rerenderList();
    const parts = applyImported(result);
    rerenderList();
    const shortcutPart = result.count ? [`${result.count} phím tắt`] : [];
    const summary = [...shortcutPart, ...parts];
    toast(summary.length ? `Đã phục hồi: ${summary.join(' · ')}` : 'Không có dữ liệu hợp lệ để phục hồi');
  });
  document.getElementById('settings-reset').addEventListener('click', () => {
    if (!window.confirm('Xoá toàn bộ thiết lập (gồm cả album sticker) trên trình duyệt này?')) return;
    importSettingsJson('{"navShortcuts":[]}');
    for (const album of getAlbums()) removeAlbums([album.id]);
    clearRecentStickers();
    jsonBox.value = buildBackup();
    resetForm();
    rerenderList();
    toast('Đã xoá toàn bộ thiết lập');
  });

  jsonBox.value = buildBackup();
}
