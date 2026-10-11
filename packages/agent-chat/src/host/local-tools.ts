import { accessSync, constants, statSync } from 'node:fs';
import { delimiter, dirname, isAbsolute, join } from 'node:path';
import { which } from './env';

export const LOCAL_TOOL_NAMES = ['codex', 'node', 'git', 'python', 'ffmpeg', 'ffprobe', 'yt-dlp'] as const;
export type LocalToolName = typeof LOCAL_TOOL_NAMES[number];
export type LocalToolStatus = {
  name: LocalToolName; path: string | null; source: 'override' | 'managed' | 'system' | 'missing';
  issue?: string;
};
export type ToolSearch = { env: Record<string, string>; roots?: string[]; extraDirs?: string[] };
function executable(path: string): boolean {
  try {
    if (!isAbsolute(path) || !statSync(path).isFile()) return false;
    if (process.platform !== 'win32') accessSync(path, constants.X_OK);
    return true;
  } catch { return false; }
}
export function resolveLocalTool(name: LocalToolName, search: ToolSearch): LocalToolStatus {
  const env = Object.fromEntries(Object.entries(search.env).map(([key, value]) => [key.toUpperCase(), value]));
  const override = env[`SYKA_${name.toUpperCase().replaceAll('-', '_')}_PATH`] ?? (name === 'codex' ? env.DIFFUSION_CODEX_PATH : undefined);
  if (override) return executable(override)
    ? { name, path: override, source: 'override' }
    : { name, path: null, source: 'missing', issue: `La ruta configurada para ${name} no es un ejecutable local válido.` };
  const suffix = process.platform === 'win32' ? '.exe' : '';
  for (const root of search.roots ?? []) {
    for (const dir of [join(root, name, 'bin'), join(root, name), ...(name === 'ffprobe' ? [join(root, 'ffmpeg', 'bin')] : []), join(root, 'bin'), root]) {
      const path = join(dir, name + suffix);
      if (executable(path)) return { name, path, source: 'managed' };
    }
  }
  const found = which(name, { env, extraDirs: search.extraDirs ?? [] });
  return { name, path: found, source: found ? 'system' : 'missing' };
}
/** No installs, downloads, network calls or version execution. */
export function detectLocalTools(search: ToolSearch): LocalToolStatus[] {
  return LOCAL_TOOL_NAMES.map(name => resolveLocalTool(name, search));
}
export function addToolDirectories(env: Record<string, string>, tools: LocalToolStatus[]): Record<string, string> {
  const current = Object.entries(env).find(([key]) => key.toUpperCase() === 'PATH')?.[1] ?? '';
  const { dirs, codex } = tools.reduce((result, tool) => {
    if (tool.path) { result.dirs.push(dirname(tool.path)); if (tool.name === 'codex') result.codex = tool.path; }
    return result;
  }, { dirs: [] as string[], codex: '' });
  const next = Object.fromEntries(Object.entries(env).filter(([key]) => key.toUpperCase() !== 'PATH'));
  return { ...next, PATH: [...new Set([...dirs, ...current.split(delimiter)].filter(Boolean))].join(delimiter),
    ...(codex ? { SYKA_CODEX_PATH: codex } : {}) };
}
