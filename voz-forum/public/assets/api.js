// Thin client for the edge API. Every voz.vn call goes through /api/xf/*,
// which attaches the guest key or the session bearer token server-side.

const XF = '/api/xf';

export class ApiError extends Error {
  constructor(status, payload) {
    const first = payload && payload.errors && payload.errors[0];
    super((first && first.message) || (payload && payload.error) || `HTTP ${status}`);
    this.status = status;
    this.code = first && first.code;
    this.params = (first && first.params) || [];
    this.payload = payload;
  }
}

function encodeQuery(query) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query || {})) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      for (const item of value) params.append(`${key}[]`, String(item));
    } else if (typeof value === 'boolean') {
      params.append(key, value ? '1' : '0');
    } else {
      params.append(key, String(value));
    }
  }
  return params;
}

export async function xf(path, { method = 'GET', query, body } = {}) {
  const qs = encodeQuery(query).toString();
  const url = `${XF}${path}${qs ? `?${qs}` : ''}`;
  const init = { method, credentials: 'same-origin', headers: { Accept: 'application/json' } };
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    init.body = encodeQuery(body).toString();
  }
  const res = await fetch(url, init);
  const text = await res.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { error: 'bad_response', raw: text.slice(0, 300) };
  }
  if (!res.ok) throw new ApiError(res.status, payload);
  return payload;
}

export const api = {
  me: () => xf('/me/'),
  nodes: () => xf('/nodes/'),
  forum: (id) => xf(`/forums/${id}/`),
  forumThreads: (id, page = 1) => xf(`/forums/${id}/threads`, { query: { page } }),
  threads: (page = 1, order = 'post_date') => xf('/threads/', { query: { page, order } }),
  thread: (id, page = 1) => xf(`/threads/${id}/`, { query: { with_posts: 'true', page } }),
  post: (id) => xf(`/posts/${id}/`),
  createPost: (threadId, message) => xf('/posts/', { method: 'POST', body: { thread_id: threadId, message } }),
  editPost: (id, message) => xf(`/posts/${id}/`, { method: 'POST', body: { message } }),
  deletePost: (id) => xf(`/posts/${id}/`, { method: 'DELETE' }),
  react: (id, reactionId) => xf(`/posts/${id}/react`, { method: 'POST', body: { reaction_id: reactionId } }),
  reactions: () => xf('/voz/reactions'),
  conversations: (page = 1, filter) => xf('/conversations/', { query: { page, ...filter } }),
  conversation: (id, page = 1) => xf(`/conversations/${id}/`, { query: { with_messages: 'true', page } }),
  createConversation: (recipientIds, title, message) =>
    xf('/conversations/', { method: 'POST', body: { recipient_ids: recipientIds, title, message } }),
  replyConversation: (conversationId, message) =>
    xf('/conversation-messages/', { method: 'POST', body: { conversation_id: conversationId, message } }),
  alerts: (page = 1) => xf('/alerts/', { query: { page } }),
  bookmarks: (page = 1) => xf('/voz/bookmarks', { query: { page } }),
  watched: (page = 1) => xf('/voz/watched-threads', { query: { page } }),
  watchThread: (threadId, watch) =>
    xf(`/voz/threads/${threadId}/watch`, { method: 'POST', body: { state: watch ? 'watch' : 'unwatch' } }),
  user: (id) => xf(`/users/${id}/`),
  findUser: (username) => xf('/users/find-name', { query: { username } }),
  search: (keywords) => xf('/search/', { method: 'POST', body: { keywords, search_type: 'post', order: 'date' } }),
  searchResults: (searchId, page = 1) => xf(`/search/${searchId}/`, { query: { page } }),
  stats: () => xf('/stats'),
};

export const auth = {
  status: async () => {
    const res = await fetch('/api/oauth/status', { credentials: 'same-origin' });
    return res.json();
  },
  exchange: async (code, verifier) => {
    const res = await fetch('/api/oauth/exchange', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, verifier }),
    });
    return { ok: res.ok, data: await res.json() };
  },
  useToken: async (tokens) => {
    const res = await fetch('/api/oauth/token', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tokens),
    });
    return { ok: res.ok, data: await res.json() };
  },
  logout: async () => {
    await fetch('/api/oauth/logout', { method: 'POST', credentials: 'same-origin' });
  },
  config: async () => {
    const res = await fetch('/api/config');
    return res.json();
  },
};
