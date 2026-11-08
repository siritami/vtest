// Implements the `data-onerror` contract that voz.vn's server-rendered HTML relies on.
//
// The API hands us XenForo's markup verbatim, and that markup puts
// `data-onerror="hide-parent"` on the favicon of every unfurl (link preview) card. The
// attribute is inert by itself — XenForo binds it in JavaScript we never load — so a dead
// favicon (discord.com's .ico is a common one) would otherwise keep its element and render
// its alt text above the domain name.
//
// `error` does not bubble, hence the capture-phase listener. It is registered once on
// `document` rather than per render, because markup is injected from many views and lazy
// images only fail once they scroll into view, long after boot.

const BOUND = Symbol('vozImageFallbacks');

function handleError(event) {
  const img = event.target;
  if (!img || img.tagName !== 'IMG') return;
  const action = img.getAttribute('data-onerror');
  if (action === 'hide-parent') {
    if (img.parentElement) img.parentElement.hidden = true;
  } else if (action === 'hide') {
    img.hidden = true;
  }
}

export function wireImageFallbacks(doc = document) {
  if (doc[BOUND]) return;
  doc[BOUND] = true;
  doc.addEventListener('error', handleError, true);
}
