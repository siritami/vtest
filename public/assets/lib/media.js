window.addEventListener('message', (event) => {
  const resize = (selector) => {
    let payload = event.data;
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch { return null; }
    }
    if (payload === null || payload === undefined) return null;
    return { frame: [...document.querySelectorAll(selector)].find((el) => el.contentWindow === event.source), payload };
  };
  const reddit = ['https://embed.reddit.com', 'https://www.redditmedia.com'].includes(event.origin) ? resize('.media-embed--reddit > iframe') : null;
  if (reddit) {
    if (reddit.payload?.type !== 'resize.embed' || typeof reddit.payload.data !== 'number' || !Number.isFinite(reddit.payload.data)) return;
    reddit.frame.style.height = `${Math.min(3000, Math.max(100, Math.ceil(reddit.payload.data)))}px`;
    return;
  }
  const imgur = event.origin === 'https://imgur.com' ? resize('.media-embed--imgur > iframe') : null;
  if (imgur) {
    // imgur posts { message: "resize_imgur", height, width } after the media loads.
    if (!imgur.frame || imgur.payload?.message !== 'resize_imgur' || typeof imgur.payload.height !== 'number' || !Number.isFinite(imgur.payload.height)) return;
    imgur.frame.style.height = `${Math.min(3000, Math.max(100, Math.ceil(imgur.payload.height)))}px`;
  }
});

const frameRules = [
  ['youtube.com', /^\/embed\/[\w-]+$/],
  ['www.youtube.com', /^\/embed\/[\w-]+$/],
  ['www.youtube-nocookie.com', /^\/embed\/[\w-]+$/],
  ['player.vimeo.com', /^\/video\/\d+$/],
  ['www.dailymotion.com', /^\/embed\/video\/[\w-]+$/],
  ['www.facebook.com', /^\/plugins\/(?:video|post)\.php$/],
  ['open.spotify.com', /^\/embed\/(?:track|album|playlist|episode|show)\/[\w-]+$/],
  ['w.soundcloud.com', /^\/player\/$/],
  ['www.tiktok.com', /^\/(?:player\/v1|embed\/v2)\/\d+\/?$/],
  ['platform.twitter.com', /^\/embed\/Tweet\.html$/],
  ['imgur.com', /^\/[\w-]+\/embed\/?$/],
  ['www.redditmedia.com', /^\/r\/[\w]+\/comments\/[a-z0-9]+(?:\/[\w-]*)?\/?$/i],
  ['embed.reddit.com', /^\/r\/[\w]+\/comments\/[a-z0-9]+(?:\/[\w-]*)?\/?$/i],
];

// Providers the forum embeds via XenForo oEmbed but that have no direct iframe URL.
// voz.vn resolves them server-side with data-xf-init="oembed" and replaces the fallback
// with the returned markup; a still image is what actually ends up in the page.
const OEMBED_SITES = {
  flickr: (key) => `https://www.flickr.com/services/oembed/?url=${encodeURIComponent(`https://flic.kr/p/${key}`)}&format=json`,
};

// Flickr serves pictures from these hosts; anything else from an oEmbed payload is dropped.
const OEMBED_IMAGE_HOSTS = ['live.staticflickr.com', 'staticflickr.com', 'farm1.staticflickr.com', 'farm2.staticflickr.com', 'farm3.staticflickr.com', 'farm4.staticflickr.com', 'farm5.staticflickr.com', 'farm6.staticflickr.com', 'farm8.staticflickr.com', 'farm9.staticflickr.com'];

const oembedCache = new Map();

function safeOembedImage(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return OEMBED_IMAGE_HOSTS.includes(url.hostname) ? url.href : null;
  } catch {
    return null;
  }
}

export function safeMediaUrl(value) {
  try {
    const url = new URL(value, 'https://voz.vn');
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    return frameRules.some(([host, path]) => url.hostname === host && path.test(url.pathname)) ? url.href : null;
  } catch { return null; }
}

function configureFrame(frame, src) {
  // Rebuild rather than trust attributes from server/user HTML.
  for (const attr of [...frame.attributes]) frame.removeAttribute(attr.name);
  frame.src = src;
  frame.title = 'Nội dung media nhúng';
  frame.loading = 'lazy';
  frame.referrerPolicy = 'strict-origin-when-cross-origin';
  frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation allow-popups');
  frame.setAttribute('allow', 'fullscreen; picture-in-picture; encrypted-media');
  frame.setAttribute('allowfullscreen', '');
}

// Fetches the provider's oEmbed payload and swaps the fallback for the picture it
// describes. Runs through our proxy because neither provider sends CORS headers.
//
// sanitizeHtml() builds its markup in a detached document and returns innerHTML, so the
// parsed node is not the one that ends up on the page. This waits for the placeholder to
// arrive in the live document, then fills every copy of it (the same media key can appear
// in more than one post).
const OEMBED_SELECTOR = (site, key) => `[data-media-site-id="${CSS.escape(site)}"][data-id="${CSS.escape(key)}"]`;

function findOembedPlaceholders(site, key, attempts = 40) {
  const selector = OEMBED_SELECTOR(site, key);
  return new Promise((resolve) => {
    const poll = (left) => {
      const found = [...document.querySelectorAll(selector)].filter((el) => el.classList.contains('media-embed--oembed'));
      if (found.length || left <= 0) resolve(found);
      else setTimeout(() => poll(left - 1), 100);
    };
    poll(attempts);
  });
}

async function hydrateOembed(site, key, href) {
  const cacheKey = `${site}:${key}`;
  if (!oembedCache.has(cacheKey)) {
    oembedCache.set(
      cacheKey,
      fetch(`/api/xf/oembed?${new URLSearchParams({ site, key })}`, { headers: { Accept: 'application/json' } })
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null)
    );
  }
  const data = await oembedCache.get(cacheKey);
  const targets = await findOembedPlaceholders(site, key);
  if (!targets.length) return;
  const src = safeOembedImage(data?.url || data?.thumbnail_url);
  if (!src) {
    oembedCache.delete(cacheKey);
    for (const embed of targets) {
      embed.classList.remove('media-embed--oembed');
      embed.classList.add('media-embed--fallback');
    }
    return;
  }
  for (const embed of targets) {
    // A second hydration pass (e.g. re-render) must not stack pictures.
    if (embed.querySelector('img')) {
      embed.classList.remove('media-embed--oembed');
      continue;
    }
    const doc = embed.ownerDocument;
    const link = doc.createElement('a');
    link.href = data.web_page && /^https:\/\/www\.flickr\.com\//.test(data.web_page) ? data.web_page : href;
    link.target = '_blank';
    link.rel = 'noopener nofollow ugc';
    const img = doc.createElement('img');
    img.src = src;
    img.alt = String(data.title || '').slice(0, 200);
    img.loading = 'lazy';
    img.className = 'bbImage';
    if (Number(data.width) > 0) img.width = Number(data.width);
    if (Number(data.height) > 0) img.height = Number(data.height);
    link.append(img);
    embed.replaceChildren(link);
    const source = doc.createElement('a');
    source.href = link.href;
    source.target = '_blank';
    source.rel = 'noopener nofollow ugc';
    source.className = 'media-source';
    source.textContent = 'Xem trên Flickr';
    embed.append(source);
    embed.classList.remove('media-embed--oembed');
    embed.classList.remove('media-embed--fallback');
  }
}

export function restoreMedia(root) {
  for (const frame of root.querySelectorAll('iframe')) {
    const src = safeMediaUrl(frame.getAttribute('src'));
    if (!src) { frame.remove(); continue; }
    configureFrame(frame, src);
    frame.classList.add('media-frame');
  }
  for (const embed of root.querySelectorAll('[data-media-site-id]')) {
    const site = embed.dataset.mediaSiteId.toLowerCase();
    const key = embed.dataset.mediaKey || embed.dataset.id || '';
    let src;
    let href;
    let pendingOembed = false;
    if (['twitter', 'x'].includes(site) && /^\d+$/.test(key)) {
      src = `https://platform.twitter.com/embed/Tweet.html?id=${key}&dnt=true`;
      href = `https://x.com/i/status/${key}`;
    } else if (site === 'tiktok' && /^\d+$/.test(key)) {
      src = `https://www.tiktok.com/player/v1/${key}`;
      href = `https://www.tiktok.com/@_/video/${key}`;
    } else if (site === 'reddit' && /^\w+\/comments\/[a-z0-9]+(?:\/[\w-]*)?\/?$/i.test(key)) {
      src = `https://www.redditmedia.com/r/${key}?ref_source=embed&ref=share&embed=true`;
      href = `https://www.reddit.com/r/${key}`;
    } else if (site === 'youtube' && /^[\w-]{11}$/.test(key)) {
      src = `https://www.youtube.com/embed/${key}`;
      href = `https://www.youtube.com/watch?v=${key}`;
    } else if (site === 'imgur' && /^[\w-]{5,12}$/.test(key)) {
      src = `https://imgur.com/${key}/embed`;
      href = `https://imgur.com/${key}`;
    } else if (OEMBED_SITES[site] && /^[\w-]{3,32}$/.test(key)) {
      // Resolved asynchronously: the payload is a picture, not a frame.
      href = site === 'flickr' ? `https://flic.kr/p/${key}` : '';
      pendingOembed = true;
    }
    let frame = embed.querySelector('iframe');
    if (src) {
      embed.replaceChildren();
      frame = root.ownerDocument.createElement('iframe');
      configureFrame(frame, src);
      frame.className = 'media-frame';
      embed.append(frame);
      const link = root.ownerDocument.createElement('a');
      link.href = href;
      link.target = '_blank';
      link.rel = 'noopener nofollow ugc';
      link.className = 'media-source';
      link.textContent = `Mở trên ${site === 'twitter' ? 'X' : site}`;
      embed.append(link);
    }
    embed.classList.add('media-embed');
    if (site === 'tiktok') embed.classList.add('media-embed--portrait');
    if (site === 'reddit') embed.classList.add('media-embed--reddit');
    if (site === 'imgur') embed.classList.add('media-embed--imgur');
    if (['twitter', 'x', 'reddit'].includes(site)) embed.classList.add('media-embed--social');
    // A pending oEmbed keeps the provider fallback until the picture replaces it.
    if (pendingOembed) {
      embed.classList.add('media-embed--oembed');
      hydrateOembed(site, key, href);
    } else if (!frame) embed.classList.add('media-embed--fallback');
  }
  for (const frame of root.querySelectorAll('iframe.media-frame')) {
    if (!frame.closest('.media-embed')) {
      const wrapper = root.ownerDocument.createElement('div');
      wrapper.className = 'media-embed';
      frame.replaceWith(wrapper);
      wrapper.append(frame);
    }
  }
}
