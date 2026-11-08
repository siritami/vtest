// Links inside post bodies. voz.vn posts are full of absolute links to voz.vn itself
// ("https://voz.vn/t/<slug>.<id>/page-2#post-123"), which would kick the reader out of
// this app. Rewrite the paths this project serves back to local ones so the reader stays.
//
// Only the origin is rewritten; the path is passed through untouched, so the local router
// resolves it exactly as voz.vn would. Paths this app has no route for (…/ignore, …/report,
// …/warn, attachments) keep pointing at voz.vn, where the reader can still act on them.

export const VOZ_ORIGIN = 'https://voz.vn';

// Path prefixes the local router understands. Anything else stays on voz.vn.
//   /t/  thread      /f/  forum      /s/  search-forum
//   /u/  member      /p/  single post
//   /search  results /new  latest posts
const LOCAL_PREFIXES = ['/t/', '/f/', '/s/', '/u/', '/p/', '/search', '/new'];

// Member sub-pages that are web-only XenForo routes (they need a cookie session and
// _xfToken, which this app never has). voz-app-api.md §13.5 documents the same limit for
// /attachments/ and /posts/{id}/edit. Keep these on voz.vn instead of routing into a 404.
const VOZ_ONLY_SUFFIXES = ['/ignore', '/unignore', '/report', '/warn', '/follow', '/unfollow'];

export function isVozUrl(value) {
  try {
    return new URL(value, VOZ_ORIGIN).origin === VOZ_ORIGIN;
  } catch {
    return false;
  }
}

// "https://voz.vn/t/a.1/" → "/t/a.1/". Returns null when the link should stay absolute
// (not a voz.vn link, or a web-only path this app cannot serve).
export function localPathFor(value) {
  let url;
  try {
    url = new URL(value, VOZ_ORIGIN);
  } catch {
    return null;
  }
  if (url.origin !== VOZ_ORIGIN) return null;
  const path = url.pathname;
  if (VOZ_ONLY_SUFFIXES.some((suffix) => path.endsWith(suffix))) return null;
  if (!LOCAL_PREFIXES.some((prefix) => path.startsWith(prefix))) return null;
  return `${path}${url.search}${url.hash}`;
}

// Rewrites every <a href> in a parsed document that points at a path this app serves.
// Returns the number of links changed, for tests.
export function rewriteVozLinks(root) {
  let changed = 0;
  for (const anchor of root.querySelectorAll('a[href]')) {
    const local = localPathFor(anchor.getAttribute('href'));
    if (!local) continue;
    anchor.setAttribute('href', local);
    // In-app navigation, so do not force a new tab and keep link--internal styling.
    anchor.removeAttribute('target');
    anchor.setAttribute('rel', 'nofollow ugc');
    anchor.classList.add('link--internal');
    changed += 1;
  }
  return changed;
}
