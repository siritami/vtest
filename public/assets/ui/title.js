// Page titles, mirroring voz.vn's own <title> composition.
//
// voz.vn builds every title as "<name> | VOZ", inserting "| Page N" *between* the name and
// the brand on any page after the first. Page 1 never gets the suffix — /f/phan-mem.13/
// and /f/phan-mem.13/page-1 both resolve to "Phần mềm | VOZ". Verified against the live
// site for the forum, aggregated node, thread, member, search and list pages.

const BRAND = 'VOZ';

// Single writer for document.title so a route change can never leave a stale title behind.
export function setTitle(name, page) {
  const label = String(name == null ? '' : name).trim();
  const n = Number(page) || 1;
  const parts = [];
  if (label) parts.push(label);
  if (n > 1) parts.push(`Page ${n}`);
  parts.push(BRAND);
  document.title = parts.join(' | ');
}

// The home page and the login page carry the bare brand on voz.vn, with no page segment.
export function setBrandTitle() {
  document.title = BRAND;
}

// Thread titles put the prefix *after* the title, joined with a hyphen:
// "Tất tần tật về dịch vụ nextDNS - thảo luận | Page 684 | VOZ". Note this is the opposite
// order from the on-page heading, which shows the label first. Verified on two threads.
export function setThreadTitle(thread, page) {
  const title = String(thread?.title || '').trim();
  const prefix = String(thread?.prefix || '').trim();
  const name = prefix ? `${title} - ${prefix}` : title;
  setTitle(name, page);
}
