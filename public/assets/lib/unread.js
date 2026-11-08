// "Jump to first unread post", the way voz.vn's /t/<id>/unread link works.
//
// The XenForo API does not expose the first unread post id: /threads/{id}/posts has no
// read-state filter and /threads/{id}/ ignores `unread=1`. What it does expose, in every
// thread list row, is `visitor_read_date` (Unix seconds of the account's last read inside
// that thread) and `reply_count`. So the page is derived here by walking back from the
// last page until we find the post that follows visitor_read_date.
//
// Walking back (not forward from page 1) matters for long threads: a 1500-reply thread
// usually has its first unread on the last page or two, so this is a couple of requests
// instead of dozens.

const POSTS_PER_PAGE = 20;

// Upper bound on /threads/{id}/posts requests when resolving. A thread where the first
// unread post is hundreds of pages back is pathological; falling back to page 1 (which is
// what a plain thread link does anyway) is better than a long request chain.
const MAX_PAGE_WALKS = 12;

export function threadLastPage(thread) {
  return Math.max(1, Math.ceil(((Number(thread.reply_count) || 0) + 1) / POSTS_PER_PAGE));
}

// Returns { page, postId } for the first unread post, or null when there is nothing unread
// or the read state cannot be resolved.
//
// - `visitorReadDate` null/0 means the account never opened the thread, so everything is
//   unread and page 1 is correct — voz.vn's /unread lands on the first page too.
// - `fetchPostPage(page)` must resolve to `{ posts }` for one page of a thread.
//
// Pages are scanned newest-first. A page that contains any post newer than
// visitorReadDate could hold the first unread one, so the scan keeps walking backwards
// until a page comes back with nothing newer — the last page that did is the answer.
// Posts arrive in ascending position order, so the first newer post on that page is the
// first unread post.
export async function resolveUnread(
  { visitorReadDate, lastPage },
  fetchPostPage,
  { maxWalks = MAX_PAGE_WALKS } = {}
) {
  const readDate = Number(visitorReadDate) || 0;
  if (!readDate) return { page: 1, postId: null };

  const last = Math.max(1, Number(lastPage) || 1);
  let found = null;

  for (let walked = 0, page = last; page >= 1 && walked < maxWalks; page -= 1, walked += 1) {
    let posts;
    try {
      const res = await fetchPostPage(page);
      posts = res && res.posts;
    } catch {
      break; // keep whatever a later page already produced
    }
    if (!posts || !posts.length) break;

    const firstUnread = posts.find((post) => (Number(post.post_date) || 0) > readDate);
    if (!firstUnread) break; // whole page already read → every earlier page is too
    found = { page, postId: firstUnread.post_id };
  }

  return found;
}
