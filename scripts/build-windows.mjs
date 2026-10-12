/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

// Build and verify a Windows installer. Never install, publish, tag or push.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  closeSync, copyFileSync, createReadStream, existsSync, lstatSync, mkdirSync,
  openSync, readFileSync, readSync, readdirSync, realpathSync, statfsSync,
  statSync, writeFileSync,
} from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkDistributionLayout } from './lib/distribution-layout.mjs';
import { npm } from './lib/npm.mjs';
import { verifyWindowsSignatures } from './lib/windows-signatures.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GIB = 1024n ** 3n;
export const MIN_BUILD_FREE_BYTES = 10n * GIB;
export const MIN_FINAL_FREE_BYTES = 2n * GIB;
export const SETUP_ASSET = 'Syka-Studio-x64-Setup.exe';
const REPOSITORY = 'SikJa/syka-studio';
const PACKAGES = ['package.json', 'apps/desktop/package.json', 'apps/cli/package.json', 'apps/web/package.json'];
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));

export function releaseAssetName(source, version) {
  const name = basename(source);
  if (!name.endsWith('.zip')) return name;
  if (!VERSION.test(version)) throw Error('Invalid release version.');
  return `Syka-Studio-win32-x64-${version}.zip`;
}

export function parseBuildArgs(args) {
  const supported = ['--unsigned', '--preflight-only', '--verify-only', '--help'];
  for (const arg of args) if (!supported.includes(arg)) throw Error(`Unknown option: ${arg}. Use --help.`);
  if (args.includes('--preflight-only') && args.includes('--verify-only')) throw Error('Choose one verification mode.');
  return { unsigned: args.includes('--unsigned'), preflightOnly: args.includes('--preflight-only'),
    verifyOnly: args.includes('--verify-only'), help: args.includes('--help') };
}

export function verifyVersions(root = ROOT) {
  const version = readJson(join(root, 'package.json')).version;
  if (!VERSION.test(version)) throw Error('Windows releases require an x.y.z version without leading zeroes.');
  const lock = readJson(join(root, 'package-lock.json'));
  if (lock.version !== version || lock.packages?.['']?.version !== version) throw Error('The root lockfile version does not match package.json.');
  for (const path of PACKAGES) {
    if (readJson(join(root, path)).version !== version) throw Error(`Version mismatch: ${path}`);
    const key = path === 'package.json' ? '' : dirname(path).replaceAll('\\', '/');
    if (lock.packages?.[key]?.version !== version) throw Error(`Version mismatch in package-lock.json: ${key || 'root'}`);
  }
  if (readJson(join(root, 'apps/desktop/release.config.json')).repository !== REPOSITORY) {
    throw Error(`The updater must target ${REPOSITORY}; upstream Diffusion is not a Syka release target.`);
  }
  return version;
}

export function requireDiskReserve(freeBytes, minimum = MIN_BUILD_FREE_BYTES) {
  if (freeBytes < minimum) throw Error(`Not enough disk space: ${(Number(freeBytes) / Number(GIB)).toFixed(1)} GiB free; ${Number(minimum / GIB)} GiB required. No files were deleted.`);
}

function freeDiskBytes(path) {
  const disk = statfsSync(path, { bigint: true });
  return disk.bavail * disk.bsize;
}

function inside(root, path) {
  const value = relative(realpathSync(root), realpathSync(path));
  return value !== '..' && !value.startsWith('..' + sep) && !isAbsolute(value);
}

function directory(path, root) {
  let ancestor = resolve(path);
  while (!existsSync(ancestor)) {
    const parent = dirname(ancestor);
    if (parent === ancestor) throw Error('No existing parent for build output.');
    ancestor = parent;
  }
  if (!inside(root, ancestor)) throw Error('Build output or cache was redirected outside the workspace.');
  mkdirSync(path, { recursive: true });
  if (!inside(root, path)) throw Error('Build output or cache was redirected outside the workspace.');
  return path;
}

function file(directory, name) {
  if (basename(name) !== name || /[\r\n]/.test(name)) throw Error(`Invalid artifact name: ${name}`);
  const path = join(directory, name);
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.size === 0 || !inside(directory, path)) throw Error(`Missing, empty or redirected artifact: ${name}`);
  return path;
}

async function hashFile(path, algorithm = 'sha256') {
  const hash = createHash(algorithm);
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

function signature(path, magic) {
  const fd = openSync(path, 'r');
  try {
    const buffer = Buffer.alloc(magic.length);
    if (readSync(fd, buffer, 0, buffer.length, 0) !== buffer.length || buffer.toString('ascii') !== magic) {
      throw Error(`Invalid binary artifact: ${basename(path)}`);
    }
  } finally { closeSync(fd); }
}

function x64Executable(path) {
  const fd = openSync(path, 'r');
  try {
    const dos = Buffer.alloc(64), pe = Buffer.alloc(6);
    if (readSync(fd, dos, 0, 64, 0) !== 64 || dos.toString('ascii', 0, 2) !== 'MZ') throw Error('Invalid packaged Windows executable.');
    const offset = dos.readUInt32LE(60);
    if (offset < 64 || readSync(fd, pe, 0, 6, offset) !== 6 || pe.readUInt32LE(0) !== 0x4550 || pe.readUInt16LE(4) !== 0x8664) {
      throw Error('The packaged application is not Windows x64.');
    }
  } finally { closeSync(fd); }
}

export async function verifySquirrelAssets(directory, version) {
  if (!VERSION.test(version)) throw Error('Invalid release version.');
  signature(file(directory, SETUP_ASSET), 'MZ');
  const releases = readFileSync(file(directory, 'RELEASES'), 'utf8').trim().split(/\r?\n/);
  const packages = [];
  for (const line of releases) {
    const match = /^([a-fA-F0-9]{40})\s+([A-Za-z0-9_.-]+\.nupkg)\s+(\d+)$/.exec(line);
    if (!match) throw Error('Invalid Squirrel RELEASES entry.');
    const [, sha1, name, bytes] = match;
    if (!name.endsWith(`-${version}-full.nupkg`) && !name.endsWith(`-${version}-delta.nupkg`)) {
      throw Error(`Squirrel package does not match version ${version}: ${name}`);
    }
    if (packages.includes(name)) throw Error(`Duplicate Squirrel package: ${name}`);
    const path = file(directory, name);
    signature(path, 'PK');
    if (statSync(path).size !== Number(bytes) || await hashFile(path, 'sha1') !== sha1.toLowerCase()) {
      throw Error(`Squirrel package size or SHA1 does not match RELEASES: ${name}`);
    }
    packages.push(name);
  }
  if (!packages.some(name => name.endsWith(`-${version}-full.nupkg`))) throw Error('The current full Squirrel package is missing.');
  return [SETUP_ASSET, 'RELEASES', ...packages];
}

/** Verify a flat release download without running or installing its binaries. */
export async function verifyAssetBundle(directory, version) {
  const sums = readFileSync(file(directory, 'SHA256SUMS'), 'utf8').trim().split(/\r?\n/);
  const names = [];
  for (const line of sums) {
    const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
    if (!match || !/^(RELEASES|Syka-Studio-x64-Setup\.exe|[^/\\\r\n]+\.(nupkg|zip))$/.test(match[2])) {
      throw Error('Invalid SHA256SUMS entry.');
    }
    const [, expected, name] = match;
    if (names.includes(name)) throw Error(`Duplicate checksum entry: ${name}`);
    if (await hashFile(file(directory, name)) !== expected) throw Error(`SHA256 mismatch: ${name}`);
    names.push(name);
  }
  const squirrel = await verifySquirrelAssets(directory, version);
  for (const name of squirrel) {
    if (!names.includes(name)) throw Error(`Artifact is not covered by SHA256SUMS: ${name}`);
  }
  for (const name of names.filter(name => name.endsWith('.nupkg'))) {
    if (!squirrel.includes(name)) throw Error(`Package is not part of RELEASES: ${name}`);
  }
  for (const name of names.filter(name => name.endsWith('.zip'))) {
    const expected = releaseAssetName(name, version);
    if (name !== expected) throw Error(`Public ZIP asset must be named ${expected}: ${name}`);
    signature(file(directory, name), 'PK');
  }
  return [...names, 'SHA256SUMS'];
}

function buildEnvironment(options, root) {
  const base = directory(join(root, '.runtime/windows-build'), root);
  const env = { ...process.env };
  delete env.SKIP_SIGN;
  if (options.unsigned) env.SKIP_SIGN = '1';
  else {
    if (!env.WINDOWS_SIGN_PUBLISHER?.trim()) throw Error('Signing requires WINDOWS_SIGN_PUBLISHER: the verified certificate Subject.');
    const storeCertificate = env.WINDOWS_SIGN_CERT_SHA1;
    if (storeCertificate && !/^[a-fA-F0-9]{40}$/.test(storeCertificate)) throw Error('WINDOWS_SIGN_CERT_SHA1 must be a 40-digit certificate thumbprint.');
    if (storeCertificate && (env.WINDOWS_SIGN_DLIB || env.WINDOWS_SIGN_METADATA)) throw Error('Choose certificate-store or Artifact Signing; do not combine signing identities.');
    const required = storeCertificate ? ['WINDOWS_SIGNTOOL_PATH'] : ['WINDOWS_SIGNTOOL_PATH', 'WINDOWS_SIGN_DLIB', 'WINDOWS_SIGN_METADATA'];
    for (const name of required) {
      if (!env[name] || !statSync(env[name], { throwIfNoEntry: false })?.isFile()) {
        throw Error(`Signing requires ${name}. Use --unsigned explicitly for a local unsigned build.`);
      }
    }
  }
  const temp = directory(join(base, 'tmp'), root);
  Object.assign(env, {
    TEMP: temp, TMP: temp, TMPDIR: temp,
    npm_config_cache: directory(join(base, 'npm-cache'), root),
    ELECTRON_CACHE: directory(join(base, 'electron-cache'), root),
    ELECTRON_BUILDER_CACHE: directory(join(base, 'electron-builder-cache'), root),
    CARGO_HOME: directory(join(base, 'cargo'), root),
    CARGO_TARGET_DIR: directory(join(root, '.runtime/screen-recorder-target'), root),
  });
  return env;
}

function requireFresh(path, startedAt) {
  if (startedAt && statSync(path).mtimeMs < startedAt - 2000) throw Error(`The build did not refresh ${basename(path)}; an older output will not be released.`);
}

async function verifyPackagedBuild(root, version, startedAt, stageAssets) {
  const desktop = join(root, 'apps/desktop');
  const packaged = join(desktop, 'out/Syka Studio-win32-x64');
  if (!inside(root, packaged)) throw Error('The packaged app was redirected outside the workspace.');
  x64Executable(file(packaged, 'Syka Studio.exe'));
  const appDir = join(packaged, 'resources/app');
  if (readJson(join(appDir, 'package.json')).version !== version) throw Error('The packaged app has the wrong version.');
  if (readJson(join(appDir, 'release.config.json')).repository !== REPOSITORY) throw Error('The packaged updater has the wrong repository.');
  const distribution = checkDistributionLayout({ appDir, resourcesDir: join(packaged, 'resources'), platform: 'win32', arch: 'x64' });
  if (!distribution.ok) throw Error('Packaged distribution is incomplete:\n' + distribution.checks.filter(check => !check.ok).map(check => `- ${check.label}: ${check.error}`).join('\n'));
  const makeDir = join(desktop, 'out/make');
  if (!inside(root, makeDir)) throw Error('Release output was redirected outside the workspace.');
  const squirrel = join(makeDir, 'squirrel.windows/x64');
  const assets = (await verifySquirrelAssets(squirrel, version)).map(name => file(squirrel, name));
  const zipDir = join(makeDir, 'zip/win32/x64');
  if (existsSync(zipDir)) {
    for (const name of readdirSync(zipDir).filter(name => name.endsWith('.zip') && name.includes(version))) {
      const path = file(zipDir, name); signature(path, 'PK'); assets.push(path);
    }
  }
  for (const path of assets) requireFresh(path, startedAt);
  if (!stageAssets) {
    const verified = await verifyAssetBundle(makeDir, version);
    requireDiskReserve(freeDiskBytes(makeDir), MIN_FINAL_FREE_BYTES);
    return { makeDir, assets: verified, distribution };
  }
  const names = [];
  for (const source of assets) {
    const name = releaseAssetName(source, version), target = join(makeDir, name);
    if (names.includes(name)) throw Error(`Duplicate release asset: ${name}`);
    if (existsSync(target) && !lstatSync(target).isFile()) throw Error(`Release output is not a regular file: ${name}`);
    copyFileSync(source, target); names.push(name);
  }
  const sums = [];
  for (const name of names.sort()) sums.push(`${await hashFile(file(makeDir, name))}  ${name}`);
  const checksumPath = join(makeDir, 'SHA256SUMS');
  if (existsSync(checksumPath) && !lstatSync(checksumPath).isFile()) throw Error('SHA256SUMS output is not a regular file.');
  writeFileSync(checksumPath, sums.join('\n') + '\n');
  const verified = await verifyAssetBundle(makeDir, version);
  requireDiskReserve(freeDiskBytes(makeDir), MIN_FINAL_FREE_BYTES);
  return { makeDir, assets: verified, distribution };
}

export async function buildWindows(args = process.argv.slice(2), root = ROOT) {
  const options = parseBuildArgs(args);
  if (options.help) {
    console.log('npm run build:installer -- [--unsigned] [--preflight-only|--verify-only]\nWindows x64, Node 24 and Cargo required. Building never installs or publishes.');
    return;
  }
  if (process.platform !== 'win32' || process.arch !== 'x64') throw Error('Build this installer on Windows x64; cross-compilation is not supported.');
  if (Number(process.versions.node.split('.')[0]) !== 24) throw Error('Use Node.js 24 for the Windows release build.');
  const version = verifyVersions(root);
  let startedAt;
  if (!options.verifyOnly) {
    requireDiskReserve(freeDiskBytes(root));
    const env = buildEnvironment(options, root);
    directory(join(root, 'apps/desktop/out'), root);
    execFileSync('cargo', ['--version'], { cwd: root, env, stdio: 'inherit', windowsHide: true });
    const rust = execFileSync('rustc', ['-vV'], { cwd: root, env, encoding: 'utf8', windowsHide: true });
    if (!/^host: x86_64-pc-windows-msvc\r?$/m.test(rust)) throw Error('Use the x86_64-pc-windows-msvc Rust toolchain for the native Windows build.');
    console.log(`Preflight passed: Windows x64, Node 24, version ${version}, ${options.unsigned ? 'explicit unsigned build' : 'signing configured'}.`);
    if (options.preflightOnly) return;
    startedAt = Date.now();
    npm(['run', 'make', '--workspace=@diffusionstudio/desktop', '--', '--platform=win32', '--arch=x64'], { cwd: root, env, windowsHide: true });
  }
  const result = await verifyPackagedBuild(root, version, startedAt, !options.verifyOnly);
  if (!options.unsigned) {
    const signatures = verifyWindowsSignatures(root, join(root, 'apps/desktop/out/Syka Studio-win32-x64'), join(result.makeDir, SETUP_ASSET), join(result.makeDir, `SykaStudio-${version}-full.nupkg`), process.env.WINDOWS_SIGN_PUBLISHER);
    console.log(`Authenticode: ${signatures.verifiedFiles} trusted, timestamped files verified for ${signatures.publisher}.`);
  }
  console.log(`Verified Windows ${version}: ${result.makeDir}\n${result.assets.map(name => `- ${name}`).join('\n')}\nNo application was installed or published. Test installation and updates on another PC before publishing.`);
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildWindows().catch(error => { console.error(error.message); process.exitCode = 1; });
}
