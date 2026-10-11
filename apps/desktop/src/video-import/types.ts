export type VideoImportMetadata = {
  id: string; sourceUrl: string; title: string; channel: string; duration: number | null;
  liveStatus: 'video' | 'archive' | 'live' | 'upcoming' | 'processing';
  thumbnail?: string; chapters: { title: string; start: number; end: number }[];
  requiresRange: boolean;
};
export type VideoImportRange = { start: number; end: number };
export type VideoImportResult = {
  path: string; relativePath: string; provenancePath: string; projectDir: string;
  duration: number; width: number; height: number; frameRate: number; bitRate: number;
  sampleRate?: number; channels?: number; sourceUrl: string; sourceRange: VideoImportRange;
  timelineCreated: boolean;
};
export type VideoImportJob = {
  id: string; url: string; state: 'inspecting' | 'ready' | 'downloading' | 'finalizing' | 'done' | 'cancelled' | 'error';
  metadata?: VideoImportMetadata; percent?: number; message: string; error?: string; result?: VideoImportResult;
};
export type VideoImportRequest =
  | { action: 'inspect'; url: string }
  | { action: 'status' | 'cancel'; id: string }
  | { action: 'start'; id: string; projectDir: string; range?: VideoImportRange; seedTimeline?: boolean };

/** Accept individual public YouTube videos only, never playlists or arbitrary downloader URLs. */
export function youtubeUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) return null;
    const host = url.hostname.toLowerCase();
    const parts = url.pathname.split('/').filter(Boolean);
    const id = host === 'youtu.be' ? parts.length === 1 ? parts[0] : undefined
      : ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(host)
        ? url.pathname === '/watch' ? url.searchParams.get('v') : ['shorts', 'live', 'embed'].includes(parts[0] ?? '') && parts.length === 2 ? parts[1] : undefined
        : undefined;
    return typeof id === 'string' && /^[A-Za-z0-9_-]{11}$/.test(id) ? `https://www.youtube.com/watch?v=${id}` : null;
  } catch { return null; }
}

export function youtubeUrlsInText(text: string): string[] {
  return [...new Set((text.match(/https?:\/\/[^\s<>"']+/gi) ?? []).map(s => youtubeUrl(s.replace(/[),.!?;\]]+$/, ''))).filter((s): s is string => !!s))];
}

export function validateVideoRange(metadata: VideoImportMetadata, range?: VideoImportRange): VideoImportRange {
  if (['live', 'upcoming', 'processing'].includes(metadata.liveStatus)) throw Error('Ese directo todavía no está disponible como video terminado. Volvé cuando termine de procesarse.');
  if (!range && metadata.requiresRange) throw Error('Elegí desde dónde y hasta dónde importar este video largo.');
  const chosen = range ?? { start: 0, end: metadata.duration ?? 0 };
  if (!Number.isFinite(chosen.start) || !Number.isFinite(chosen.end) || chosen.start < 0 || chosen.end <= chosen.start) throw Error('El final tiene que ser posterior al inicio. Usá tiempos válidos.');
  if (chosen.end - chosen.start > 1800) throw Error('Importá hasta 30 minutos por vez. Después podés traer otro tramo.');
  if (metadata.duration !== null && chosen.end > metadata.duration + 0.05) throw Error('El intervalo supera la duración del video.');
  const rounded = { start: Math.round(chosen.start * 1000) / 1000, end: Math.round(chosen.end * 1000) / 1000 };
  if (rounded.end <= rounded.start) throw Error('El intervalo es demasiado corto para importar.');
  return rounded;
}

export function parseVideoTime(text: string): number | null {
  if (!/^\d+(?::\d{1,2}){0,2}(?:\.\d{1,3})?$/.test(text.trim())) return null;
  const parts = text.trim().split(':').map(Number);
  if (parts.slice(1).some(p => p >= 60)) return null;
  return parts.reduce((n, p) => n * 60 + p, 0);
}
export function formatVideoTime(seconds: number): string {
  const n = Math.max(0, Math.floor(seconds)), h = Math.floor(n / 3600), m = Math.floor(n % 3600 / 60), s = n % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

/** Recognize only Syka's untouched blank scaffold, including auto-stamped stage ids. */
export function isEmptyVideoImportStarter(source: string): boolean {
  return /^export default function Project\(\)\s*\{\s*return\s*\(\s*<stage(?:\s+(?:background="#161616"|id="[\w-]+")){1,2}>\s*<\/stage>\s*\)\s*;?\s*\}\s*$/.test(source);
}
