import { app } from 'electron';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { MAIN_CHANNELS } from '../main-channels';
import type { mainBridge } from '../main-manager';
import { getProject, readManifest, writeManifest } from '../projects';
import { agentToolEnvironment, localToolPath } from '../syka-dependencies';
import { commitSourceEdit } from '../../../../packages/agent-chat/src/host/edit-journal';
import { VideoImportService } from './service';
import { isEmptyVideoImportStarter } from './types';
import { reportNotice } from '../notifications';

const integrations = new Map<string, Promise<boolean>>();
function serialIntegration(dir: string, integrate: () => Promise<boolean>): Promise<boolean> {
  const key = process.platform === 'win32' ? dir.toLowerCase() : dir;
  const next = (integrations.get(key) ?? Promise.resolve(false)).catch(() => false).then(integrate);
  integrations.set(key, next);
  void next.finally(() => { if (integrations.get(key) === next) integrations.delete(key); }).catch(() => {});
  return next;
}

let importsBusy = () => false;
export function hasActiveVideoImports(): boolean { return importsBusy(); }
export function registerVideoImport(bridge: typeof mainBridge): void {
  const command = (name: 'yt-dlp' | 'ffprobe') => { const path = localToolPath(name); return path ? { command: path } : undefined; };
  const allowedEnvironment = new Set(['PATH', 'PATHEXT', 'COMSPEC', 'SYSTEMROOT', 'WINDIR', 'HOME', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP', 'TMPDIR', 'LANG', 'LC_ALL', 'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY', 'SSL_CERT_FILE', 'SSL_CERT_DIR', 'REQUESTS_CA_BUNDLE', 'CURL_CA_BUNDLE']);
  const downloadEnvironment = () => Object.fromEntries(Object.entries(agentToolEnvironment()).filter(([key]) => allowedEnvironment.has(key.toUpperCase())));
  const service = new VideoImportService({
    onFinished: (job, projectDir) => { void reportNotice(projectDir, { kind: job.state === 'done' ? 'download' : 'blocked', operationId: job.id, message: job.state === 'done' ? 'El video se descargó y se agregó a la biblioteca del proyecto.' : job.error || 'La descarga se detuvo.', ...(job.result ? { artifact: job.result.path } : {}) }).catch(console.error); },
    runtimeDir: process.env.SYKA_RUNTIME_ROOT || app.getPath('userData'),
    ytDlp: () => command('yt-dlp'), ffmpeg: () => localToolPath('ffmpeg'), ffprobe: () => command('ffprobe'), node: () => localToolPath('node'), env: downloadEnvironment,
    validateProject: async dir => { if (!await getProject(dir)) throw Error('Abrí o creá un proyecto antes de importar.'); },
    integrate: (result, metadata, seedTimeline) => serialIntegration(result.projectDir, async () => {
      const raw = await readManifest(result.projectDir) as { version: number; folders: string[]; assets: unknown[] } | null;
      const manifest = raw?.version === 1 && Array.isArray(raw.assets) && Array.isArray(raw.folders) ? raw : { version: 1, folders: [], assets: [] };
      const info = await stat(result.path);
      const label = metadata.title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 100);
      const base = `Importados/${label} (${result.sourceRange.start}s–${result.sourceRange.end}s)`;
      const known = new Set(manifest.assets.map(asset => (asset as { path?: string }).path));
      let assetPath = `${base}.mp4`;
      for (let suffix = 2; known.has(assetPath); suffix++) assetPath = `${base} (${suffix}).mp4`;
      manifest.assets.push({ id: `youtube-${metadata.id}-${info.mtimeMs}`, path: assetPath, source: result.relativePath, type: 'VIDEO', mimeType: 'video/mp4', createdAt: new Date().toISOString(), stat: { size: info.size, mtime: info.mtimeMs }, width: result.width, height: result.height, duration: result.duration, frameRate: result.frameRate, bitRate: result.bitRate, ...(result.sampleRate ? {sampleRate:result.sampleRate,channels:result.channels} : {}), sourceUrl: result.sourceUrl, sourceRange: result.sourceRange });
      if (!manifest.folders.includes('Importados')) manifest.folders.push('Importados');
      await writeManifest(result.projectDir, manifest);
      if (!seedTimeline) return false;
      const project = await getProject(result.projectDir);
      if (!project) return false;
      const before = await readFile(join(result.projectDir, project.entry), 'utf8');
      // Only replace our untouched empty starter. Existing edits always survive an import.
      if (!isEmptyVideoImportStarter(before)) return false;
      const after = `export default function Project() {\n  return <stage><scene id="main" name={${JSON.stringify(metadata.title)}} width={${result.width}} height={${result.height}} active workarea={[0, ${result.duration}]}><video id="imported-video" name={${JSON.stringify(metadata.title)}} src={${JSON.stringify(result.relativePath)}} width={${result.width}} height={${result.height}} start={0} end={${result.duration}} /></scene></stage>;\n}\n`;
      await commitSourceEdit({ projectDir: result.projectDir, filePath: project.entry, before, after, origin: 'manual', label: 'Importar video de YouTube' });
      return true;
    }),
  });
  importsBusy = () => service.active();
  bridge.handle(MAIN_CHANNELS.SYKA_VIDEO_IMPORT, async request => {
    if (request.action === 'inspect') return service.inspect(request.url);
    if (request.action === 'status') return service.status(request.id);
    if (request.action === 'cancel') return service.cancel(request.id);
    if (request.action === 'start') return service.start(request.id, request.projectDir, request.range, request.seedTimeline);
    throw Error('Acción de importación inválida.');
  });
}
