/** Keep inspection output independent of the number of formats and fragments.
 * Full --dump-single-json payloads for long archives can be many megabytes. */
export const YTDLP_METADATA_TEMPLATE = '%(.{_type,id,title,channel,uploader,duration,is_live,was_live,live_status,thumbnail,chapters})j';
export const YTDLP_METADATA_ARGS = ['--skip-download', '--print', YTDLP_METADATA_TEMPLATE] as const;

/** YouTube's fragmented progressive MP4 can require reading the preceding
 * video to seek. HLS exposes the section as segments and preserves H.264/AAC.
 * Keep ordinary format selection available when the video has no public HLS. */
export function youtubeSectionFormat(fallback: string): string {
  return 'bv*[height<=1080][vcodec^=avc1][protocol^=m3u8]+ba[protocol^=m3u8]/b[height<=1080][vcodec^=avc1][protocol^=m3u8]/' + fallback;
}
// yt-dlp's --socket-timeout does not reach its external FFmpeg downloader.
export const YTDLP_FFMPEG_NETWORK_ARGS = ['--downloader-args', 'ffmpeg_i:-rw_timeout 20000000'] as const;

export function parseVideoToolJson(output: string, kind: 'metadata' | 'probe'): Record<string, any> {
  try {
    const value: unknown = JSON.parse(output.replace(/^\uFEFF/, '').trim());
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
  } catch { /* Do not expose a partial payload, stream URLs, or SyntaxError noise. */ }
  throw Error(kind === 'metadata'
    ? 'El descargador devolvió metadatos incompletos o inválidos. No se pudo leer el video; volvé a intentar. Este error no indica que necesites iniciar sesión.'
    : 'No se pudo leer la información del archivo de video descargado. No se importó el archivo.');
}

/** Text logs may retain their tail; JSON must remain whole or fail explicitly. */
export class VideoToolOutput {
  private value = '';
  private bytes = 0;
  private overflow = false;
  private readonly json: boolean;
  private readonly maxBytes: number;
  constructor(json: boolean, maxBytes = 8 * 1024 * 1024) { this.json = json; this.maxBytes = maxBytes; }
  append(text: string): void {
    if (this.overflow) return;
    if (!this.json) { this.value = (this.value + text).slice(-this.maxBytes); return; }
    this.bytes += Buffer.byteLength(text, 'utf8');
    if (this.bytes > this.maxBytes) { this.overflow = true; this.value = ''; return; }
    this.value += text;
  }
  read(): string {
    if (this.overflow) throw Error('La herramienta devolvió demasiados metadatos. Se detuvo la lectura sin recortar el JSON; no se importó el video.');
    return this.value;
  }
}
