// Formatting helpers shared by every view.

export const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// voz.vn rounds to whole K/M (12301 → 12K, 443764 → 444K, 1274095 → 1M).
export const num = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  if (n >= 1_000_000) return `${Math.round(n / 1_000_000)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
};

export const unix = (seconds) => (seconds ? Number(seconds) * 1000 : 0);

export function timeAgo(seconds) {
  const ms = unix(seconds);
  if (!ms) return '';
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'vừa xong';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ngày trước`;
  return new Date(ms).toLocaleDateString('vi-VN');
}

export function postDate(seconds) {
  return Date.now() - unix(seconds) < 8 * 24 * 60 * 60 * 1000 ? timeAgo(seconds) : fullDate(seconds);
}

export function fullDate(seconds) {
  const ms = unix(seconds);
  if (!ms) return '';
  return new Date(ms).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
