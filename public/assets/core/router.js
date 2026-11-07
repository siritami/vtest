// History-API router. voz.vn puts the page number in the path
// (/t/slug.123/page-2), not in a query string.

import { app } from './dom.js';
import { idFromSegment, threadPath, withPage } from './paths.js';
import { api } from '../api.js';
import { navigate } from './nav.js';
import { setRouteHandler } from './nav.js';
import { errorBox } from '../ui/feedback.js';
import { viewHome, viewForum, viewSearchForum, viewNewThreads } from '../views/forum.js';
import { viewThread } from '../views/thread.js';
import { viewSearch } from '../views/search.js';
import { viewDmList, viewDm, viewNewDm } from '../views/dm.js';
import { viewAlerts, viewBookmarks, viewWatched } from '../views/lists.js';
import { viewUser } from '../views/user.js';
import { viewLogin } from '../views/login.js';
import { viewCompose } from '../views/compose.js';
import { viewSettings } from '../views/settings.js';
import { refreshUnreadCounts } from '../ui/unreadCounts.js';

export function parsePath() {
  const segments = location.pathname.split('/').filter(Boolean);
  const params = new URLSearchParams(location.search);
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

export async function route() {
  const { segments, params, page } = parsePath();
  const head = segments[0] || '';

  try {
    if (!head) return await viewHome();
    if (head === 'p' && /^\d+$/.test(segments[1] || '')) {
      const { post } = await api.post(Number(segments[1]));
      const threadId = post.thread_id || post.Thread?.thread_id;
      const result = await api.thread(threadId, 1);
      const perPage = result.pagination?.per_page;
      if (!perPage || !Number.isFinite(Number(post.position))) throw new Error('Không xác định được trang của bài viết');
      const targetPage = Math.floor(Number(post.position) / perPage) + 1;
      return navigate(`${withPage(threadPath(result.thread), targetPage)}#post-${post.post_id}`, { replace: true });
    }
    if (head === 'f' && segments[2] === 'post-thread') return await viewCompose(idFromSegment(segments[1]));
    if (head === 'f') return await viewForum(idFromSegment(segments[1]), page);
    if (head === 's') return await viewSearchForum(idFromSegment(segments[1]), page);
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
    if (head === 'cai-dat-tuivoz') return viewSettings();
    if (head === 'login') return await viewLogin();
    app.innerHTML = '<div class="empty">Không tìm thấy trang.</div>';
  } catch (err) {
    app.innerHTML = errorBox(err);
  } finally {
    refreshUnreadCounts();
  }
}

setRouteHandler(route);
