// History-API router. voz.vn puts the page number in the path
// (/t/slug.123/page-2), not in a query string.

import { app } from './dom.js';
import { idFromSegment, threadPath, withPage } from './paths.js';
import { api } from '../api.js';
import { navigate } from './nav.js';
import { setRouteHandler } from './nav.js';
import { errorBox } from '../ui/feedback.js';
import { resolveUnread, threadLastPage } from '../lib/unread.js';
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
import { teardownInfiniteScroll } from '../ui/infiniteScroll.js';
import { setTitle } from '../ui/title.js';

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

// Resolve a thread's first unread post. `GET /threads/{id}/` reports visitor_read_date,
// is_unread and pagination without marking the thread read, so one call plus a short walk
// back over /threads/{id}/posts is enough. Mirrors voz.vn's /t/<id>/unread resolution.
//
// Never throws for the "nothing unread" case: a read thread resolves to page 1 with no
// post, which is exactly what voz.vn does when /unread has nothing newer to show. The
// thread object is returned so the caller can keep the canonical slug in the URL.
async function unreadTarget(threadId) {
  const head = await api.thread(threadId, 1);
  const thread = head.thread || { thread_id: threadId, title: '' };
  const fallback = { thread, page: 1, postId: null };
  if (!thread.is_unread) return fallback;

  const target = await resolveUnread(
    { visitorReadDate: thread.visitor_read_date, lastPage: threadLastPage(thread) },
    (p) => api.threadPosts(threadId, p)
  );
  if (!target) return fallback;
  return { thread, page: target.page, postId: target.postId };
}

export async function route() {
  const { segments, params, page } = parsePath();
  const head = segments[0] || '';
  teardownInfiniteScroll();

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
      const threadId = idFromSegment(segments[1]);
      // /t/<slug>.<id>/unread — voz.vn's jump-to-first-unread. The thread detail response
      // carries visitor_read_date, so the page is derived here and the URL is replaced by
      // the real one, exactly like voz.vn's server-side redirect.
      if (segments[2] === 'unread') {
        const target = await unreadTarget(threadId);
        const href = `${withPage(threadPath(target.thread), target.page)}${target.postId ? `#post-${target.postId}` : ''}`;
        return navigate(href, { replace: true });
      }
      return await viewThread(threadId, page, Number(params.get('post')) || null);
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
    setTitle('Oops! We ran into some problems.');
    app.innerHTML = '<div class="empty">Không tìm thấy trang.</div>';
  } catch (err) {
    // voz.vn's own error page title, so a failed route is still identifiable in a tab list.
    setTitle('Oops! We ran into some problems.');
    app.innerHTML = errorBox(err);
  } finally {
    refreshUnreadCounts();
  }
}

setRouteHandler(route);
