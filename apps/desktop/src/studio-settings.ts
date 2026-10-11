import { app } from 'electron';
import { lstat, mkdir, open, readFile, readdir, rename, statfs, unlink } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { MAIN_CHANNELS } from './main-channels';
import type { mainBridge } from './main-manager';
import { defaultBrand, type BrandKit, type BrandState, type StorageArea, type ProjectStorageArea } from './studio-settings-types';
export type { BrandKit, BrandState, StorageArea, StudioStorage, StudioSettingsRequest, StudioSettingsResult } from './studio-settings-types';
export { defaultBrand } from './studio-settings-types';

function normalizeBrand(raw: unknown): BrandKit {
  if (!raw || typeof raw !== 'object') throw Error('El brand kit es inválido.');
  const value = raw as Record<string, unknown>;
  const text = (key: string, limit: number) => {
    if (typeof value[key] !== 'string' || (value[key] as string).length > limit) throw Error('Revisá el campo ' + key + '.');
    return (value[key] as string).trim();
  };
  const name = text('name', 80), website = text('website', 2048), font = text('font', 80), voice = text('voice', 1500);
  if (website) { const url = new URL(website); if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw Error('Usá una URL web sin credenciales.'); }
  if (!font) throw Error('Elegí una tipografía.');
  if (typeof value.primary !== 'string' || typeof value.secondary !== 'string' || !/^#[0-9a-f]{6}$/i.test(value.primary) || !/^#[0-9a-f]{6}$/i.test(value.secondary)) throw Error('Usá colores hexadecimales de seis dígitos.');
  let logo: string | undefined;
  if (value.logo !== undefined) {
    if (typeof value.logo !== 'string' || value.logo.length > 400_000 || !/^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/.test(value.logo)) throw Error('Elegí un logo PNG, JPEG o WebP válido.');
    const bytes = Buffer.from(value.logo.slice(value.logo.indexOf(',') + 1), 'base64');
    if (bytes.length < 12 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') throw Error('El logo no es una imagen WebP válida.');
    logo = value.logo;
  }
  return { name, website, font, voice, primary: value.primary.toUpperCase(), secondary: value.secondary.toUpperCase(), ...(logo ? { logo } : {}) };
}

/** Serialized CAS writes prevent a second settings window from losing a brand edit. */
export class StudioSettingsStore {
  private tail: Promise<unknown> = Promise.resolve();
  readonly file: string;
  constructor(file: string) { this.file = file; }
  async get(): Promise<BrandState> {
    try {
      if ((await lstat(this.file)).size > 600_000) throw Error('El archivo de configuración es demasiado grande.');
      const data = JSON.parse(await readFile(this.file, 'utf8'));
      if (data.version !== 1 || !Number.isSafeInteger(data.revision) || data.revision < 0) throw Error('Formato de configuración inválido.');
      return { revision: data.revision, brand: normalizeBrand(data.brand) };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { revision: 0, brand: { ...defaultBrand } };
      throw Error('No se pudo leer el brand kit. El archivo original se conserva.', { cause: error });
    }
  }
  save(expectedRevision: number, raw: unknown): Promise<BrandState> {
    const operation = this.tail.catch(() => undefined).then(async () => {
      const brand = normalizeBrand(raw), current = await this.get();
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision !== current.revision) throw Error('El brand kit cambió en otra ventana. Volvé a cargarlo antes de guardar.');
      const next = { version: 1, revision: current.revision + 1, brand };
      await mkdir(dirname(this.file), { recursive: true });
      const temporary = this.file + '.' + randomUUID() + '.tmp';
      try {
        const handle = await open(temporary, 'wx');
        try { await handle.writeFile(JSON.stringify(next, null, 2)); await handle.sync(); } finally { await handle.close(); }
        await rename(temporary, this.file);
      } catch (error) { await unlink(temporary).catch(() => undefined); throw error; }
      return { revision: next.revision, brand };
    });
    this.tail = operation;
    return operation;
  }
}

export async function measureStorage(name: string, path: string): Promise<StorageArea> {
  const area: StorageArea = { name, path, bytes: 0, files: 0, partial: false };
  let visited = 0;
  const walk = async (directory: string, depth: number): Promise<void> => {
    if (depth > 10 || visited >= 12_000) { area.partial = true; return; }
    const info = await lstat(directory);
    if (info.isSymbolicLink()) return;
    if (info.isFile()) { area.bytes += info.size; area.files++; return; }
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (++visited > 12_000) { area.partial = true; break; }
      if (entry.isSymbolicLink()) continue;
      try { await walk(join(directory, entry.name), depth + 1); } catch { area.partial = true; }
    }
  };
  try { await walk(path, 0); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') area.unavailable = true; }
  return area;
}

export async function measureProjects(projects: { name: string; path: string }[]): Promise<ProjectStorageArea[]> {
  const seen = new Set<string>();
  const unique = projects.filter(project => {
    if (typeof project?.path !== 'string' || !isAbsolute(project.path) || typeof project.name !== 'string') return false;
    const path = resolve(project.path), key = process.platform === 'win32' ? path.toLowerCase() : path;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
  const areas: ProjectStorageArea[] = new Array(unique.length);
  let next = 0;
  // Bound concurrent walks so a large library doesn't overwhelm the disk.
  await Promise.all(Array.from({ length: Math.min(4, unique.length) }, async () => {
    while (next < unique.length) {
      const index = next++, project = unique[index]!;
      try {
        const info = await lstat(project.path);
        if (!info.isDirectory() || info.isSymbolicLink()) throw Error('Carpeta no disponible');
        const area = await measureStorage(project.name, project.path);
        const availableBytes = await statfs(project.path).then(disk => disk.bsize * disk.bavail).catch(() => undefined);
        areas[index] = { ...area, ...(availableBytes === undefined ? {} : { availableBytes }) };
      } catch { areas[index] = { name: project.name, path: project.path, bytes: 0, files: 0, partial: false, unavailable: true }; }
    }
  }));
  return areas;
}

export function registerStudioSettings(bridge: typeof mainBridge) {
  const runtime = process.env.SYKA_RUNTIME_ROOT || app.getPath('userData');
  const store = new StudioSettingsStore(join(runtime, 'studio-settings.json'));
  bridge.handle(MAIN_CHANNELS.SYKA_STUDIO_SETTINGS, async request => {
    if (request.action === 'get') return store.get();
    if (request.action === 'save-brand') return store.save(request.expectedRevision, request.brand);
    if (request.action !== 'storage') throw Error('Acción de configuración desconocida.');
    const profile = app.getPath('userData');
    const [state, areas, disk, projects] = await Promise.all([
      store.get(),
      Promise.all([
        measureStorage('Borradores y conexiones de Zernio', join(profile, 'providers', 'zernio')),
        measureStorage('Skills personales', join(runtime, 'codex-runtime', 'profile', 'skills')),
        measureStorage('Historial de skills', join(runtime, 'skill-history')),
        measureStorage('Brand kit', store.file),
        measureStorage('Preferencias del editor', join(profile, 'Local Storage')),
        measureStorage('Datos locales del editor', join(profile, 'IndexedDB')),
      ]),
      statfs(profile).then(info => info.bsize * info.bavail).catch(() => undefined),
      measureProjects(request.projects ?? []),
    ]);
    return { ...state, storage: { profile, areas, projects, ...(disk === undefined ? {} : { availableBytes: disk }) } };
  });
}
