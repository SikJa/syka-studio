import { open, realpath } from 'node:fs/promises';
import { basename, dirname, relative, sep } from 'node:path';
import { recipeFormat, type RecipeFormat } from '../skill-metadata';
import { resourceFiles, type IndexedResourceFile } from './resource-index';

export type CatalogSkill = { path: string; name: string; file: string; description: string; format: RecipeFormat };
const metadata = new Map<string, { signature: string; description: string; format: RecipeFormat }>();

/** Catalog queries read bounded metadata once per file version, never every instruction body. */
async function describe(file: IndexedResourceFile) {
  const signature = `${file.size}:${file.mtimeMs}:${file.ctimeMs}`;
  const cached = metadata.get(file.path);
  if (cached?.signature === signature) return cached;
  const handle = await open(file.path, 'r');
  let content: string;
  try {
    const buffer = Buffer.alloc(Math.min(file.size, 8192));
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    content = buffer.toString('utf8', 0, bytesRead);
  } finally { await handle.close(); }
  const entry = { signature, description: content.slice(0, 500), format: recipeFormat(content) };
  if (metadata.size >= 2048) metadata.delete(metadata.keys().next().value!);
  metadata.set(file.path, entry);
  return entry;
}

export async function skillCatalog(roots: readonly string[], options: { config: string; legacyRoot?: string; depth?: number; refresh?: boolean }) {
  const result: CatalogSkill[] = [];
  const seen = new Set<string>();
  const legacy = options.legacyRoot ? await realpath(options.legacyRoot).catch(() => '') : '';
  for (const candidate of roots) {
    const root = await realpath(candidate).catch(() => undefined);
    if (!root) continue;
    const { files } = await resourceFiles(root, options.config, ['.md'], options.refresh);
    const entries = files.filter(file => {
      const depth = relative(root, file.path).split(sep).length - 1;
      return depth <= (options.depth ?? 3) && (file.name === 'SKILL.md' || (root === legacy && depth === 0));
    });
    for (let i = 0; i < entries.length; i += 12) {
      const batch = await Promise.all(entries.slice(i, i + 12).map(async file => {
        if (seen.has(file.path)) return;
        seen.add(file.path);
        try {
          const info = await describe(file);
          return { path: dirname(file.path), name: file.name === 'SKILL.md' ? basename(dirname(file.path)) : file.name, file: file.name, description: info.description, format: info.format };
        } catch (error) {
          if (['ENOENT', 'EACCES', 'EPERM'].includes((error as NodeJS.ErrnoException).code ?? '')) return;
          throw error;
        }
      }));
      result.push(...batch.filter((entry): entry is CatalogSkill => !!entry));
    }
  }
  return result;
}

const normalize = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
export function skillSearchPage(roots: string[], catalog: CatalogSkill[], args: { query?: string; offset?: number; limit?: number; maxChars?: number }) {
  const offset = args.offset ?? 0, limit = args.limit ?? 6, maxChars = args.maxChars ?? 6000;
  if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 24 || !Number.isSafeInteger(maxChars) || maxChars < 3000 || maxChars > 12000) throw Error('Invalid skill pagination');
  const query = normalize(args.query?.trim() ?? '');
  const words = query.split(/\s+/).filter(Boolean);
  const matches = catalog.filter(skill => words.every(word => normalize(skill.name + ' ' + skill.description).includes(word)));
  // Stable ranking keeps exact names ahead of prose matches; root order resolves equal scores.
  const rank = (skill: CatalogSkill) => normalize(skill.name) === query ? 2 : normalize(skill.name).includes(query) ? 1 : 0;
  matches.sort((a, b) => rank(b) - rank(a));
  const skills: CatalogSkill[] = [];
  const page = { roots, total: matches.length, offset, nextOffset: null as number | null, skills };
  for (const entry of matches.slice(offset, offset + limit)) {
    skills.push({ ...entry, description: entry.description.slice(0, 280) });
    page.nextOffset = offset + skills.length < matches.length ? offset + skills.length : null;
    if (JSON.stringify(page).length > maxChars) { skills.pop(); break; }
  }
  page.nextOffset = offset + skills.length < matches.length ? offset + skills.length : null;
  if (!skills.length && matches.length > offset) throw Error('Skill catalog paths exceed maxChars; increase the output budget');
  return page;
}
