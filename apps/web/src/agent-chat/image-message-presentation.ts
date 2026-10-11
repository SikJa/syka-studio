import type { Item } from '@diffusionstudio/agent-chat';
import { generatedImageOutput } from './generated-assets';

/** Restrict duplicate presentation to the same user turn; never rewrite durable history. */
export function imagePathsForMessage(items: Item[], messageId: string): string[] {
  const index = items.findIndex(item => item.id === messageId);
  if (index < 0) return [];
  let start = index, end = index + 1;
  while (start > 0 && items[start].kind !== 'user') start--;
  while (end < items.length && items[end].kind !== 'user') end++;
  return items.slice(start, end).flatMap(item => {
    const output = generatedImageOutput(item);
    return output ? [output.absolutePath] : [];
  });
}

const normalize = (path: string) => {
  const value = path.replaceAll('\\', '/');
  return /^[a-z]:\//i.test(value) ? value.toLowerCase() : value;
};

/** The image card owns these downloads/previews; unrelated files and prose stay visible. */
export function withoutDuplicateImageLinks(body: string, imagePaths: readonly string[]): string {
  if (!imagePaths.length) return body;
  const paths = new Set(imagePaths.map(normalize));
  return body.replace(/!?\[([^\]\n]*)\]\((<[^>\n]+>|[^\n)]+)\)/g, (match, label: string, target: string) => {
    if (!match.startsWith('![') && !/(?:descarg|download)/i.test(label)) return match;
    return paths.has(normalize(target.replace(/^<|>$/g, ''))) ? '' : match;
  });
}
