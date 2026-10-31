import type { HarnessId, HarnessInfo } from '../protocol';

/**
 * The small, cheap model of each provider, by family name, so titles never
 * spend the person's main model. First match in the provider's own catalog.
 */
const SMALL: Partial<Record<HarnessId, RegExp[]>> = {
  codex: [/luna/i, /mini/i],
  claude: [/^haiku$/i, /haiku/i],
  antigravity: [/flash.*low/i, /flash/i],
  opencode: [/mini(?!-flex)/i, /flash/i, /luna/i],
};

export function titleModel(info: HarnessInfo | undefined): string | undefined {
  if (!info || info.status !== 'ready') return undefined;
  for (const pattern of SMALL[info.id] ?? []) {
    const model = info.models.find(entry => pattern.test(entry.id) || pattern.test(entry.label));
    if (model) return model.id;
  }
}

export const TITLE_INSTRUCTIONS = 'You name video projects. Reply with the title only: no quotes, no explanation, no tools.';

export function titlePrompt(text: string): string {
  return `Escribí un título corto y claro (de 2 a 6 palabras), en el mismo idioma del pedido, para este proyecto de video. Respondé solo con el título.\n\nPedido:\n${text.replace(/\s+/g, ' ').trim().slice(0, 1500)}`;
}

/** First line, without quotes, markdown or a trailing period; null when unusable. */
export function cleanTitle(raw: string): string | null {
  const line = raw.split('\n').map(part => part.trim()).find(Boolean) ?? '';
  const title = line.replace(/^(t[ií]tulo|title)\s*:\s*/i, '').replace(/^[#*_\s"'“”«»`]+|[*_\s"'“”«»`.]+$/g, '').replace(/\s+/g, ' ').trim();
  if (title.length < 2 || title.length > 80 || /[<>\\/]/.test(title)) return null;
  return title;
}
