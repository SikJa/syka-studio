import { nativeImage } from 'electron';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, realpath, stat, unlink, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, dirname } from 'node:path';
import { NOTICE_ATTACHMENT_MAX_BYTES, NOTICE_ATTACHMENT_MAX_COUNT, NOTICE_ATTACHMENT_MAX_TOTAL_BYTES } from '../../../packages/agent-chat/src/notifications';
import type { NoticeImage } from '../../../packages/agent-chat/src/notifications';
import { ffmpegPath } from './syka-agent-settings';
import { notificationAttachmentInfo, validateNotificationVideo } from './notification-attachment-info';
import { localToolPath } from './syka-dependencies';

type StoredImage = { owner: string; root: string; directory: string; path: string; image: NoticeImage };

/** The overlay receives opaque IDs, never permission to write arbitrary paths. */
export class NotificationImages {
  private images = new Map<string, StoredImage>();
  private serial = Promise.resolve();

  add(owner: string, projectDir: string, name: string, bytes: Uint8Array): Promise<NoticeImage> {
    const task = this.serial.catch(() => {}).then(() => this.store(owner, projectDir, name, bytes));
    this.serial = task.then(() => {}, () => {});
    return task;
  }

  private async store(owner: string, projectDir: string, name: string, bytes: Uint8Array): Promise<NoticeImage> {
    if (!(bytes instanceof Uint8Array) || bytes.length > NOTICE_ATTACHMENT_MAX_BYTES) throw Error('El archivo debe pesar hasta 100 MB.');
    if (typeof name !== 'string' || !name.trim()) throw Error('El archivo necesita un nombre.');
    const owned = [...this.images.values()].filter(entry => entry.owner === owner);
    if (owned.length >= NOTICE_ATTACHMENT_MAX_COUNT || owned.reduce((n, entry) => n + entry.image.size, bytes.length) > NOTICE_ATTACHMENT_MAX_TOTAL_BYTES) throw Error('Podés adjuntar hasta 4 archivos y 150 MB por respuesta.');
    const data = Buffer.from(bytes);
    const info = notificationAttachmentInfo(name, data);
    let previewUrl: string | undefined;
    if (info.kind === 'image') {
      let decoded = nativeImage.createFromBuffer(data);
      if (decoded.isEmpty() && ['image/webp','image/gif'].includes(info.mimeType)) decoded = nativeImage.createFromBuffer(await thumbnail(data, info.mimeType));
      const size = decoded.getSize();
      if (decoded.isEmpty()) throw Error('No se pudo leer la foto.');
      const ratio = Math.min(1, 64 / Math.max(size.width, size.height));
      previewUrl = decoded.resize({ width: Math.max(1, Math.round(size.width * ratio)), height: Math.max(1, Math.round(size.height * ratio)), quality: 'good' }).toDataURL();
    }
    const root = await realpath(projectDir);
    let directory = root;
    // Check each existing/new directory before creating the next one. A linked
    // assets folder must not send an upload outside its original project.
    for (const part of ['03 Assets reutilizables', 'Adjuntos']) {
      const next = join(directory, part);
      await mkdir(next).catch(error => { if (error.code !== 'EEXIST') throw error; });
      directory = await realpath(next);
      if (!inside(root, directory)) throw Error('La carpeta de adjuntos sale del proyecto.');
    }
    const id = randomUUID(), path = join(directory, `respuesta-${id}.${info.extension}`);
    await writeFile(path, data, { flag: 'wx' });
    try {
      if (info.kind === 'video') {
        const probe = localToolPath('ffprobe');
        if (!probe) throw Error('Falta FFprobe para preparar el video. Revisá Dependencias en Syka.');
        const metadata = await mediaOutput(probe, ['-v','error','-protocol_whitelist','file','-select_streams','v:0','-show_entries','format=format_name:stream=codec_type,width,height','-of','json',path]);
        validateNotificationVideo(info.extension, JSON.parse(metadata.toString('utf8')));
        const ffmpeg = ffmpegPath();
        if (!ffmpeg) throw Error('Falta FFmpeg para preparar el video. Revisá Dependencias en Syka.');
        const poster = await mediaOutput(ffmpeg, ['-hide_banner','-loglevel','error','-max_alloc','167772160','-threads','1','-protocol_whitelist','file','-i',path,'-map','0:v:0','-frames:v','1','-vf','scale=64:64:force_original_aspect_ratio=decrease','-threads','1','-filter_threads','1','-f','image2pipe','-c:v','png','pipe:1']);
        const decoded = nativeImage.createFromBuffer(poster);
        if (decoded.isEmpty()) throw Error('No se pudo preparar la miniatura del video.');
        previewUrl = decoded.toDataURL();
      }
    } catch (error) { await unlink(path).catch(() => {}); throw error; }
    const image = { id, name: name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 160), mimeType: info.mimeType, size: data.length, previewUrl };
    this.images.set(id, { owner, root, directory, path, image });
    return image;
  }

  async paths(owner: string, ids: string[] = []): Promise<string[]> {
    if (!Array.isArray(ids) || ids.length > NOTICE_ATTACHMENT_MAX_COUNT || new Set(ids).size !== ids.length) throw Error('Adjuntos inválidos.');
    const paths: string[] = [];
    for (const id of ids) {
      const entry = this.images.get(id);
      if (!entry || entry.owner !== owner) throw Error('El archivo pertenece a otra pregunta o ya fue quitado.');
      const actual = await realpath(entry.path).catch(() => '');
      if (!actual || !inside(entry.root, actual) || dirname(actual) !== entry.directory || (await stat(actual)).size !== entry.image.size) throw Error('El archivo ya no está disponible. Volvé a adjuntarlo.');
      paths.push(actual);
    }
    return paths;
  }

  async remove(owner: string, id: string): Promise<void> {
    const entry = this.images.get(id);
    if (!entry || entry.owner !== owner) throw Error('El archivo no corresponde a esta pregunta.');
    // Unlink only our own staged file. Never follow a replaced directory.
    if (await realpath(dirname(entry.path)).catch(() => '') !== entry.directory) throw Error('La carpeta del archivo cambió.');
    await unlink(entry.path).catch(error => { if (error.code !== 'ENOENT') throw error; });
    this.images.delete(id);
  }

  commit(owner: string, ids: string[]): void {
    for (const id of ids) if (this.images.get(id)?.owner === owner) this.images.delete(id);
  }

  async discard(owner: string): Promise<void> {
    for (const [id, entry] of this.images) if (entry.owner === owner) await this.remove(owner, id).catch(() => {});
  }
}

function inside(root: string, path: string): boolean {
  const rel = relative(root, path);
  return !!rel && rel !== '..' && !rel.startsWith('..' + (process.platform === 'win32' ? '\\' : '/')) && !isAbsolute(rel);
}

function thumbnail(data: Buffer, mimeType: string): Promise<Buffer> {
  const command = ffmpegPath();
  if (!command) throw Error('Falta FFmpeg para preparar esta foto. Revisá Dependencias en Syka.');
  const input = mimeType === 'image/gif' ? ['-f','gif'] : ['-f','image2pipe','-c:v','webp'];
  return mediaOutput(command, ['-hide_banner','-loglevel','error','-max_alloc','167772160','-threads','1',...input,'-i','pipe:0','-frames:v','1','-vf','scale=64:64:force_original_aspect_ratio=decrease','-threads','1','-filter_threads','1','-f','image2pipe','-c:v','png','pipe:1'], data);
}

function mediaOutput(command: string, args: string[], input?: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, stdio: ['pipe','pipe','pipe'] });
    let length = 0; const parts: Buffer[] = [];
    const timer = setTimeout(() => { child.kill(); reject(Error('El archivo tardó demasiado en prepararse.')); }, 8000);
    child.stdout.on('data', chunk => { length += chunk.length; if (length > 1024 * 1024) child.kill(); else parts.push(chunk); });
    child.stderr.resume(); child.stdin.on('error', () => {});
    child.once('error', () => { clearTimeout(timer); reject(Error('No se pudo preparar el archivo.')); });
    child.once('close', code => { clearTimeout(timer); code === 0 && length && length <= 1024 * 1024 ? resolve(Buffer.concat(parts)) : reject(Error('No se pudo leer el archivo.')); });
    child.stdin.end(input);
  });
}
