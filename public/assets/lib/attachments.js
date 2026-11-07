// Attachment URL resolution for the visual editor.
//
// The API returns attachments separately from the BBCode: a post body carries
// [ATTACH type="full" size="785x768"]3860636[/ATTACH] while the real file URL lives in
// post.Attachments[].attachment_id → direct_url. The codec cannot call the API, so the
// view registers the attachments it already fetched and the editor renders a picture.

const registry = new Map();

function normalise(attachment) {
  if (!attachment || typeof attachment !== 'object') return null;
  const id = Number(attachment.attachment_id);
  if (!id) return null;
  const url = attachment.direct_url || attachment.url || attachment.thumbnail_url;
  if (!/^https:\/\//.test(String(url || ''))) return null;
  return {
    id,
    url,
    thumbnail: attachment.thumbnail_url || url,
    width: Number(attachment.width) || 0,
    height: Number(attachment.height) || 0,
    filename: attachment.filename || '',
    isVideo: attachment.is_video === true,
    isAudio: attachment.is_audio === true,
  };
}

// Registers attachments from one or more posts (`Attachments` arrays or flat lists).
export function registerAttachments(source) {
  const lists = Array.isArray(source) ? source : [source];
  for (const list of lists) {
    if (!list) continue;
    const items = Array.isArray(list) ? list : Array.isArray(list.Attachments) ? list.Attachments : [list];
    for (const item of items) {
      const attachment = normalise(item);
      if (attachment) registry.set(String(attachment.id), attachment);
    }
  }
  return registry.size;
}

export function getAttachment(id) {
  return registry.get(String(id)) || null;
}

// Reverse lookup: the rendered <img> only knows its src, so map it back to the id.
export function attachmentIdForUrl(url) {
  const target = String(url || '');
  if (!target) return null;
  for (const [id, attachment] of registry) {
    if (attachment.url === target) return id;
  }
  return null;
}

export function clearAttachments() {
  registry.clear();
}

// Builds the markup for an attachment id; returns null when the id is unknown so the
// caller can fall back to the raw atomic BBCode instead of dropping the content.
export function attachmentImage(attachment, sizeHint) {
  if (!attachment || attachment.isVideo || attachment.isAudio) return null;
  const src = attachment.url;
  const maxWidth = Number(sizeHint?.width) || attachment.width || 0;
  const maxHeight = Number(sizeHint?.height) || attachment.height || 0;
  return {
    src,
    alt: attachment.filename || `Tệp đính kèm ${attachment.id}`,
    width: maxWidth,
    height: maxHeight,
  };
}