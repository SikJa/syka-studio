/* MPL-2.0. Components are prepared only by an explicit Connect action. */
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, realpath, rename, rm, stat, writeFile, copyFile, readdir, chmod } from 'node:fs/promises';
import { basename, delimiter, dirname, isAbsolute, join } from 'node:path';
import { promisify } from 'node:util';
import type { HarnessId } from '../protocol';
import { compareVersions, parseVersion, resolveBinary, resolveClaudeExecutable, resolveCodexExecutable, which, type HostEnv } from './env';
import { childPath, componentFileHashes, downloadArtifact, fileHash, npmArtifact, officialText, officialUrl, unpackBrotliBinary, unpackTarGzip, unpackZip, type Artifact } from './component-artifacts';

export type ProviderComponent = { command: string; args?: string[]; version: string; source: 'installed' | 'managed' };
type Receipt = { schema: 1; provider: string; version: string; command: string; args?: string[]; source: string; integrity: 'upstream' | 'https-local-receipt'; artifactSha256: string; files: Record<string, string> };
type Plan = { artifact: Artifact; version: string; commands: string[]; commandArgs?: Record<string, string[]>; cursorLayout?: boolean; brotliCommands?: string[] };
/** Dependency injection keeps clean-install tests offline and never executes fixtures. */
export type ComponentPreparationOptions = {
  fetcher?: typeof fetch;
  platform?: NodeJS.Platform;
  arch?: string;
  versionOutput?: (command: string, args: string[], env: HostEnv, signal: AbortSignal) => Promise<string | null>;
  publisher?: (command: string, signal: AbortSignal) => Promise<void>;
};
const LABELS: Record<string, string> = { codex: 'Codex', claude: 'Claude Code', antigravity: 'Antigravity', grok: 'Grok Build', cursor: 'Cursor', opencode: 'OpenCode', hermes: 'Hermes', 'node-pty': 'el conector de inicio de sesión' };
const OVERRIDES: Partial<Record<HarnessId, string>> = { codex: 'SYKA_CODEX_PATH', claude: 'SYKA_CLAUDE_PATH', antigravity: 'SYKA_ANTIGRAVITY_PATH', grok: 'SYKA_GROK_PATH', cursor: 'SYKA_CURSOR_PATH', opencode: 'SYKA_OPENCODE_PATH', hermes: 'SYKA_HERMES_PATH' };
const MINIMUM: Partial<Record<HarnessId, string>> = { codex: '0.159.0', claude: '2.0.0', antigravity: '1.2.9', opencode: '1.18.0' };
const inFlight = new Map<string, Promise<ProviderComponent>>();
const terminalInFlight = new Map<string, Promise<string>>();
const file = (path: string) => stat(path).then(value => value.isFile()).catch(() => false);
const key = (env: HostEnv, name: string) => Object.entries(env.env).find(([candidate]) => candidate.toUpperCase() === name)?.[1];
/** Recognize the official versioned package, never reinterpret arbitrary JS routes. */
export async function cursorRuntimeLaunch(entry: string): Promise<{ command: string; args: string[] } | undefined> {
  if (!isAbsolute(entry) || basename(entry).toLowerCase() !== 'index.js') return undefined;
  const directory = dirname(entry);
  const versioned = basename(dirname(directory)).toLowerCase() === 'versions' && /^\d{4}\.\d{1,2}\.\d{1,2}(?:-\d{2}-\d{2}-\d{2})?-[a-f0-9]+$/i.test(basename(directory));
  if ((!versioned && basename(directory).toLowerCase() !== 'dist-package') || !await file(entry)) return undefined;
  const candidates = process.platform === 'win32' ? ['node.exe', 'node'] : ['node', 'node.exe'];
  for (const name of candidates) { const command = join(directory, name); if (await file(command)) return { command, args: [entry] }; }
  return undefined;
}
function override(provider: HarnessId, env: HostEnv): string | undefined {
  return key(env, OVERRIDES[provider] ?? '') ?? (provider === 'codex' || provider === 'claude' ? key(env, `DIFFUSION_${provider.toUpperCase()}_PATH`) : undefined);
}
function activate(provider: HarnessId, env: HostEnv, component: ProviderComponent) {
  // Claude's npm launcher is a JS entrypoint run by our bundled Node. Keep
  // that entrypoint as its route; node.exe itself is not Claude Code.
  const route = component.args?.[0] && /\.(mjs|cjs|js)$/i.test(component.args[0]) ? component.args[0] : component.command;
  const name = OVERRIDES[provider]; if (name) env.env[name] = route;
  const directory = dirname(component.command);
  if (!env.extraDirs.includes(directory)) env.extraDirs.unshift(directory);
  env.env.PATH = [...new Set([directory, ...(key(env, 'PATH') ?? '').split(delimiter).filter(Boolean)])].join(delimiter);
}
function componentRoot(runtimeDir: string) {
  if (!isAbsolute(runtimeDir)) throw Error('La carpeta interna de Syka debe ser absoluta.');
  return join(runtimeDir, 'providers');
}
async function safeDirectory(root: string, path: string) {
  const target = childPath(root, path);
  // Every component path is owned by Syka, never an alias into a user's install.
  for (let cursor = target; cursor !== dirname(root); cursor = dirname(cursor)) {
    try { if ((await lstat(cursor)).isSymbolicLink()) throw Error('La carpeta del componente contiene un enlace; no se modificó.'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    if (cursor === root) break;
  }
  return target;
}
async function receiptAt(provider: string, runtimeDir: string): Promise<{ root: string; receipt: Receipt } | undefined> {
  const base = componentRoot(runtimeDir), root = await safeDirectory(base, provider);
  try {
    const receipt = JSON.parse(await readFile(join(root, 'syka-component.json'), 'utf8')) as Receipt;
    if (receipt.schema !== 1 || receipt.provider !== provider || !/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/.test(receipt.version ?? '') || typeof receipt.command !== 'string' || isAbsolute(receipt.command)
      || receipt.args !== undefined && (!Array.isArray(receipt.args) || receipt.args.length > 16 || receipt.args.some(arg => typeof arg !== 'string' || !arg || arg.startsWith('-') || isAbsolute(arg)))
      || !receipt.files || typeof receipt.files !== 'object' || !/^[a-f0-9]{64}$/.test(receipt.artifactSha256)) throw Error('El registro del componente necesita revisión.');
    for (const [name, hash] of Object.entries(receipt.files)) {
      const path = await safeDirectory(root, name);
      if (!/^[a-f0-9]{64}$/.test(hash) || !await file(path) || await fileHash(path) !== hash) throw Error('El componente interno está incompleto o cambió; reintentá Conectar para repararlo.');
    }
    if (!receipt.files[receipt.command] || !await file(childPath(root, receipt.command))) throw Error('El ejecutable del componente está incompleto.');
    for (const arg of receipt.args ?? []) {
      const path = await safeDirectory(root, arg);
      if (!receipt.files[arg] || !await file(path)) throw Error('El entrypoint del componente está incompleto.');
    }
    return { root, receipt };
  } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error; }
}
/** Reuse a verified component at startup; never downloads or starts a login. */
export async function resolveManagedComponent(provider: HarnessId, env: HostEnv, runtimeDir: string): Promise<ProviderComponent | undefined> {
  const current = override(provider, env);
  if (current !== undefined && !current.startsWith(componentRoot(runtimeDir) + (process.platform === 'win32' ? '\\' : '/'))) return undefined;
  const installed = await receiptAt(provider, runtimeDir); if (!installed) return undefined;
  if (MINIMUM[provider] && compareVersions(installed.receipt.version, MINIMUM[provider]!) < 0) return undefined;
  const component: ProviderComponent = { command: childPath(installed.root, installed.receipt.command), ...(installed.receipt.args?.length ? { args: installed.receipt.args.map(arg => childPath(installed.root, arg)) } : {}), version: installed.receipt.version, source: 'managed' };
  activate(provider, env, component); return component;
}

async function installedComponent(provider: HarnessId, env: HostEnv): Promise<{ command: string; args?: string[] } | undefined> {
  const selected = override(provider, env);
  if (selected !== undefined) {
    if (!isAbsolute(selected) || !await file(selected)) throw Error(`La ruta configurada para ${LABELS[provider]} no existe o no es un archivo. No se usó otra instalación.`);
    if (provider === 'cursor') { const launch = await cursorRuntimeLaunch(selected); if (launch) return launch; }
    return { command: selected };
  }
  if (provider === 'codex' || provider === 'claude') {
    const resolved = resolveBinary(provider, env); if (!resolved) return undefined;
    const native = provider === 'codex' ? resolveCodexExecutable(resolved) : resolveClaudeExecutable(resolved);
    return /\.(mjs|cjs|js)$/i.test(native) ? { command: process.execPath, args: [native] } : { command: native };
  }
  const name = provider === 'antigravity' ? 'agy' : provider === 'cursor' ? 'agent' : provider;
  const direct = which(name, env) ?? (provider === 'cursor' ? which('cursor-agent', env) : null);
  if (direct && !/\.(cmd|bat|ps1)$/i.test(direct)) return { command: direct };
  // npm's launch shims are not executables; use its published native package.
  if (provider === 'opencode' || provider === 'grok') {
    const native = process.platform === 'win32' ? `${provider}.exe` : provider;
    const roots = [...(key(env, 'PATH') ?? '').split(delimiter).filter(Boolean), ...env.extraDirs];
    for (const root of roots) {
      const paths = provider === 'opencode'
        ? [join(root, 'node_modules', 'opencode-ai', 'bin', native), join(root, 'node_modules', 'opencode-ai', 'node_modules', `opencode-windows-${process.arch}`, 'bin', native), join(root, 'node_modules', 'opencode-ai', 'node_modules', 'opencode-windows-x64-baseline', 'bin', native)]
        : [join(root, 'node_modules', '@xai-official', 'grok', 'node_modules', '@xai-official', `grok-${process.platform}-${process.arch}`, 'bin', native)];
      for (const path of paths) if (await file(path)) return { command: path };
    }
  }
  return undefined;
}
async function componentVersion(provider: HarnessId, command: string, args: string[] | undefined, env: HostEnv, signal: AbortSignal, options: ComponentPreparationOptions): Promise<string | undefined> {
  signal.throwIfAborted();
  const output = await (options.versionOutput ?? nativeVersionOutput)(command, [...(args ?? []), '--version'], { ...env, env: { ...env.env, AGY_CLI_DISABLE_AUTO_UPDATE: 'true', OPENCODE_DISABLE_AUTOUPDATE: 'true' } }, signal);
  signal.throwIfAborted();
  if (provider === 'codex' && !/\bcodex(?:-cli)?\b/i.test(output ?? '') || provider === 'claude' && !/Claude Code/i.test(output ?? '')) return undefined;
  const version = parseVersion(output);
  if (provider === 'cursor' && !/^\d{4}\.\d{1,2}\.\d{1,2}$/.test(version ?? '')) return undefined;
  return version && (!MINIMUM[provider] || compareVersions(version, MINIMUM[provider]!) >= 0) ? version : undefined;
}
async function nativeVersionOutput(command: string, args: string[], env: HostEnv, signal: AbortSignal): Promise<string | null> {
  try {
    const { stdout } = await promisify(execFile)(command, args, { env: env.env, signal, timeout: 10_000, windowsHide: true, shell: false, encoding: 'utf8', maxBuffer: 64 * 1024 });
    return stdout;
  } catch (error) {
    signal.throwIfAborted();
    const stdout = (error as { stdout?: unknown }).stdout;
    return typeof stdout === 'string' && stdout.trim() ? stdout : null;
  }
}

async function nativeNpmPlan(provider: 'codex' | 'grok' | 'opencode', platform: NodeJS.Platform, arch: string, signal: AbortSignal, fetcher: typeof fetch): Promise<Plan> {
  const mainName = provider === 'codex' ? '@openai/codex' : provider === 'grok' ? '@xai-official/grok' : 'opencode-ai';
  const { metadata } = await npmArtifact(mainName, 'latest', signal, fetcher);
  const nativeName = provider === 'opencode' ? `opencode-${platform === 'win32' ? 'windows' : platform}-${arch}${arch === 'x64' ? '-baseline' : ''}` : `${provider === 'codex' ? '@openai' : '@xai-official'}/${provider}-${platform}-${arch}`;
  const requested = metadata.optionalDependencies?.[nativeName];
  if (typeof requested !== 'string') throw Error(`${LABELS[provider]} no publica un componente nativo para este sistema.`);
  const alias = /^npm:((?:@[a-z0-9-]+\/)?[a-z0-9-]+)@(\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?)$/.exec(requested);
  const native = await npmArtifact(alias?.[1] ?? nativeName, alias?.[2] ?? requested, signal, fetcher);
  const extension = platform === 'win32' ? '.exe' : '';
  const triple = platform === 'win32' ? `${arch === 'arm64' ? 'aarch64' : 'x86_64'}-pc-windows-msvc` : platform === 'darwin' ? `${arch === 'arm64' ? 'aarch64' : 'x86_64'}-apple-darwin` : `${arch === 'arm64' ? 'aarch64' : 'x86_64'}-unknown-linux-musl`;
  const commands = provider === 'codex' ? [`vendor/${triple}/bin/codex${extension}`, `vendor/${triple}/codex/codex${extension}`] : [`bin/${provider}${extension}`, `${provider}${extension}`];
  return { artifact: native.artifact, version: metadata.version, commands, ...(provider === 'grok' ? { brotliCommands: commands } : {}) };
}
async function providerPlan(provider: HarnessId, signal: AbortSignal, options: ComponentPreparationOptions): Promise<Plan> {
  const platform = options.platform ?? process.platform, arch = options.arch ?? process.arch, fetcher = options.fetcher ?? fetch;
  if (!['win32', 'darwin', 'linux'].includes(platform) || !['x64', 'arm64'].includes(arch)) throw Error('Todavía no hay un componente compatible con este sistema y arquitectura.');
  if (provider === 'codex' || provider === 'grok' || provider === 'opencode') return nativeNpmPlan(provider, platform, arch, signal, fetcher);
  if (provider === 'claude') {
    const base = 'https://downloads.claude.ai/claude-code-releases';
    const version = (await officialText(`${base}/latest`, signal, fetcher)).trim();
    if (!/^\d+\.\d+\.\d+$/.test(version)) throw Error('Claude Code devolvió una versión inválida.');
    const manifest = JSON.parse(await officialText(`${base}/${version}/manifest.json`, signal, fetcher));
    const checksum = manifest.platforms?.[`${platform}-${arch}`]?.checksum;
    if (!/^[a-f0-9]{64}$/.test(checksum ?? '')) throw Error('Claude Code no ofrece un manifiesto válido para este sistema.');
    const command = platform === 'win32' ? 'claude.exe' : 'claude';
    return { version, commands: [command], artifact: { url: `${base}/${version}/${platform}-${arch}/${command}`, format: 'binary', hash: { algorithm: 'sha256', value: checksum } } };
  }
  if (provider === 'antigravity') {
    if (platform !== 'win32') throw Error('La preparación automática de Antigravity todavía está disponible en Windows.');
    const manifest = JSON.parse(await officialText(`https://antigravity-cli-auto-updater-974169037036.us-central1.run.app/manifests/windows_${arch === 'arm64' ? 'arm64' : 'amd64'}.json`, signal, fetcher));
    if (!/^\d+\.\d+\.\d+$/.test(manifest.version ?? '') || !/^[a-f0-9]{128}$/.test(manifest.sha512 ?? '')) throw Error('Antigravity devolvió un manifiesto inválido.');
    const url = officialUrl(manifest.url); if (url.hostname !== 'storage.googleapis.com') throw Error('La descarga de Antigravity no corresponde a su distribuidor oficial.');
    return { version: manifest.version, commands: ['agy.exe'], artifact: { url: url.href, format: 'binary', hash: { algorithm: 'sha512', value: manifest.sha512 } } };
  }
  if (provider === 'cursor') {
    if (platform !== 'win32') throw Error('La preparación automática de Cursor todavía está disponible en Windows.');
    // Read the official script as data; never execute its PATH/global deletion.
    const script = await officialText('https://cursor.com/install?win32=true', signal, fetcher);
    const base = /^\$downloadUrl\s*=\s*'(https:\/\/downloads\.cursor\.com\/lab\/[^']+\/)'\s*$/m.exec(script)?.[1];
    const version = /^\$version\s*=\s*'([0-9]{4}\.[0-9]{2}\.[0-9]{2}-[a-f0-9]+)'\s*$/m.exec(script)?.[1];
    if (!base || !version || new URL(base).pathname !== `/lab/${version}/`) throw Error('El instalador oficial de Cursor cambió; no se ejecutó una descarga desconocida.');
    const node = `versions/${version}/node.exe`, entry = `versions/${version}/index.js`;
    return { version, commands: ['cursor-agent.exe', node], commandArgs: { [node]: [entry] }, cursorLayout: true, artifact: { url: `${base}windows/${arch}/agent-cli-package.zip`, format: 'zip' } };
  }
  throw Error(provider === 'hermes' ? 'No encontramos Hermes. La instalación automática de su entorno todavía no está disponible en Syka.' : 'Este proveedor ya no está disponible para conectar.');
}
async function cursorPublisher(command: string, signal: AbortSignal) {
  if (process.platform !== 'win32') return;
  const literalPath = "'" + command.replaceAll("'", "''") + "'";
  // A Node host launched from PowerShell 7 can inherit its PSModulePath.
  // Windows PowerShell 5.1 must load its own security module, not that of pwsh.
  const script = `$ErrorActionPreference='Stop'; Import-Module ([IO.Path]::Combine($PSHOME,'Modules','Microsoft.PowerShell.Security','Microsoft.PowerShell.Security.psd1')) -Force; $s=Get-AuthenticodeSignature -LiteralPath ${literalPath}; [pscustomobject]@{status=[string]$s.Status;subject=if($s.SignerCertificate){$s.SignerCertificate.Subject}else{""}} | ConvertTo-Json -Compress`;
  const { stdout } = await promisify(execFile)('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { signal, timeout: 20_000, windowsHide: true, encoding: 'utf8', maxBuffer: 4096 });
  const result = JSON.parse(stdout);
  if (result.status === 'NotSigned') return; // HTTPS provenance + local receipt, not an upstream checksum.
  const publisher = basename(command).toLowerCase() === 'node.exe' ? /OpenJS|Node\.js/i : /Anysphere|Cursor/i;
  if (result.status !== 'Valid' || !publisher.test(result.subject ?? '')) throw Error('La firma del componente de Cursor no es válida.');
}

async function installPlan(provider: string, plan: Plan, runtimeDir: string, signal: AbortSignal, progress: ((message: string) => void) | undefined, options: ComponentPreparationOptions, validate: (command: string, args?: string[]) => Promise<string>): Promise<ProviderComponent> {
  const base = componentRoot(runtimeDir); await mkdir(base, { recursive: true });
  const destination = await safeDirectory(base, provider), stage = await safeDirectory(base, `.prepare-${provider}-${randomUUID()}`), previous = await safeDirectory(base, `.previous-${provider}-${randomUUID()}`);
  const archive = await safeDirectory(base, `.download-${provider}-${randomUUID()}`);
  await mkdir(stage); let backedUp = false, promoted = false;
  try {
    progress?.(`Descargando ${LABELS[provider] ?? provider}…`); let last = -1;
    const artifactSha256 = await downloadArtifact(plan.artifact, archive, signal, options.fetcher, (received, size) => {
      const percent = size ? Math.floor(received / size * 100) : undefined;
      if (percent !== undefined && percent !== last) { last = percent; progress?.(`Descargando ${LABELS[provider] ?? provider}: ${percent}%`); }
    });
    signal.throwIfAborted(); progress?.(`Verificando ${LABELS[provider] ?? provider}…`);
    if (plan.artifact.format === 'binary') {
      const target = childPath(stage, plan.commands[0]!); await copyFile(archive, target);
      if (process.platform !== 'win32') await chmod(target, 0o755);
    }
    else if (plan.artifact.format === 'tgz') await unpackTarGzip(archive, stage, signal);
    else await unpackZip(archive, stage, signal);
    for (const name of plan.brotliCommands ?? []) {
      const target = await safeDirectory(stage, name), compressed = await safeDirectory(stage, name + '.br');
      if (!await file(target) && await file(compressed)) await unpackBrotliBinary(compressed, target, signal);
    }
    if (plan.cursorLayout) {
      const source = childPath(stage, 'dist-package'), versions = childPath(stage, 'versions');
      await mkdir(versions); await rename(source, childPath(versions, plan.version));
      for (const entry of await readdir(childPath(versions, plan.version), { withFileTypes: true })) if (entry.isFile() && /^cursor-agent[^\\/]*$/.test(entry.name)) await copyFile(join(versions, plan.version, entry.name), childPath(stage, entry.name));
    }
    let commandName: string | undefined;
    for (const name of plan.commands) if (await file(childPath(stage, name))) { commandName = name; break; }
    if (!commandName) throw Error('El paquete oficial no contiene el ejecutable esperado.');
    const relativeArgs = plan.commandArgs?.[commandName];
    for (const arg of relativeArgs ?? []) if (isAbsolute(arg) || !await file(await safeDirectory(stage, arg))) throw Error('El paquete oficial no contiene el entrypoint esperado.');
    const command = childPath(stage, commandName), args = relativeArgs?.map(arg => childPath(stage, arg));
    const version = await validate(command, args); signal.throwIfAborted();
    const receipt: Receipt = { schema: 1, provider, version, command: commandName, ...(relativeArgs?.length ? { args: relativeArgs } : {}), source: plan.artifact.url, integrity: plan.artifact.hash ? 'upstream' : 'https-local-receipt', artifactSha256, files: await componentFileHashes(stage) };
    await writeFile(childPath(stage, 'syka-component.json'), JSON.stringify(receipt, null, 2), { mode: 0o600 });
    signal.throwIfAborted();
    if (await stat(destination).then(() => true).catch(() => false)) { await rename(destination, previous); backedUp = true; }
    await rename(stage, destination); promoted = true;
    return { command: childPath(destination, commandName), ...(relativeArgs?.length ? { args: relativeArgs.map(arg => childPath(destination, arg)) } : {}), version, source: 'managed' };
  } catch (error) { if (backedUp && !promoted) await rename(previous, destination); throw error; }
  finally {
    await rm(archive, { force: true }); await rm(stage, { recursive: true, force: true });
    if (backedUp && promoted) await rm(previous, { recursive: true, force: true });
  }
}

/** Explicit UI action only. Does not install globally, modify credentials or log in. */
export async function prepareProviderComponent(provider: HarnessId, env: HostEnv, runtimeDir: string, signal: AbortSignal, progress?: (message: string) => void, options: ComponentPreparationOptions = {}): Promise<ProviderComponent> {
  signal.throwIfAborted(); const id = join(componentRoot(runtimeDir), provider), running = inFlight.get(id); if (running) return running;
  const action = (async () => {
    progress?.(`Comprobando ${LABELS[provider] ?? provider}…`);
    const explicit = override(provider, env); let corruptManaged = false;
    try { const managed = await resolveManagedComponent(provider, env, runtimeDir); if (managed) return managed; }
    catch (error) { if (explicit !== undefined && !explicit.startsWith(componentRoot(runtimeDir))) throw error; corruptManaged = true; progress?.('Reparando el componente interno…'); }
    // Never execute a managed binary that failed its receipt verification.
    const installed = corruptManaged ? undefined : await installedComponent(provider, env);
    if (installed) {
      const version = await componentVersion(provider, installed.command, installed.args, env, signal, options);
      if (version) { const component = { ...installed, version, source: 'installed' as const }; activate(provider, env, component); return component; }
      if (explicit !== undefined && !explicit.startsWith(componentRoot(runtimeDir))) throw Error(`La ruta configurada no respondió como una versión compatible de ${LABELS[provider]}. No se cambió por otra instalación.`);
      progress?.(`Preparando una versión compatible de ${LABELS[provider]}…`);
    }
    const plan = await providerPlan(provider, signal, options);
    const component = await installPlan(provider, plan, runtimeDir, signal, progress, options, async (command, args) => {
      if (provider === 'cursor') await (options.publisher ?? cursorPublisher)(command, signal);
      const version = await componentVersion(provider, command, args, env, signal, options);
      if (!version) throw Error(`El componente descargado no respondió como ${LABELS[provider]}.`);
      if (provider !== 'cursor' && version !== plan.version) throw Error('El componente descargado no coincide con su versión oficial.');
      if (provider === 'cursor' && compareVersions(version, parseVersion(plan.version)!) !== 0) throw Error('Cursor no respondió con la versión del paquete oficial.');
      return version;
    });
    activate(provider, env, component); return component;
  })();
  inFlight.set(id, action);
  try { return await action; } finally { if (inFlight.get(id) === action) inFlight.delete(id); }
}

/** Official Microsoft native PTY, pinned and extracted without install scripts. */
export async function prepareLoginTerminal(env: HostEnv, runtimeDir: string, signal: AbortSignal, progress?: (message: string) => void, options: ComponentPreparationOptions = {}): Promise<string> {
  if ((options.platform ?? process.platform) !== 'win32' || !['x64', 'arm64'].includes(options.arch ?? process.arch)) throw Error('El conector de inicio de sesión requiere Windows de 64 bits.');
  signal.throwIfAborted();
  const id = componentRoot(runtimeDir), running = terminalInFlight.get(id);
  if (running) { const directory = await running; signal.throwIfAborted(); env.env.SYKA_AUTH_TERMINAL_MODULE = directory; return directory; }
  const action = prepareTerminalPackage(); terminalInFlight.set(id, action);
  try { return await action; } finally { if (terminalInFlight.get(id) === action) terminalInFlight.delete(id); }
  async function prepareTerminalPackage(): Promise<string> {
  const reuse = await receiptAt('node-pty', runtimeDir).catch(() => undefined);
  if (reuse?.receipt.version === '1.1.0' && reuse.receipt.command === 'lib/index.js') { env.env.SYKA_AUTH_TERMINAL_MODULE = reuse.root; return reuse.root; }
  const { artifact } = await npmArtifact('node-pty', '1.1.0', signal, options.fetcher);
  const component = await installPlan('node-pty', { artifact, version: '1.1.0', commands: ['lib/index.js'] }, runtimeDir, signal, progress, options, async command => {
    const root = dirname(dirname(command)), packageInfo = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
    if (packageInfo.name !== 'node-pty' || packageInfo.version !== '1.1.0') throw Error('El paquete de terminal no es el componente oficial esperado.');
    const native = join(root, 'prebuilds', `win32-${options.arch ?? process.arch}`, 'conpty.node');
    if (!await file(native) || !await file(join(root, 'prebuilds', `win32-${options.arch ?? process.arch}`, 'conpty_console_list.node'))
      || !await file(join(root, 'prebuilds', `win32-${options.arch ?? process.arch}`, 'conpty', 'OpenConsole.exe'))
      || !await file(join(root, 'prebuilds', `win32-${options.arch ?? process.arch}`, 'conpty', 'conpty.dll'))) throw Error('El paquete de terminal no incluye un componente nativo completo para esta arquitectura.');
    return '1.1.0';
  });
  const root = await realpath(dirname(dirname(component.command))); env.env.SYKA_AUTH_TERMINAL_MODULE = root; return root;
  }
}
