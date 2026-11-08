// Public member profile.

import { app, state } from '../core/dom.js';
import { esc, num, unix } from '../core/utils.js';
import { api } from '../api.js';
import { setActiveNav, setBreadcrumbs } from '../ui/chrome.js';
import { setTitle } from '../ui/title.js';
import { loading, errorBox } from '../ui/feedback.js';
import { avatarMarkup } from '../lib/avatar.js';
import { sanitizeHtml } from '../lib/bbcode.js';
import { signatureHtml } from '../lib/signature.js';

export async function viewUser(userId) {
  setActiveNav('');
  loading();
  try {
    const res = await api.user(userId);
    const user = res.user;
    setBreadcrumbs([{ label: 'Diễn đàn', href: '/' }, { label: user.username }]);
    setTitle(user.username);
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
        ${user.signature ? `<div class="profile-section"><h3>Chữ ký</h3><div class="bbWrapper">${sanitizeHtml(signatureHtml(user.signature))}</div></div>` : ''}
      </div>`;
  } catch (err) {
    app.innerHTML = errorBox(err);
  }
}
