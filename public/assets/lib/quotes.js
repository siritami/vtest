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
