// voz.vn canonical URLs carry a slug: /t/<slug>.<id>/page-<n>, /f/<slug>.<id>/page-<n>,
// /u/<slug>.<id>/, /direct-messages/<slug>.<id>/. The slug is cosmetic — the numeric
// id is what the API uses — but it is reproduced so links look identical to voz.vn.

export function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Pull the numeric id out of "<slug>.<id>" or a bare "<id>".
export function idFromSegment(segment) {
  const raw = String(segment || '');
  const tail = raw.includes('.') ? raw.slice(raw.lastIndexOf('.') + 1) : raw;
  return Number(tail) || 0;
}

export function threadPath(thread) {
  const slug = slugify(thread.title);
  return slug ? `/t/${slug}.${thread.thread_id}/` : `/t/${thread.thread_id}/`;
}

// voz.vn's unread jump: same path plus an `unread` segment, which its server resolves into
// /page-N#post-<id>. Reproduced so a thread-list link can carry the jump without needing
// the read state at render time.
export function threadUnreadPath(thread) {
  return `${threadPath(thread)}unread`;
}

export function forumPath(forum) {
  const slug = slugify(forum.title);
  return slug ? `/f/${slug}.${forum.node_id}/` : `/f/${forum.node_id}/`;
}

// Aggregated cross-forum nodes (Tin tức iNet, Review sản phẩm, …) use /s/ on voz.vn.
export function searchForumPath(node) {
  const slug = slugify(node.title);
  return slug ? `/s/${slug}.${node.node_id}/` : `/s/${node.node_id}/`;
}

export function userPath(user) {
  const slug = slugify(user.username);
  return slug ? `/u/${slug}.${user.user_id}/` : `/u/${user.user_id}/`;
}

export function dmPath(conversation) {
  const slug = slugify(conversation.title);
  return slug
    ? `/direct-messages/${slug}.${conversation.conversation_id}/`
    : `/direct-messages/${conversation.conversation_id}/`;
}

// voz.vn omits /page-1 and always keeps the trailing slash.
export function withPage(path, page) {
  const n = Number(page) || 1;
  const base = path.endsWith('/') ? path : `${path}/`;
  return n > 1 ? `${base}page-${n}/` : base;
}
