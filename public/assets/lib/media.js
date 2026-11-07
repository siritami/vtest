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
    if (!frame) embed.classList.add('media-embed--fallback');
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
