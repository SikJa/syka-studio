import { spawn } from 'node:child_process';
import { realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { resolveLocalTool, type ToolSearch } from './local-tools';

/** Bounded local decoding, shared by audio and visual diagnostics. No shell or writes. */
export function mediaProcess(binary: string, args: string[], maxBytes: number, timeoutMs = 90_000) {
  return new Promise<{ stdout: Buffer; stderr: string }>((ok, fail) => {
    const child = spawn(binary, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks: Buffer[] = []; let bytes = 0, stderr = '', settled = false;
    const finish = (error?: Error) => {
      if (settled) return; settled = true; clearTimeout(timer);
      error ? fail(error) : ok({ stdout: Buffer.concat(chunks), stderr });
    };
    const timer = setTimeout(() => { child.kill(); finish(Error(`El análisis superó ${timeoutMs / 1000} segundos; elegí un tramo más corto.`)); }, timeoutMs);
    child.stdout.on('data', (chunk: Buffer) => {
      if (settled) return;
      bytes += chunk.length;
      if (bytes > maxBytes) { child.kill(); finish(Error('La decodificación excedió el límite de análisis.')); }
      else chunks.push(chunk);
    });
    child.stderr.on('data', chunk => { stderr = (stderr + String(chunk)).slice(-32_000); });
    child.on('error', error => finish(error));
    child.on('close', code => finish(code === 0 ? undefined : Error(stderr || `Decodificación falló (${code}).`)));
  });
}

export async function analysisSource(cwd: string, source: unknown, search?: ToolSearch) {
  if (typeof source !== 'string' || !source || /^[a-z]+:\/\//i.test(source)) throw Error('Se necesita un archivo local dentro del proyecto.');
  const root = await realpath(cwd), candidate = resolve(root, source);
  const inside = (file: string) => { const path = relative(root, file); return !isAbsolute(path) && path !== '..' && !path.startsWith('..' + sep); };
  if (!inside(candidate)) throw Error('El archivo debe estar dentro del proyecto. Importalo con copy:true.');
  const path = await realpath(candidate);
  if (!inside(path) || !(await stat(path)).isFile()) throw Error('El archivo resuelto sale del proyecto o no es un archivo.');
  const toolSearch = search ?? { env: Object.fromEntries(Object.entries(process.env).filter((e): e is [string, string] => typeof e[1] === 'string')) };
  const ffmpeg = resolveLocalTool('ffmpeg', toolSearch).path, ffprobe = resolveLocalTool('ffprobe', toolSearch).path;
  if (!ffmpeg || !ffprobe) throw Error('Configurá FFmpeg y FFprobe en Herramientas locales.');
  return { path, projectPath: relative(root, path), ffmpeg, ffprobe };
}
