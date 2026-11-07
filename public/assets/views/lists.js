// Alerts, bookmarks and watched threads.

import { app } from '../core/dom.js';
import { esc, num, timeAgo } from '../core/utils.js';
import { userPath, withPage } from '../core/paths.js';
import { api } from '../api.js';
import { setActiveNav, setBreadcrumbs } from '../ui/chrome.js';
import { loading, errorBox } from '../ui/feedback.js';
import { pagination, wirePageJump } from '../ui/pagination.js';
import { requireLogin } from '../ui/session.js';
import { threadRow, postRow } from '../ui/threadRow.js';
import { avatarMarkup } from '../lib/avatar.js';

export async function viewAlerts(page) {
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
        ${pagination(res.pagination, (p) => withPage('/alerts', p))}
      </div>`;
    wirePageJump((p) => withPage('/alerts', p));
  } catch (err) {
    app.innerHTML = errorBox(err);
  }
}

export async function viewBookmarks(page) {
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
        ${pagination(res.pagination, (p) => withPage('/bookmarks', p))}
      </div>`;
    wirePageJump((p) => withPage('/bookmarks', p));
  } catch (err) {
    app.innerHTML = errorBox(err);
  }
}

export async function viewWatched(page) {
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
        ${pagination(res.pagination, (p) => withPage('/watched', p))}
      </div>`;
    wirePageJump((p) => withPage('/watched', p));
  } catch (err) {
    app.innerHTML = errorBox(err);
  }
}
