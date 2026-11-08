// Long quoted posts would otherwise push the rest of the thread off the screen: the post in
// thread 1296038 carries a quote 13.700px tall. voz.vn clips any quote whose content passes
// 800px and fades it into a "Click to expand..." button — this reproduces that.
export const MAX_QUOTE_HEIGHT = 800;

function expandableQuote(quote) {
  // The threshold is on the *content*, not the whole blockquote: a quote that is barely over
  // the limit would otherwise gain a button that reveals two pixels.
  const content = quote.scrollHeight;
  if (content <= MAX_QUOTE_HEIGHT) return;
  // The header (author link) stays outside the clip so the reader always sees whose post is
  // being quoted, exactly like voz.vn's `.bbCodeBlock-title`.
  const head = quote.querySelector('.quote-source');
  const body = quote.ownerDocument.createElement('div');
  body.className = 'quote-expand-content';
  let node = head ? head.nextSibling : quote.firstChild;
  while (node) {
    const next = node.nextSibling;
    body.append(node);
    node = next;
  }
  if (!body.childNodes.length) return;

  const link = quote.ownerDocument.createElement('button');
  link.type = 'button';
  link.className = 'quote-expand-link';
  link.setAttribute('aria-expanded', 'false');
  const label = quote.ownerDocument.createElement('span');
  label.textContent = 'Bấm để mở rộng...';
  link.append(label);
  link.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const expanded = quote.classList.toggle('is-expanded');
    link.setAttribute('aria-expanded', String(expanded));
    label.textContent = expanded ? 'Thu gọn' : 'Bấm để mở rộng...';
  });

  quote.append(body, link);
  quote.classList.add('is-expandable');
}

export function wireQuoteExpansion(root = document) {
  for (const quote of root.querySelectorAll('blockquote.xfBb-quote:not(.is-expandable)')) {
    expandableQuote(quote);
  }
}

let scheduled = false;

// Quotes can only be measured once they are in the live DOM and laid out, so this runs on an
// animation frame after the view renders (the same pattern the other post features use).
function scheduleQuoteExpansion() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    wireQuoteExpansion();
  });
}

export function wireAllQuoteExpansion() {
  scheduleQuoteExpansion();
  // Views replace #app and infinite scroll appends whole pages, so watch the whole body.
  new MutationObserver(scheduleQuoteExpansion).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('resize', scheduleQuoteExpansion);
  // A quote holding a picture measures short until the picture decodes, which would leave a
  // quote that should be collapsible fully open. Re-measure once any image arrives.
  document.addEventListener('load', (event) => {
    if (event.target instanceof HTMLImageElement && event.target.closest('blockquote.xfBb-quote')) scheduleQuoteExpansion();
  }, true);
}

export function restoreQuoteLinks(root, bbcode) {
  const source = String(bbcode || '').replace(/\[(code|php|html)(?:=[^\]]*)?\][\s\S]*?\[\/\1\]/gi, '');
  const quotes = [...source.matchAll(/\[quote(?:=([^\]]*))?\]/gi)].map((match) => {
    const value = (match[1] || '').replace(/^['"]|['"]$/g, '');
    const post = value.match(/,\s*post:\s*(\d+)/i);
    return { name: value.split(/,\s*(?:post|member):/i)[0], id: post?.[1] };
  });
  let index = 0;
  for (const quote of root.querySelectorAll('blockquote.xfBb-quote')) {
    const meta = quotes[index++];
    if (!meta?.id || meta.name !== quote.getAttribute('data-name')) continue;
    const link = root.ownerDocument.createElement('a');
    link.className = 'quote-source';
    link.href = `/p/${meta.id}/`;
    link.textContent = `${meta.name} đã viết: ↑`;
    quote.prepend(link);
    quote.classList.add('has-quote-source');
  }
}
