/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Mixkit music for online pieces: browse its catalogue pages by genre, mood,
// instrument or tag, and bring one track into the project with its licence
// recorded next to it. Mixkit's own search ignores free text, so the
// catalogue's category pages are the index.

import { appendFile, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, sep } from 'node:path';

export const MIXKIT_TOOL = {
  type: 'function', name: 'syka_mixkit',
  description: 'Mixkit stock music, the first source for a new online piece (social, YouTube, online ads) when the user gave no track. action:search lists real tracks from Mixkit category pages (genre, mood, instrument or tag) with id, title, author, duration and tags; compare 3 or more by feel before choosing. action:download saves one track by id into the project (03 Assets reutilizables/Audio/Mixkit) and records title, author, page, licence and date in LICENCIAS-MIXKIT.md. Free under the Mixkit Stock Music Free License for web, social, YouTube and online ads; not for TV/radio broadcast, games or physical media. After downloading, measure its beats with syka_audio_analyze and cut at a strong bar. Use syka_music_create only when the user asked for an original composition or no Mixkit track fits.',
  inputSchema: { type: 'object', additionalProperties: false, properties: {
    action: { type: 'string', enum: ['search', 'download'] },
    categories: { type: 'array', minItems: 1, maxItems: 3, items: { type: 'string', pattern: '^(genre|mood|instrument|tag):[a-z0-9-]{2,40}$' },
      description: 'search: e.g. ["genre:electronic","mood:energetic"], ["tag:technology"], ["instrument:synth"]. Genres include electronic, hip-hop, ambient, cinematic, corporate, pop, rock, chillout, house, lofi; moods include energetic, positive, epic, dramatic, uplifting, calm, dark, futuristic.' },
    page: { type: 'integer', minimum: 1, maximum: 10 },
    id: { type: 'integer', minimum: 1, maximum: 100000, description: 'download: the track id from search.' },
  }, required: ['action'] },
};

export type MixkitTrack = { id: number; title: string; author: string; duration: string; seconds: number | null; tags: string[]; page: string; preview: string };

const SITE = 'https://mixkit.co';
const LICENSE = 'https://mixkit.co/license/#musicFree';
const PREFIX: Record<string, string> = { genre: '', mood: 'mood/', instrument: 'instrument/', tag: 'tag/' };
const decode = (text: string) => text.replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
const toSeconds = (duration: string) => { const match = /^(\d+):(\d{2})$/.exec(duration); return match ? Number(match[1]) * 60 + Number(match[2]) : null; };

/** The tracks one catalogue page lists, in page order. */
export function parseMixkitPage(html: string): MixkitTrack[] {
  const tracks: MixkitTrack[] = [];
  const cards = html.split('data-controller="audio-player"').slice(1);
  for (const card of cards) {
    const id = Number(/data-audio-player-item-id-value="(\d+)"/.exec(card)?.[1]);
    const preview = /data-audio-player-preview-url-value="([^"]+\.mp3)"/.exec(card)?.[1];
    const title = /item-grid-card__title">([^<]*)</.exec(card)?.[1];
    if (!id || !preview || title === undefined) continue;
    const author = decode(/item-grid-music-preview__author">([^<]*)</.exec(card)?.[1] ?? '').replace(/^by\s+/i, '');
    const duration = decode(/data-test-id="duration">([^<]*)</.exec(card)?.[1] ?? '');
    const tags = [...card.split('item-grid-music-preview__meta-time')[0]!.matchAll(/meta-links__link"[^>]*>([^<]+)</g)].map(match => decode(match[1]!));
    tracks.push({ id, title: decode(title), author, duration, seconds: toSeconds(duration), tags, page: `${SITE}/free-stock-music/download/${id}/`, preview });
  }
  return tracks;
}

/** Every track a search has listed in this host's life, so a download can name it. */
const searched = new Map<number, MixkitTrack>();

const within = (root: string, path: string) => { const rel = relative(root, path); return !isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + sep); };

async function fetchText(url: string, signal?: AbortSignal): Promise<string> {
  const response = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (Syka Studio)' }, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000) });
  if (!response.ok) throw Error(`Mixkit respondió ${response.status} en ${url}.`);
  return response.text();
}

type Args = { action?: string; categories?: string[]; page?: number; id?: number };

export async function mixkit(cwd: string, raw: unknown, signal?: AbortSignal): Promise<unknown> {
  const args = (raw ?? {}) as Args;
  if (args.action === 'search') return search(cwd, args, signal);
  if (args.action === 'download') return download(cwd, args, signal);
  throw Error('Usá action:search o action:download.');
}

async function search(cwd: string, args: Args, signal?: AbortSignal) {
  const categories = (args.categories ?? []).filter(category => /^(genre|mood|instrument|tag):[a-z0-9-]{2,40}$/.test(category)).slice(0, 3);
  if (!categories.length) throw Error('Indicá 1–3 categorías, por ejemplo ["genre:electronic","mood:energetic"].');
  const page = args.page && args.page > 1 ? `?page=${args.page}` : '';
  const used = await usedIds(cwd);
  const seen = new Map<number, MixkitTrack & { matches: string[] }>();
  const failures: string[] = [];
  await Promise.all(categories.map(async category => {
    const [kind, slug] = category.split(':') as [string, string];
    try {
      for (const track of parseMixkitPage(await fetchText(`${SITE}/free-stock-music/${PREFIX[kind]}${slug}/${page}`, signal))) {
        searched.set(track.id, track);
        const known = seen.get(track.id);
        if (known) known.matches.push(category);
        else seen.set(track.id, { ...track, matches: [category] });
      }
    } catch (error) { failures.push(`${category}: ${(error as Error).message}`); }
  }));
  // Tracks found under more than one category first: they fit the whole brief.
  const tracks = [...seen.values()].sort((a, b) => b.matches.length - a.matches.length).slice(0, 15)
    .map(track => ({ ...track, usedInThisProject: used.has(track.id) }));
  return { state: tracks.length ? 'found' : 'empty', categories, tracks, failures,
    nextAction: tracks.length ? 'Compare at least three by feel, length and ending; prefer tracks not used in this project. Download the chosen id.' : 'Try other categories or a next page; only then consider syka_music_create.' };
}

async function download(cwd: string, args: Args, signal?: AbortSignal) {
  if (!Number.isInteger(args.id) || args.id! < 1) throw Error('Indicá el id del tema que devolvió la búsqueda.');
  const id = args.id!;
  const root = await realpath(cwd), folder = join(root, '03 Assets reutilizables', 'Audio', 'Mixkit');
  await mkdir(folder, { recursive: true });
  if (!within(root, await realpath(folder))) throw Error('La carpeta de Mixkit sale del proyecto.');
  const page = `${SITE}/free-stock-music/download/${id}/`;
  // Only the catalogue cards name a track; the download link does not.
  const known = searched.get(id);
  const title = known?.title || `Mixkit ${id}`, author = known?.author ?? '';
  const response = await fetch(`https://assets.mixkit.co/music/${id}/${id}.mp3`, { headers: { 'user-agent': 'Mozilla/5.0 (Syka Studio)' }, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(60_000)]) : AbortSignal.timeout(60_000) });
  if (!response.ok) throw Error(`Mixkit no entregó el tema ${id} (${response.status}).`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 10_000) throw Error(`El archivo del tema ${id} llegó incompleto.`);
  const slug = title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  const name = `mixkit-${id}${slug ? `-${slug}` : ''}.mp3`;
  await writeFile(join(folder, name), bytes);
  const ledger = join(folder, 'LICENCIAS-MIXKIT.md');
  const existing = await readFile(ledger, 'utf8').catch(() => '');
  if (!existing) await writeFile(ledger, '# Música de Mixkit\n\nLicencia: Mixkit Stock Music Free License (' + LICENSE + '). Sirve para web, redes, YouTube y publicidad online; no para TV o radio, videojuegos ni soportes físicos.\n\n| Archivo | Título | Autor | Página | Descargado |\n|---|---|---|---|---|\n');
  if (!existing.includes(`| ${name} |`)) await appendFile(ledger, `| ${name} | ${title} | ${author || '—'} | ${page} | ${new Date().toISOString().slice(0, 10)} |\n`);
  const path = relative(root, join(folder, name)).split(sep).join('/');
  return { state: 'downloaded', id, title, author, path, bytes: bytes.length, license: LICENSE, ledger: relative(root, ledger).split(sep).join('/'),
    nextAction: 'Measure its beats with syka_audio_analyze, start it at a strong bar and hang cuts, clicks and the logo hit on its beats.' };
}

async function usedIds(cwd: string): Promise<Set<number>> {
  const ledger = await readFile(join(cwd, '03 Assets reutilizables', 'Audio', 'Mixkit', 'LICENCIAS-MIXKIT.md'), 'utf8').catch(() => '');
  return new Set([...ledger.matchAll(/\| mixkit-(\d+)/g)].map(match => Number(match[1])));
}
