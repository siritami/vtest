// Direct messages: list, conversation, compose.

import { app, state } from '../core/dom.js';
import { esc, num, fullDate, timeAgo } from '../core/utils.js';
import { dmPath, userPath, withPage } from '../core/paths.js';
import { navigate } from '../core/nav.js';
import { api } from '../api.js';
import { setActiveNav, setBreadcrumbs } from '../ui/chrome.js';
import { setTitle } from '../ui/title.js';
import { loading, errorBox, toast } from '../ui/feedback.js';
import { pagination, wirePageJump } from '../ui/pagination.js';
import { requireLogin } from '../ui/session.js';
import { editorHtml, wireEditor, clearEditorDraft } from '../ui/editor.js';
import { avatarMarkup } from '../lib/avatar.js';
import { sanitizeHtml } from '../lib/bbcode.js';

export async function viewDmList(page) {
  setActiveNav('dm');
  setBreadcrumbs([{ label: 'Diễn đàn', href: '/' }, { label: 'Hộp thư' }]);
  setTitle('Direct messages', page);
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
        ${pagination(res.pagination, (p) => withPage('/direct-messages', p))}
      </div>`;
    wirePageJump((p) => withPage('/direct-messages', p));
  } catch (err) {
    app.innerHTML = errorBox(err);
  }
}

export async function viewDm(conversationId, page) {
  setActiveNav('dm');
  if (!requireLogin()) return;
  loading();
  try {
    const res = await api.conversation(conversationId, page);
    const conv = res.conversation;
    const messages = res.messages || [];
    setBreadcrumbs([
      { label: 'Diễn đàn', href: '/' },
      { label: 'Hộp thư', href: '/direct-messages' },
      { label: conv.title },
    ]);
    setTitle(conv.title, res.pagination && res.pagination.current_page);
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
    wirePageJump((p) => withPage(dmPath(conv), p));
    document.getElementById('dm-reply-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const message = document.getElementById('dm-reply').value.trim();
      if (!message) return toast('Nội dung trống', true);
      try {
        await api.replyConversation(conversationId, message);
        clearEditorDraft(document.getElementById('dm-reply'));
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

export async function viewNewDm(prefillUser) {
  setActiveNav('dm');
  if (!requireLogin()) return;
  setBreadcrumbs([
    { label: 'Diễn đàn', href: '/' },
    { label: 'Hộp thư', href: '/direct-messages' },
    { label: 'Tin nhắn mới' },
  ]);
  setTitle('Send direct message');
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
            ${editorHtml('dm-message', '', 'Nội dung tin nhắn…')}
          </div>
          <button class="button button--primary" type="submit">Gửi</button>
        </form>
      </div>
    </div>`;

  wireEditor(app);
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
      clearEditorDraft(document.getElementById('dm-message'));
      toast('Đã gửi tin nhắn');
      navigate(dmPath(res.conversation));
    } catch (err) {
      toast(err.message || 'Gửi thất bại', true);
    }
  });
}
