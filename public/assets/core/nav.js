// Navigation helpers. The router registers itself here so views can navigate
// without importing the router (which imports every view).

// The app drives its own scroll position (top of page on navigate, the focused post for a
// #post-… fragment). The browser's scroll restoration runs *after* those calls and would
// restore the previous page's offset, leaving a focused post off-screen.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

let routeHandler = () => {};

export function setRouteHandler(fn) {
  routeHandler = fn;
}

// Path-based routing (History API) so URLs look like /t/845346 instead of /#/t/845346.
export function navigate(path, { replace = false } = {}) {
  if (replace) history.replaceState({}, '', path);
  else history.pushState({}, '', path);
  window.scrollTo({ top: 0 });
  routeHandler();
}

export function currentPage() {
  const params = new URLSearchParams(location.search);
  const page = params.get('page');
  if (!page) return 1;
  if (page === 'last') return 'last';
  return Number(page) || 1;
}
