// Forum index (node tree) and the thread list of one forum.

import { app, state } from '../core/dom.js';
import { esc, num } from '../core/utils.js';
import { forumPath, searchForumPath, withPage } from '../core/paths.js';
import { api } from '../api.js';
import { setActiveNav, setBreadcrumbs } from '../ui/chrome.js';
import { loading, errorBox } from '../ui/feedback.js';
import { pagination, wirePageJump } from '../ui/pagination.js';
import { threadRow } from '../ui/threadRow.js';
import { nodeTree } from '../ui/forumNodes.js';

export async function viewHome() {
  setActiveNav('home');
  setBreadcrumbs([{ label: 'Diễn đàn' }]);
  loading();
  try {
    if (!state.nodes) state.nodes = await api.nodes();
    const { nodes, tree_map: treeMap } = state.nodes;
    app.innerHTML = nodeTree(nodes, treeMap);
  } catch (err) {
    app.innerHTML = errorBox(err);
  }
}

export async function viewForum(nodeId, page) {
  setActiveNav('home');
  loading();
  try {
    const [forumRes, threadsRes] = await Promise.all([api.forum(nodeId), api.forumThreads(nodeId, page)]);
    const forum = forumRes.forum;
    const crumbs = (forum.breadcrumbs || []).map((b) => ({ label: b.title }));
    setBreadcrumbs([{ label: 'Diễn đàn', href: '/' }, ...crumbs, { label: forum.title }], {
      href: `${forumPath(forum)}post-thread`, label: 'Tạo chủ đề mới',
    });

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
      </div>
      <div class="block-outer">${pagination(threadsRes.pagination, (p) => withPage(forumPath(forum), p))}</div>`;
    wirePageJump((p) => withPage(forumPath(forum), p));
  } catch (err) {
    app.innerHTML = errorBox(err);
  }
}

// Aggregated node: threads pulled from many forums, so the forum name belongs in
// each row's meta (voz.vn renders /s/<slug>.<id>/page-<n> the same way).
export async function viewSearchForum(nodeId, page) {
  setActiveNav('home');
  loading();
  try {
    const [nodeRes, threadsRes] = await Promise.all([api.searchForum(nodeId), api.searchForumThreads(nodeId, page)]);
    const node = nodeRes.search_forum;
    const crumbs = (node.breadcrumbs || []).map((b) => ({ label: b.title }));
    setBreadcrumbs([{ label: 'Diễn đàn', href: '/' }, ...crumbs, { label: node.title }], {
      href: 'https://voz.vn/f/-/post-thread', label: 'Tạo chủ đề mới',
    });

    const threads = threadsRes.threads || [];
    const sticky = threads.filter((t) => t.sticky);
    const normal = threads.filter((t) => !t.sticky);

    app.innerHTML = `
      <div class="block">
        <div class="block-header">
          ${esc(node.title)}
          <span class="block-header-extra">${num(threadsRes.pagination && threadsRes.pagination.total)} chủ đề</span>
        </div>
        <div class="structItemContainer">
          ${sticky.length ? `<div class="structItemContainer-group structItemContainer-group--sticky">${sticky.map((t) => threadRow(t, { sticky: true, showForum: true })).join('')}</div>` : ''}
          <div class="structItemContainer-group">${normal.map((t) => threadRow(t, { showForum: true })).join('')}</div>
        </div>
      </div>
      <div class="block-outer">${pagination(threadsRes.pagination, (p) => withPage(searchForumPath(node), p))}</div>`;
    wirePageJump((p) => withPage(searchForumPath(node), p));
  } catch (err) {
    app.innerHTML = errorBox(err);
  }
}

export async function viewNewThreads(page) {
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
        ${pagination(res.pagination, (p) => withPage('/new', p))}
      </div>`;
    wirePageJump((p) => withPage('/new', p));
  } catch (err) {
    app.innerHTML = errorBox(err);
  }
}
