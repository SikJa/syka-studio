/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
import { readFile, stat, realpath, mkdir, writeFile, rename, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { basename, dirname, isAbsolute, join } from "node:path";
import { HARNESS_LABELS, type HarnessId, type HarnessInfo, type HarnessSettings } from "../protocol";
import type { Harness } from "./harness";
import { AcpHarness } from "./acp";
import { ClaudeCliHarness } from "./claude-cli";
import { resolveBinary, resolveClaudeExecutable, type HostEnv } from './env';
import type { OpenOptions } from './harness';
import { installedAcpHarness } from './installed-agents';
import { AntigravityCliHarness } from './antigravity-cli';
import { openCodeHarness } from './opencode';
import { browserAcpHarness } from './browser-acp';

export const EXTERNAL_HARNESS_IDS = ["antigravity", "claude", "hermes", "cursor", "grok", "opencode"] as const;
// Accept retired entries when reading existing configuration; never load them.
const IDS = [...EXTERNAL_HARNESS_IDS, 'muse'] as const;
/** Config contains paths only. Login credentials remain owned by each official CLI. */
export type ExternalHarnessEntry = { id: typeof IDS[number]; command: string; args?: string[] };

function parseEntries(value: unknown): ExternalHarnessEntry[] {
  if (!Array.isArray(value) || value.length > IDS.length || value.some(e => !IDS.includes(e?.id) || typeof e.command !== 'string' || Object.keys(e).some(k => !['id', 'command', 'args'].includes(k)) || e.args !== undefined && (!Array.isArray(e.args) || !e.args.every((a: unknown) => typeof a === 'string'))) || new Set(value.map(e => e.id)).size !== value.length) throw Error('Formato de configuración inválido. Revisá harnesses.json; no se sobrescribió.');
  return value;
}

export async function readHarnessSettings(configFile: string, profilesRoot: string): Promise<HarnessSettings> {
  try { return { configFile, profilesRoot, entries: parseEntries(JSON.parse(await readFile(configFile, 'utf8'))) }; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { configFile, profilesRoot, entries: [] }; throw error; }
}

/** Called through the authenticated local host, after its busy guard. */
export async function saveHarnessSettings(configFile: string, profilesRoot: string, entry: ExternalHarnessEntry): Promise<HarnessSettings> {
  parseEntries([entry]);
  if (entry.id === 'muse') throw Error('Muse fue retirado. Elegí un proveedor activo.');
  if (!entry.command.trim()) throw Error('Ingresá la ruta absoluta del ejecutable.');
  const command = await validateExecutable(entry);
  const settings = await readHarnessSettings(configFile, profilesRoot);
  const next = { ...settings, entries: [...settings.entries.filter(e => e.id !== entry.id), { ...entry, command }] };
  await mkdir(dirname(configFile), { recursive: true });
  const temporary = `${configFile}.${randomUUID()}.tmp`;
  try { await writeFile(temporary, JSON.stringify(next.entries, null, 2), { encoding: 'utf8', mode: 0o600 }); await rename(temporary, configFile); }
  finally { await unlink(temporary).catch(() => {}); }
  return next;
}

export async function validateExecutable(entry: ExternalHarnessEntry): Promise<string> {
  if (!isAbsolute(entry.command) || /\.(cmd|bat|ps1)$/i.test(entry.command)) throw Error("Usá una ruta absoluta al ejecutable; para un CLI JS, node.exe con el entrypoint absoluto en args.");
  if (entry.args !== undefined && (!Array.isArray(entry.args) || !entry.args.every(a => typeof a === "string" && !a.includes("\0")))) throw Error("Argumentos inválidos.");
  if (entry.args?.some(a => /\.(mjs|cjs|js)$/i.test(a) && !isAbsolute(a))) throw Error("El entrypoint JavaScript debe tener ruta absoluta.");
  const path = await realpath(entry.command);
  if (!(await stat(path)).isFile()) throw Error("El path no corresponde a un archivo ejecutable.");
  for (const arg of entry.args ?? []) if (/\.(mjs|cjs|js)$/i.test(arg) && !(await stat(arg)).isFile()) throw Error("No existe el entrypoint del CLI.");
  return path;
}

function unavailable(id: HarnessId, detail: string): Harness {
  return { id, async probe(): Promise<HarnessInfo> { return { id, label: HARNESS_LABELS[id], status: "not-installed", detail, models: [] }; }, async open() { throw Error(detail); } };
}

/** Detect the official installed Claude CLI at probe time, without changing its global profile. */
function discoverClaude(profilesRoot: string): Harness {
  let delegate: ClaudeCliHarness | undefined;
  const resolve = async (env: HostEnv) => {
    const bundled = join(profilesRoot, '..', 'providers', 'claude', 'node_modules', '@anthropic-ai', `claude-code-${process.platform}-${process.arch}`, process.platform === 'win32' ? 'claude.exe' : 'claude');
    const installed = await stat(bundled).then(value => value.isFile()).catch(() => false);
    const binary = installed ? bundled : resolveBinary('claude', env);
    if (!binary) return undefined;
    const entrypoint = resolveClaudeExecutable(binary);
    const entry: ExternalHarnessEntry = /\.(mjs|cjs|js)$/i.test(entrypoint)
      ? { id: 'claude', command: process.execPath, args: [entrypoint] }
      : { id: 'claude', command: entrypoint };
    try { const command = await validateExecutable(entry); return new ClaudeCliHarness({ ...entry, id: 'claude', command, profileDir: join(profilesRoot, 'claude') }); }
    catch { return undefined; }
  };
  return {
    id: 'claude',
    async probe(env, signal) {
      delegate = await resolve(env);
      return delegate ? delegate.probe(env, signal) : { id: 'claude', label: HARNESS_LABELS.claude, status: 'not-installed', models: [], detail: 'Usá Conectar Claude para preparar el componente oficial y vincular tu cuenta.' };
    },
    async authenticate(env, methodId, signal, hooks) {
      if (!delegate) throw Error('Comprobá la instalación de Claude Code antes de conectar.');
      return delegate.authenticate(env, methodId, signal, hooks);
    },
    async open(options: OpenOptions) {
      if (!delegate) throw Error('Claude Code no está disponible.');
      return delegate.open(options);
    },
  };
}

export async function loadExternalHarnesses(configFile: string, profilesRoot: string): Promise<Harness[]> {
  let entries: ExternalHarnessEntry[];
  try {
    const value = JSON.parse(await readFile(configFile, "utf8"));
    if (!Array.isArray(value) || value.length > IDS.length || value.some(e => !IDS.includes(e?.id) || Object.keys(e).some(k => !["id", "command", "args"].includes(k))) || new Set(value.map(e => e.id)).size !== value.length) throw Error("Invalid config");
    entries = value;
  } catch (error) {
    const missing = (error as NodeJS.ErrnoException).code === "ENOENT";
    return EXTERNAL_HARNESS_IDS.map(id => missing && id === 'opencode' ? openCodeHarness(profilesRoot) : missing && id === 'claude' ? discoverClaude(profilesRoot) : missing && (id === 'hermes' || id === 'antigravity') ? installedAcpHarness(id, profilesRoot) : missing && (id === 'grok' || id === 'cursor') ? browserAcpHarness(id, profilesRoot) : unavailable(id, 'La configuración local requiere revisión; Codex sigue disponible.'));
  }
  return Promise.all(EXTERNAL_HARNESS_IDS.map(async id => {
    const entry = entries.find(e => e.id === id);
    if (!entry) return id === 'opencode' ? openCodeHarness(profilesRoot) : id === 'claude' ? discoverClaude(profilesRoot) : id === 'hermes' || id === 'antigravity' ? installedAcpHarness(id, profilesRoot) : browserAcpHarness(id, profilesRoot);
    try {
      const command = await validateExecutable(entry);
      const profileDir = join(profilesRoot, entry.id);
      if (entry.id === 'opencode') return openCodeHarness(profilesRoot, { ...entry, command });
      if (entry.id === 'grok' || entry.id === 'cursor') return browserAcpHarness(entry.id, profilesRoot, { ...entry, command });
      if (entry.id === 'antigravity' && /^agy(?:\.exe)?$/i.test(basename(command))) return new AntigravityCliHarness({...entry,command,profileDir});
      return entry.id === "claude" ? new ClaudeCliHarness({ ...entry, id: "claude", command, profileDir }) : new AcpHarness({ ...entry, id: entry.id, command, profileDir });
    } catch { return unavailable(entry.id, "Ruta de ejecutable inválida. Usá un archivo absoluto y verificá también el entrypoint si es Node. No se buscó otro en PATH."); }
  }));
}
