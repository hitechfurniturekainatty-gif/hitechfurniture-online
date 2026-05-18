/**
 * Several quotation-item image columns (notably `item_image_url`) can now
 * hold MULTIPLE newline-separated URLs after the inline media-upload UI was
 * upgraded to support multi-image attachments. Older renderers (PDF, shared
 * preview, delivery note, worker views) expect a single URL string and feed
 * the raw value straight into `<img src=...>`. This helper lets those call
 * sites stay one-liner safe by picking just the first URL.
 */
export const firstUrl = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const first = value.split(/\r?\n/).map((s) => s.trim()).find(Boolean);
  return first ?? null;
};