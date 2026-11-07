import { esc, num, timeAgo } from '../core/utils.js';
import { forumPath, searchForumPath, threadPath, userPath } from '../core/paths.js';
import { ICON_COMMENTS, ICON_SEARCH } from '../core/icons.js';
import { avatarMarkup } from '../lib/avatar.js';

export function nodeTree(nodes, treeMap) {
  const byId = new Map(nodes.map((node) => [node.node_id, node]));
  const children = (id) => (treeMap[String(id)] || []).map((key) => byId.get(key)).filter((node) => node && node.display_in_list !== false);
  const link = (node) => node.node_type_id === 'SearchForum' ? searchForumPath(node) : forumPath(node);
  const row = (node) => {
    const data = node.type_data || {};
    const user = { user_id: data.last_post_user_id, username: data.last_post_username, avatar_urls: data.last_post_avatar_urls };
    const thread = { thread_id: data.last_thread_id, title: data.last_thread_title };
    const kids = children(node.node_id);
    return `<li class="node-row${data.is_unread ? ' is-unread' : ''}"><span class="node-icon">${node.node_type_id === 'SearchForum' ? ICON_SEARCH : ICON_COMMENTS}</span><div class="node-main"><div class="node-title"><a href="${link(node)}">${esc(node.title)}</a></div>${node.description ? `<div class="node-desc">${esc(node.description)}</div>` : ''}${kids.length ? `<div class="node-subforums">Diễn đàn con: ${kids.map((child) => `<a href="${link(child)}">${esc(child.title)}</a>`).join(' · ')}</div>` : ''}</div><div class="node-stats"><div><span>Chủ đề</span><strong>${num(data.discussion_count)}</strong></div><div><span>Bài viết</span><strong>${num(data.message_count)}</strong></div></div><div class="node-extra">${thread.thread_id ? `<a class="avatar" href="${userPath(user)}">${avatarMarkup(user, 's')}</a><div class="node-latest"><a class="node-latest-title" href="${threadPath(thread)}?post=${data.last_post_id || ''}">${esc(thread.title)}</a><div class="u-dimmed">${timeAgo(data.last_post_date)} · <a href="${userPath(user)}">${esc(user.username)}</a></div></div>` : '<span class="u-dimmed">Chưa có bài viết</span>'}</div></li>`;
  };
  const category = (node) => `<section class="block"><h2 class="block-header">${esc(node.title)}</h2><ul class="node-list">${children(node.node_id).map((child) => child.node_type_id === 'Category' ? '' : row(child)).join('')}</ul></section>${children(node.node_id).filter((child) => child.node_type_id === 'Category').map(category).join('')}`;
  const roots = children(0);
  return roots.map((node) => node.node_type_id === 'Category' ? category(node) : `<section class="block"><ul class="node-list">${row(node)}</ul></section>`).join('');
}
