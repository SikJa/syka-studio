/** A compact document reference, using the same stack as image attachments. */
export function attachmentCover(name: string, badge?: string): string {
  const escape = (text: string) => text.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]!));
  const extension = badge ?? (name.split('.').length > 1 ? name.split('.').pop()!.slice(0, 5).toUpperCase() : 'ARCHIVO');
  const label = name.length > 23 ? name.slice(0, 20) + '…' : name;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><rect width="240" height="240" rx="24" fill="#202124"/><path d="M89 44h43l24 24v78H89z M132 44v25h24" fill="none" stroke="#b5b7bd" stroke-width="5" stroke-linejoin="round"/><text x="122" y="119" text-anchor="middle" font-family="sans-serif" font-size="23" font-weight="600" fill="#e6e7ea">${escape(extension)}</text><text x="120" y="186" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#d1d2d6">${escape(label)}</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
