import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm, readFile, readdir, copyFile, chmod } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';
import { brotliCompressSync, gzipSync } from 'node:zlib';
import { cursorRuntimeLaunch, prepareProviderComponent, prepareLoginTerminal, resolveManagedComponent, type ComponentPreparationOptions } from '../src/host/provider-components';
import { downloadArtifact, officialFetch, unpackTarGzip } from '../src/host/component-artifacts';
import { resolveBinary, type HostEnv } from '../src/host/env';

const roots: string[] = [];
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });
async function setup() { const root = await mkdtemp(join(tmpdir(), 'syka-provider-components-')); roots.push(root); return root; }
function host(root: string): HostEnv { return { env: { PATH: root, USERPROFILE: root, HOME: root }, extraDirs: [] }; }
function tar(files: Record<string, string | Buffer>, type = '0'): Buffer {
  const entries: Buffer[] = [];
  for (const [name, text] of Object.entries(files)) {
    const bytes = Buffer.isBuffer(text) ? text : Buffer.from(text), header = Buffer.alloc(512);
    header.write(name, 0, 100); header.write('0000755\0', 100, 8); header.write(bytes.length.toString(8).padStart(11, '0') + '\0', 124, 12);
    header.write('        ', 148, 8); header.write(type, 156, 1); header.write('ustar\0', 257, 6);
    header.write(header.reduce((sum, value) => sum + value, 0).toString(8).padStart(6, '0') + '\0 ', 148, 8);
    entries.push(header, bytes, Buffer.alloc((512 - bytes.length % 512) % 512));
  }
  return gzipSync(Buffer.concat([...entries, Buffer.alloc(1024)]));
}
function zip(files: Record<string, string>): Buffer {
  const chunks: Buffer[] = [], directory: Buffer[] = []; let offset = 0;
  for (const [name, value] of Object.entries(files)) {
    const bytes = Buffer.from(value), filename = Buffer.from(name); let crc = 0xffffffff;
    for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? crc >>> 1 ^ 0xedb88320 : crc >>> 1; }
    crc = (crc ^ 0xffffffff) >>> 0;
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt32LE(crc, 14); local.writeUInt32LE(bytes.length, 18); local.writeUInt32LE(bytes.length, 22); local.writeUInt16LE(filename.length, 26);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt32LE(crc, 16); central.writeUInt32LE(bytes.length, 20); central.writeUInt32LE(bytes.length, 24); central.writeUInt16LE(filename.length, 28); central.writeUInt32LE(offset, 42);
    chunks.push(local, filename, bytes); directory.push(central, filename); offset += local.length + filename.length + bytes.length;
  }
  const central = Buffer.concat(directory), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(directory.length / 2, 8); end.writeUInt16LE(directory.length / 2, 10); end.writeUInt32LE(central.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, central, end]);
}
function registry(name: string, version: string, bytes: Buffer, extra: Record<string, unknown> = {}) {
  const url = `https://registry.npmjs.org/${name}/-/${name.split('/').at(-1)}-${version}.tgz`;
  return { name, version, ...extra, dist: { tarball: url, integrity: 'sha512-' + createHash('sha512').update(bytes).digest('base64') } };
}
function fetchMap(values: Record<string, string | Buffer | Record<string, unknown>>) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const value = values[String(input)]; if (value === undefined) throw Error(`Unexpected fixture URL: ${String(input)}`);
    return new Response(Buffer.isBuffer(value) ? new Uint8Array(value) : typeof value === 'string' ? value : JSON.stringify(value));
  }) as unknown as typeof fetch;
}
function npmFixture(name: string, version: string, files: Record<string, string | Buffer>, main?: { name: string; nativeName: string; dependency: string }) {
  const bytes = tar(files), metadata = registry(name, version, bytes);
  const values: Record<string, string | Buffer | Record<string, unknown>> = {
    [`https://registry.npmjs.org/${name}/${version}`]: metadata,
    [metadata.dist.tarball]: bytes,
  };
  if (main) values[`https://registry.npmjs.org/${main.name}/latest`] = registry(main.name, version.split('-win32')[0]!, tar({ 'package/package.json': '{}' }), { optionalDependencies: { [main.nativeName]: main.dependency } });
  return { values, bytes, metadata };
}
const options = (fetcher: typeof fetch, output: string): ComponentPreparationOptions => ({ platform: 'win32', arch: 'x64', fetcher, versionOutput: async () => output });
function cursorFixture(files: Record<string, string> = { 'node.exe': 'Node fixture', 'index.js': 'Cursor fixture', 'cursor-agent.cmd': 'never execute this wrapper', 'cursor-agent.ps1': 'never execute this wrapper' }) {
  const version = '2026.10.01-e373342', url = `https://downloads.cursor.com/lab/${version}/windows/x64/agent-cli-package.zip`;
  const fetcher = fetchMap({
    'https://cursor.com/install?win32=true': `$downloadUrl = 'https://downloads.cursor.com/lab/${version}/'\n$version = '${version}'`,
    [url]: zip(Object.fromEntries(Object.entries(files).map(([name, content]) => [`dist-package/${name}`, content]))),
  });
  return { version, fetcher, publisher: vi.fn(async () => {}) };
}

describe('explicit provider Connect component preparation', () => {
  it('prepares Codex with its native helpers and reuses it after restart without network or login', async () => {
    const root = await setup(), version = '0.162.1';
    const fixture = npmFixture('@openai/codex', `${version}-win32-x64`, {
      'package/vendor/x86_64-pc-windows-msvc/bin/codex.exe': 'official fixture binary',
      'package/vendor/x86_64-pc-windows-msvc/bin/codex-windows-sandbox-service.exe': 'fixture helper',
    }, { name: '@openai/codex', nativeName: '@openai/codex-win32-x64', dependency: `npm:@openai/codex@${version}-win32-x64` });
    const environment = host(root), fetcher = fetchMap(fixture.values), progress: string[] = [];
    const component = await prepareProviderComponent('codex', environment, root, new AbortController().signal, message => progress.push(message), options(fetcher, `codex-cli ${version}`));
    expect(component.source).toBe('managed'); expect(component.version).toBe(version);
    expect(environment.env.SYKA_CODEX_PATH).toBe(component.command);
    expect(await readFile(join(dirname(component.command), 'codex-windows-sandbox-service.exe'), 'utf8')).toBe('fixture helper');
    const freshEnvironment = host(root), reused = await resolveManagedComponent('codex', freshEnvironment, root);
    expect(reused).toEqual(component); expect(freshEnvironment.env.SYKA_CODEX_PATH).toBe(component.command);
    expect(progress.some(message => message.includes('Descargando'))).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it('rejects a broken explicit override without downloading or using another installed account', async () => {
    const root = await setup(), environment = host(root), fetcher = vi.fn();
    environment.env.SYKA_CODEX_PATH = join(root, 'missing.exe');
    await writeFile(join(root, 'codex.exe'), 'other installation');
    expect(resolveBinary('codex', environment)).toBeNull();
    await expect(prepareProviderComponent('codex', environment, root, new AbortController().signal, undefined, options(fetcher as unknown as typeof fetch, 'codex-cli 0.162.1'))).rejects.toThrow('No se usó otra instalación');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('checks identity instead of accepting an unrelated claude.exe and prepares the official binary', async () => {
    const root = await setup(), environment = host(root), local = join(root, 'claude.exe'); await writeFile(local, 'Bun fixture');
    const binary = Buffer.from('Claude fixture'), checksum = createHash('sha256').update(binary).digest('hex'), version = '2.1.296';
    const base = 'https://downloads.claude.ai/claude-code-releases', fetcher = fetchMap({
      [`${base}/latest`]: version, [`${base}/${version}/manifest.json`]: { platforms: { 'win32-x64': { checksum } } }, [`${base}/${version}/win32-x64/claude.exe`]: binary,
    });
    const versionOutput = vi.fn(async (command: string) => command === local ? '1.3.14' : `${version} (Claude Code)`);
    const result = await prepareProviderComponent('claude', environment, root, new AbortController().signal, undefined, { ...options(fetcher, ''), versionOutput });
    expect(result.source).toBe('managed'); expect(environment.env.SYKA_CLAUDE_PATH).toBe(result.command);
    expect(await readFile(local, 'utf8')).toBe('Bun fixture');
    expect(versionOutput).toHaveBeenCalledTimes(2);
  });
  it('reports the wrong identity at an explicit Claude route instead of silently preparing another account', async () => {
    const root = await setup(), environment = host(root), fetcher = vi.fn(), binary = join(root, 'claude.exe');
    await writeFile(binary, 'Bun fixture'); environment.env.SYKA_CLAUDE_PATH = binary;
    await expect(prepareProviderComponent('claude', environment, root, new AbortController().signal, undefined, options(fetcher as unknown as typeof fetch, '1.3.14'))).rejects.toThrow('No se cambió por otra instalación');
    expect(fetcher).not.toHaveBeenCalled(); expect(await readdir(root)).toEqual(['claude.exe']);
  });
  it('prepares Antigravity through its official hash manifest without running an installer script', async () => {
    const root = await setup(), bytes = Buffer.from('agy fixture'), url = 'https://storage.googleapis.com/antigravity-public/antigravity-cli/1.3.3/build/windows-x64/cli.exe';
    const fetcher = fetchMap({ 'https://antigravity-cli-auto-updater-974169037036.us-central1.run.app/manifests/windows_amd64.json': { version: '1.3.3', url, sha512: createHash('sha512').update(bytes).digest('hex') }, [url]: bytes });
    const result = await prepareProviderComponent('antigravity', host(root), root, new AbortController().signal, undefined, options(fetcher, '1.3.3'));
    expect(result.command).toBe(join(root, 'providers', 'antigravity', 'agy.exe')); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it.each(['grok', 'opencode'] as const)('prepares %s native package without hooks or a global npm install', async provider => {
    const root = await setup(), version = provider === 'grok' ? '1.0.50' : '1.19.0';
    const name = provider === 'grok' ? '@xai-official/grok-win32-x64' : 'opencode-windows-x64-baseline';
    const mainName = provider === 'grok' ? '@xai-official/grok' : 'opencode-ai';
    const fixture = npmFixture(name, version, { [`package/bin/${provider}.exe`]: 'native fixture' }, { name: mainName, nativeName: name, dependency: version });
    const result = await prepareProviderComponent(provider, host(root), root, new AbortController().signal, undefined, options(fetchMap(fixture.values), version));
    expect(result.source).toBe('managed'); expect(result.version).toBe(version);
  });
  it('prepares the official Brotli Grok binary and validates it before activation', async () => {
    const root = await setup(), name = '@xai-official/grok-win32-x64', version = '1.0.50';
    const bytes = Buffer.from('native Grok fixture'), fixture = npmFixture(name, version, { 'package/bin/grok.exe.br': brotliCompressSync(bytes) }, { name: '@xai-official/grok', nativeName: name, dependency: version });
    const versionOutput = vi.fn(async (command: string) => { expect(await readFile(command)).toEqual(bytes); return version; });
    const result = await prepareProviderComponent('grok', host(root), root, new AbortController().signal, undefined, { ...options(fetchMap(fixture.values), version), versionOutput });
    expect(result.command).toBe(join(root, 'providers', 'grok', 'bin', 'grok.exe'));
    const restored = await resolveManagedComponent('grok', host(root), root);
    expect(restored).toEqual(result); expect(versionOutput).toHaveBeenCalledOnce();
  });
  it('rejects a damaged compressed Grok package without executing it', async () => {
    const root = await setup(), name = '@xai-official/grok-win32-x64', version = '1.0.50';
    const fixture = npmFixture(name, version, { 'package/bin/grok.exe.br': Buffer.from('damaged') }, { name: '@xai-official/grok', nativeName: name, dependency: version });
    const versionOutput = vi.fn();
    await expect(prepareProviderComponent('grok', host(root), root, new AbortController().signal, undefined, { ...options(fetchMap(fixture.values), version), versionOutput })).rejects.toThrow();
    expect(versionOutput).not.toHaveBeenCalled(); expect(await readdir(join(root, 'providers'))).toEqual([]);
  });
  it('prepares Cursor from its official Windows release without executing the global installer script', async () => {
    const root = await setup(), version = '2026.10.01-e373342', url = `https://downloads.cursor.com/lab/${version}/windows/x64/agent-cli-package.zip`;
    const fetcher = fetchMap({ 'https://cursor.com/install?win32=true': `$downloadUrl = 'https://downloads.cursor.com/lab/${version}/'\n$version = '${version}'\nRemove-Item -Recurse -Force $UserInstallation`, [url]: zip({ 'dist-package/cursor-agent.exe': 'Cursor fixture', 'dist-package/index.js': 'adjacent runtime' }) });
    const publisher = vi.fn(async () => {}), result = await prepareProviderComponent('cursor', host(root), root, new AbortController().signal, undefined, { ...options(fetcher, version), publisher });
    expect(publisher).toHaveBeenCalledTimes(1); expect(result.command).toBe(join(root, 'providers', 'cursor', 'cursor-agent.exe'));
    expect(await readFile(join(root, 'providers', 'cursor', 'versions', version, 'index.js'), 'utf8')).toBe('adjacent runtime');
    const receipt = JSON.parse(await readFile(join(root, 'providers', 'cursor', 'syka-component.json'), 'utf8'));
    expect(receipt.integrity).toBe('https-local-receipt'); expect(receipt.artifactSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('prepares the current Cursor Node package and recovers its relative entrypoint after restart', async () => {
    const root = await setup(), fixture = cursorFixture(), environment = host(root);
    const versionOutput = vi.fn(async (command: string, args: string[]) => {
      expect(command).toBe(join(dirname(args[0]!), 'node.exe'));
      expect(args).toEqual([join(dirname(command), 'index.js'), '--version']);
      expect(command).toContain('.prepare-cursor-');
      return fixture.version;
    });
    const component = await prepareProviderComponent('cursor', environment, root, new AbortController().signal, undefined, { ...options(fixture.fetcher, ''), publisher: fixture.publisher, versionOutput });
    const directory = join(root, 'providers', 'cursor', 'versions', fixture.version);
    expect(component).toEqual({ command: join(directory, 'node.exe'), args: [join(directory, 'index.js')], version: '2026.10.01', source: 'managed' });
    expect(environment.env.SYKA_CURSOR_PATH).toBe(component.args![0]);
    const receipt = JSON.parse(await readFile(join(root, 'providers', 'cursor', 'syka-component.json'), 'utf8'));
    expect(receipt.command).toBe(`versions/${fixture.version}/node.exe`);
    expect(receipt.args).toEqual([`versions/${fixture.version}/index.js`]);
    expect([receipt.command, ...receipt.args].every(path => !isAbsolute(path))).toBe(true);
    expect(receipt.files[receipt.args[0]]).toMatch(/^[a-f0-9]{64}$/);
    const restarted = host(root), reused = await resolveManagedComponent('cursor', restarted, root);
    expect(reused).toEqual(component); expect(restarted.env.SYKA_CURSOR_PATH).toBe(component.args![0]);
    await expect(prepareProviderComponent('cursor', restarted, root, new AbortController().signal, undefined, { ...options(vi.fn() as unknown as typeof fetch, ''), versionOutput })).resolves.toEqual(component);
    expect(versionOutput).toHaveBeenCalledTimes(1); expect(fixture.publisher).toHaveBeenCalledWith(expect.stringContaining('node.exe'), expect.any(AbortSignal));
    expect(fixture.fetcher).toHaveBeenCalledTimes(2);
  });
  it.each(['absolute', 'outside', 'unhashed', 'changed'] as const)('rejects a %s managed Cursor entrypoint before executing it', async corruption => {
    const root = await setup(), fixture = cursorFixture(), environment = host(root), signal = new AbortController().signal;
    const component = await prepareProviderComponent('cursor', environment, root, signal, undefined, { ...options(fixture.fetcher, fixture.version), publisher: fixture.publisher });
    const receiptPath = join(root, 'providers', 'cursor', 'syka-component.json'), receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
    if (corruption === 'absolute') receipt.args = [component.args![0]];
    if (corruption === 'outside') receipt.args = ['../another-provider/index.js'];
    if (corruption === 'unhashed') { const other = 'versions/' + fixture.version + '/other.js'; await writeFile(join(root, 'providers', 'cursor', other), 'unverified fixture'); receipt.args = [other]; }
    if (corruption === 'changed') await writeFile(component.args![0]!, 'tampered fixture');
    await writeFile(receiptPath, JSON.stringify(receipt));
    await expect(resolveManagedComponent('cursor', host(root), root)).rejects.toThrow(/revisión|incompleto|fuera|inválida/);
    const versionOutput = vi.fn(async (command: string, args: string[]) => { expect(command).not.toBe(component.command); expect(args[0]).not.toBe(component.args![0]); return fixture.version; });
    await prepareProviderComponent('cursor', environment, root, signal, undefined, { ...options(fixture.fetcher, ''), publisher: fixture.publisher, versionOutput });
    expect(versionOutput).toHaveBeenCalledTimes(1); expect(await readFile(component.args![0]!, 'utf8')).toBe('Cursor fixture');
  });
  it.each(['v22.20.0', '2026.09.30-e373342'])('rejects unrelated or mismatched Cursor runtime version %s', async output => {
    const root = await setup(), fixture = cursorFixture();
    await expect(prepareProviderComponent('cursor', host(root), root, new AbortController().signal, undefined, { ...options(fixture.fetcher, output), publisher: fixture.publisher })).rejects.toThrow(/como Cursor|versión del paquete/);
    expect(await readdir(join(root, 'providers'))).toEqual([]);
  });
  it('reuses an explicitly selected official Cursor entrypoint with its adjacent Node and no download', async () => {
    const root = await setup(), fixture = cursorFixture(), directory = join(root, 'installed', 'versions', fixture.version), entry = join(directory, 'index.js'), command = join(directory, 'node.exe');
    await mkdir(directory, { recursive: true }); await writeFile(entry, 'Cursor fixture'); await writeFile(command, 'Node fixture');
    const environment = host(root), fetcher = vi.fn(), versionOutput = vi.fn(async () => fixture.version); environment.env.SYKA_CURSOR_PATH = entry;
    const component = await prepareProviderComponent('cursor', environment, join(root, 'runtime'), new AbortController().signal, undefined, { ...options(fetcher as unknown as typeof fetch, ''), versionOutput });
    expect(component).toEqual({ command, args: [entry], version: '2026.10.01', source: 'installed' });
    expect(versionOutput).toHaveBeenCalledWith(command, [entry, '--version'], expect.anything(), expect.any(AbortSignal)); expect(fetcher).not.toHaveBeenCalled();
    expect(await cursorRuntimeLaunch(entry)).toEqual({ command, args: [entry] });
    const unrelated = join(root, 'index.js'); await writeFile(unrelated, 'custom route'); expect(await cursorRuntimeLaunch(unrelated)).toBeUndefined();
  });
  it('passes an entrypoint path with spaces intact to a real Node version subprocess', async () => {
    const root = await setup(), version = '2026.10.01-e373342', directory = join(root, 'Cursor folder with spaces', 'versions', version), entry = join(directory, 'index.js'), command = join(directory, process.platform === 'win32' ? 'node.exe' : 'node');
    await mkdir(directory, { recursive: true }); await copyFile(process.execPath, command); if (process.platform !== 'win32') await chmod(command, 0o755);
    // A local version-only fixture, never a provider or account operation.
    await writeFile(entry, `if (process.argv[2] !== '--version') process.exit(2); process.stdout.write('${version}\\n');`);
    const environment = host(root), fetcher = vi.fn(); environment.env.SYKA_CURSOR_PATH = entry;
    const component = await prepareProviderComponent('cursor', environment, join(root, 'runtime'), new AbortController().signal, undefined, { fetcher: fetcher as unknown as typeof fetch });
    expect(component).toEqual({ command, args: [entry], version: '2026.10.01', source: 'installed' }); expect(fetcher).not.toHaveBeenCalled();
  });
  it('detects the versioned Codex desktop CLI even without its bin subdirectory in PATH', async () => {
    if (process.platform !== 'win32') return;
    const root = await setup(), bin = join(root, 'OpenAI', 'Codex', 'bin'), command = join(bin, '2e5e00daee91c61d', 'codex.exe');
    await mkdir(dirname(command), { recursive: true }); await writeFile(command, 'fixture only');
    expect(resolveBinary('codex', { env: { PATH: root }, extraDirs: [bin] })).toBe(command);
  });
  it('repairs a damaged managed binary without executing the damaged file', async () => {
    const root = await setup(), bytes = Buffer.from('agy fixture'), url = 'https://storage.googleapis.com/antigravity-public/antigravity-cli/1.3.3/build/windows-x64/cli.exe';
    const fetcher = fetchMap({ 'https://antigravity-cli-auto-updater-974169037036.us-central1.run.app/manifests/windows_amd64.json': { version: '1.3.3', url, sha512: createHash('sha512').update(bytes).digest('hex') }, [url]: bytes });
    const environment = host(root), signal = new AbortController().signal;
    const initial = await prepareProviderComponent('antigravity', environment, root, signal, undefined, options(fetcher, '1.3.3'));
    await writeFile(initial.command, 'tampered fixture');
    await expect(resolveManagedComponent('antigravity', host(root), root)).rejects.toThrow('incompleto o cambió');
    const versionOutput = vi.fn(async (command: string) => { expect(command).not.toBe(initial.command); return '1.3.3'; });
    await prepareProviderComponent('antigravity', environment, root, signal, undefined, { ...options(fetcher, ''), versionOutput });
    expect(await readFile(initial.command, 'utf8')).toBe('agy fixture'); expect(versionOutput).toHaveBeenCalledTimes(1);
    expect((await readdir(join(root, 'providers'))).filter(name => name.startsWith('.'))).toEqual([]);
  });
  it('never promotes a failed download and leaves an existing component intact', async () => {
    const root = await setup(), destination = join(root, 'providers', 'claude'); await mkdir(destination, { recursive: true }); await writeFile(join(destination, 'previous.txt'), 'retain');
    const base = 'https://downloads.claude.ai/claude-code-releases', version = '2.1.296';
    const fetcher = fetchMap({ [`${base}/latest`]: version, [`${base}/${version}/manifest.json`]: { platforms: { 'win32-x64': { checksum: '0'.repeat(64) } } }, [`${base}/${version}/win32-x64/claude.exe`]: Buffer.from('corrupt') });
    await expect(prepareProviderComponent('claude', host(root), root, new AbortController().signal, undefined, options(fetcher, `${version} (Claude Code)`))).rejects.toThrow('integridad');
    expect(await readFile(join(destination, 'previous.txt'), 'utf8')).toBe('retain');
    expect(await readdir(join(root, 'providers'))).toEqual(['claude']);
  });
  it('cancels a preparation without touching an existing provider installation', async () => {
    const root = await setup(), controller = new AbortController(); controller.abort(); const fetcher = vi.fn();
    await expect(prepareProviderComponent('codex', host(root), root, controller.signal, undefined, options(fetcher as unknown as typeof fetch, ''))).rejects.toThrow(); expect(fetcher).not.toHaveBeenCalled();
    expect(await readdir(root)).toEqual([]);
  });
  it('cancels a download in progress and removes only its incomplete stage', async () => {
    const root = await setup(), controller = new AbortController(), bytes = Buffer.from('agy fixture'), url = 'https://storage.googleapis.com/antigravity-public/antigravity-cli/1.3.3/build/windows-x64/cli.exe';
    const normalFetch = fetchMap({ 'https://antigravity-cli-auto-updater-974169037036.us-central1.run.app/manifests/windows_amd64.json': { version: '1.3.3', url, sha512: createHash('sha512').update(bytes).digest('hex') } });
    const fetcher = (async input => String(input) === url ? new Response(new Uint8Array(bytes), { headers: { 'content-length': String(bytes.length) } }) : normalFetch(input)) as typeof fetch;
    await expect(prepareProviderComponent('antigravity', host(root), root, controller.signal, message => { if (/Descargando Antigravity:/.test(message)) controller.abort(); }, options(fetcher, '1.3.3'))).rejects.toThrow();
    expect(await readdir(join(root, 'providers'))).toEqual([]);
  });
  it('prepares a pinned terminal prebuild without hooks and reuses it for another provider', async () => {
    const root = await setup(), fixture = npmFixture('node-pty', '1.1.0', {
      'package/package.json': JSON.stringify({ name: 'node-pty', version: '1.1.0' }), 'package/lib/index.js': 'fixture only',
      'package/prebuilds/win32-x64/conpty.node': 'fixture only', 'package/prebuilds/win32-x64/conpty_console_list.node': 'fixture only',
      'package/prebuilds/win32-x64/conpty/conpty.dll': 'fixture only', 'package/prebuilds/win32-x64/conpty/OpenConsole.exe': 'fixture only',
    });
    const fetcher = fetchMap(fixture.values), environment = host(root), signal = new AbortController().signal;
    const directory = await prepareLoginTerminal(environment, root, signal, undefined, options(fetcher, ''));
    expect(environment.env.SYKA_AUTH_TERMINAL_MODULE).toBe(directory);
    expect(await prepareLoginTerminal(environment, root, signal, undefined, options(fetcher, ''))).toBe(directory);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe('official artifact download and extraction boundaries', () => {
  it('rejects nonofficial redirects before fetching the destination', async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 302, headers: { location: 'https://evil.example/steal' } })) as unknown as typeof fetch;
    await expect(officialFetch('https://registry.npmjs.org/node-pty/1.1.0', new AbortController().signal, fetcher)).rejects.toThrow('oficial permitido'); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('rejects unsafe archive paths and links before extracting outside its own stage', async () => {
    const root = await setup(), stage = join(root, 'stage'); await mkdir(stage);
    for (const [name, type] of [['package/../../escape.txt', '0'], ['package/link', '2']]) {
      const archive = join(root, type + '.tgz'); await writeFile(archive, tar({ [name!]: 'unsafe' }, type));
      await expect(unpackTarGzip(archive, stage, new AbortController().signal)).rejects.toThrow(/insegura|enlaces/);
    }
    expect(await readdir(stage)).toEqual([]);
  });
  it('checks content length rather than accepting a truncated official response', async () => {
    const root = await setup(), fetcher = vi.fn(async () => new Response('abc', { headers: { 'content-length': '10' } })) as unknown as typeof fetch;
    await expect(downloadArtifact({ url: 'https://downloads.claude.ai/fixture.exe', format: 'binary' }, join(root, 'download'), new AbortController().signal, fetcher)).rejects.toThrow('incompleta');
  });
});
