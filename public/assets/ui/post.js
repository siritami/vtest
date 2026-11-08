// A single post (.message) — XenForo markup with the voz.vn metrics.

import { esc, num, unix, timeAgo, fullDate, postDate } from '../core/utils.js';
import { threadPath, userPath, withPage } from '../core/paths.js';
import { avatarMarkup } from '../lib/avatar.js';
import { sanitizeHtml } from '../lib/bbcode.js';
import { signatureHtml } from '../lib/signature.js';
import { userBadges } from '../lib/userBadges.js';
import { ICON_EDIT, ICON_DELETE, ICON_QUOTE, ICON_REPLY, ICON_REPORT, ICON_BOOKMARK } from '../core/icons.js';
import { reactionBar, reactionSummary } from './reactions.js';

export function postHtml(post, thread, page) {
  const user = post.User || {};
  const edited = post.last_edit_date ? `<span class="u-dimmed">· Đã sửa ${timeAgo(post.last_edit_date)}</span>` : '';
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
              <a href="${userPath(user)}" class="avatar avatar--l" data-member-id="${Number(user.user_id || post.user_id)}" aria-label="${esc(post.username)}">${avatarMarkup(user, 'l')}</a>
            </div>
            <div class="message-userDetails">
              <h4 class="message-name"><a class="username" data-member-id="${Number(user.user_id || post.user_id)}" href="${userPath(user)}">${esc(post.username)}</a></h4>
              <div class="message-userMeta">${user.user_title ? `<span class="userTitle">${esc(user.user_title)}</span>` : ''}${userBadges(user)}</div>
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
                <li><a href="${withPage(threadPath(thread), page)}#post-${post.post_id}"><time data-post-time title="${esc(fullDate(post.post_date))}">${postDate(post.post_date)}</time></a></li>
                ${edited ? `<li>${edited}</li>` : ''}
              </ul>
              <ul class="message-attribution-opposite">
                <li><button class="post-bookmark" type="button" data-bookmark="${post.post_id}" aria-pressed="${!!post.is_bookmarked}" title="${post.is_bookmarked ? 'Bỏ đánh dấu' : 'Đánh dấu bài viết'}" aria-label="${post.is_bookmarked ? 'Bỏ đánh dấu' : 'Đánh dấu bài viết'}">${ICON_BOOKMARK}</button></li>
                <li><a href="${withPage(threadPath(thread), page)}#post-${post.post_id}" class="message-postNumber">#${post.position + 1}</a></li>
              </ul>
            </header>
            <div class="message-content">
              <div class="message-userContent">
                <article class="message-body bbWrapper">${sanitizeHtml(post.message_parsed || esc(post.message), post.message)}</article>
              </div>
              ${user.signature ? `<div class="message-signature bbWrapper">${sanitizeHtml(signatureHtml(user.signature))}</div>` : ''}
              <footer class="message-footer">
                <div class="message-actionBar actionBar">
                  <div class="actionBar-set actionBar-set--left">
                    <a href="#" class="actionBar-action actionBar-action--icon" data-report="${post.post_id}"
                       title="Báo cáo bài viết" aria-label="Báo cáo bài viết">${ICON_REPORT}</a>
                    ${ownerActions.join('')}
                  </div>
                  <div class="actionBar-set actionBar-set--right">
                    <span class="post-reactions">${reactionBar(post)}</span>
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
