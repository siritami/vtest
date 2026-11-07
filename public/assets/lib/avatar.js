// Avatars. voz.vn serves them from data.voz.vn and falls back to a generated
// coloured initial when the member has no image.

import { esc } from '../core/utils.js';

// voz.vn buckets avatar files by floor(user_id / 1000): /avatars/s/1680/1680514.jpg
export function avatarUrlById(userId, size = 's') {
  const id = Number(userId);
  if (!id) return '';
  return `https://data.voz.vn/avatars/${size}/${Math.floor(id / 1000)}/${id}.jpg`;
}

// XenForo's generated avatars cycle through a fixed palette.
const DYNAMIC_AVATAR = [
  ['#66cc66', '#206020'],
  ['#669966', '#1f2e1f'],
  ['#33cc99', '#0f3d2e'],
  ['#339966', '#06130d'],
  ['#66cc33', '#1f3d0f'],
  ['#66cccc', '#206060'],
  ['#99cc66', '#406020'],
];

// Avatar with a coloured initial underneath, so a missing image degrades to the
// same generated avatar voz.vn shows instead of a broken-image icon.
export function avatarMarkup(user, size = 's') {
  const id = Number(user && user.user_id) || 0;
  const urls = (user && user.avatar_urls) || {};
  // A stub user (only id + username) has no avatar_urls at all, so guess the
  // canonical path. A user whose avatar_urls are all null genuinely has no
  // avatar — guessing there would only produce 404s.
  const known = Object.keys(urls).length > 0;
  const src = known
    ? urls[size] || urls.m || urls.l || urls.o || ''
    : avatarUrlById(id, size);
  const [bg, fg] = DYNAMIC_AVATAR[id % DYNAMIC_AVATAR.length];
  const initial = esc(((user && user.username) || '?').slice(0, 1).toUpperCase());
  const img = src
    ? `<img class="avatar-img" src="${esc(src)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`
    : '';
  return `<span class="avatar-fallback" style="background:${bg};color:${fg}"><span aria-hidden="true">${initial}</span>${img}</span>`;
}
