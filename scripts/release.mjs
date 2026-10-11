/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

// Version preparation, local tagging and remote push are separate commands.
// No automatic commit, stash, publication or application installation.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyVersions } from './build-windows.mjs';
import { npm } from './lib/npm.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const RELEASE_REPOSITORY = 'SikJa/syka-studio';
const PACKAGES = ['package.json', 'apps/desktop/package.json', 'apps/cli/package.json', 'apps/web/package.json'];
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const USAGE = `npm run release -- prepare <patch|minor|major|x.y.z> [--dry-run]
npm run release -- check [--tag=vX.Y.Z] [--remote=syka]
npm run release -- tag [--remote=syka] [--dry-run]
npm run release -- push [--remote=syka] [--dry-run]

prepare changes version files only. Review and commit them yourself.
tag creates a local annotated tag on a clean checkout.
push explicitly pushes that tag to ${RELEASE_REPOSITORY}; it triggers a Windows beta build and a draft.
The default release remote is syka. Diffusion and every other repository are blocked.`;

export function parseReleaseArgs(args) {
  const result = { command: '', bump: undefined, remote: 'syka', explicitRemote: false, tag: undefined, dryRun: false, help: false };
  const positional = [];
  for (const arg of args) {
    if (arg === '--help' || arg === '-h') result.help = true;
    else if (arg === '--dry-run') result.dryRun = true;
    else if (arg.startsWith('--remote=')) {
      if (result.explicitRemote) throw Error('Specify --remote once.');
      result.remote = arg.slice('--remote='.length); result.explicitRemote = true;
    } else if (arg.startsWith('--tag=')) {
      if (result.tag) throw Error('Specify --tag once.');
      result.tag = arg.slice('--tag='.length);
      if (!/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(result.tag)) throw Error('Use a tag in the form vX.Y.Z.');
    } else if (arg.startsWith('-')) throw Error(`Unknown option: ${arg}. Use --help.`);
    else positional.push(arg);
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(result.remote)) throw Error('Use a configured remote name, not a URL.');
  if (!positional.length) { result.help = true; return result; }
  if (['patch', 'minor', 'major'].includes(positional[0]) || VERSION.test(positional[0])) positional.unshift('prepare');
  result.command = positional.shift();
  if (!['prepare', 'check', 'tag', 'push'].includes(result.command)) throw Error('Unknown release command. Use --help.');
  if (result.command === 'prepare') {
    if (positional.length !== 1) throw Error('prepare requires a version or bump.');
    result.bump = positional[0];
  } else if (positional.length) throw Error('Unexpected positional arguments. Use --help.');
  if (result.tag && result.command !== 'check') throw Error('--tag is only accepted by check; tag and push use the current package version.');
  return result;
}

export function nextVersion(current, bump) {
  if (!VERSION.test(current)) throw Error('The current version must use x.y.z.');
  if (VERSION.test(bump)) return bump;
  const [major, minor, patch] = current.split('.').map(BigInt);
  if (bump === 'major') return `${major + 1n}.0.0`;
  if (bump === 'minor') return `${major}.${minor + 1n}.0`;
  if (bump === 'patch') return `${major}.${minor}.${patch + 1n}`;
  throw Error('Use patch, minor, major or x.y.z; prereleases are marked on the GitHub draft.');
}

/** Verify every expanded push URL, including remotes with several push URLs. */
export function assertAllowedRemote(urls) {
  if (!urls.length) throw Error('The release remote has no push URL.');
  for (const value of urls) {
    let path;
    const scp = /^git@github\.com:([^\s]+)$/i.exec(value);
    if (scp) path = scp[1];
    else {
      let url;
      try { url = new URL(value); } catch { throw Error('The release remote must be GitHub SikJa/syka-studio.'); }
      if (url.hostname.toLowerCase() !== 'github.com' || !['https:', 'ssh:'].includes(url.protocol)
        || url.password || url.search || url.hash || (url.username && !(url.protocol === 'ssh:' && url.username === 'git'))
        || (url.port && !(url.protocol === 'ssh:' && url.port === '22'))) {
        throw Error('The release remote must use a credential-free GitHub HTTPS or SSH URL.');
      }
      path = url.pathname.replace(/^\//, '');
    }
    path = path.replace(/\/$/, '').replace(/\.git$/i, '');
    if (path.toLowerCase() !== RELEASE_REPOSITORY.toLowerCase()) {
      throw Error(`Release push blocked: only ${RELEASE_REPOSITORY} is allowed. Never push Syka releases to diffusionstudio/editor.`);
    }
  }
}

function git(root, ...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
}
function requireClean(root) {
  if (git(root, 'status', '--porcelain')) throw Error('The working tree is not clean. Review and commit changes first; no automatic commit or stash was performed.');
}
function verifyRemote(root, name) {
  let urls;
  try { urls = git(root, 'remote', 'get-url', '--push', '--all', name).split(/\r?\n/).filter(Boolean); }
  catch { throw Error(`Release remote ${name} is not configured. Add a remote for ${RELEASE_REPOSITORY}.`); }
  assertAllowedRemote(urls);
  let mirror = false;
  try { mirror = git(root, 'config', '--bool', '--get', `remote.${name}.mirror`) === 'true'; } catch { /* No mirror setting. */ }
  if (mirror) throw Error('Release push is blocked for mirror remotes. Use a normal Syka remote.');
  console.log(`Remote ${name} verified: ${RELEASE_REPOSITORY}`);
}
function tagCommit(root, tag) {
  if (!git(root, 'tag', '--list', tag)) throw Error(`Local tag ${tag} does not exist. Create it with the tag command first.`);
  return git(root, 'rev-parse', `${tag}^{commit}`);
}

function prepareVersion(root, current, options) {
  const next = nextVersion(current, options.bump);
  requireClean(root);
  if (next === current) { console.log(`Version ${current} is already prepared. Use tag after reviewing the release commit.`); return; }
  if (options.dryRun) { console.log(`[dry run] Prepare ${current} → ${next} in package files and package-lock.json. No tag or push.`); return; }
  const files = [...PACKAGES, 'package-lock.json'];
  const originals = new Map(files.map(path => [path, readFileSync(join(root, path))]));
  try {
    for (const path of PACKAGES) {
      const pkg = JSON.parse(originals.get(path).toString('utf8'));
      pkg.version = next;
      writeFileSync(join(root, path), JSON.stringify(pkg, null, 2) + '\n');
    }
    const temporary = join(root, '.runtime/release/tmp');
    mkdirSync(temporary, { recursive: true });
    npm(['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'], {
      cwd: root, windowsHide: true,
      env: { ...process.env, npm_config_cache: join(root, '.runtime/release/npm-cache'), TEMP: temporary, TMP: temporary, TMPDIR: temporary },
    });
    verifyVersions(root);
  } catch (error) {
    for (const [path, contents] of originals) writeFileSync(join(root, path), contents);
    throw Error(`Version preparation failed; original version files were restored. ${error.message}`);
  }
  console.log(`Prepared ${current} → ${next}. Review git diff, then commit the reviewed files.\nNo commit, tag or push was performed.\nNext: npm run release -- tag --remote=${options.remote}`);
}

export function release(args = process.argv.slice(2), root = ROOT) {
  const options = parseReleaseArgs(args);
  if (options.help) { console.log(USAGE); return; }
  const version = verifyVersions(root), tag = `v${version}`;
  if (options.tag && options.tag !== tag) throw Error(`Tag ${options.tag} does not match package version ${version}.`);
  if (options.explicitRemote || ['tag', 'push'].includes(options.command)) verifyRemote(root, options.remote);
  if (options.command === 'check') { console.log(`Release versions match ${tag}; updater target ${RELEASE_REPOSITORY}.`); return; }
  if (options.command === 'prepare') { prepareVersion(root, version, options); return; }
  requireClean(root);
  const head = git(root, 'rev-parse', 'HEAD');
  if (options.command === 'tag') {
    if (git(root, 'tag', '--list', tag)) {
      if (tagCommit(root, tag) !== head) throw Error(`Tag ${tag} already points to another commit; it will not be moved.`);
      console.log(`Local tag ${tag} already matches HEAD. No tag was changed.`); return;
    }
    if (options.dryRun) console.log(`[dry run] git tag -a ${tag} -m "Syka Studio ${version}" HEAD`);
    else { git(root, 'tag', '-a', tag, '-m', `Syka Studio ${version}`, 'HEAD'); console.log(`Created local tag ${tag}. No remote was contacted.`); }
    console.log(`Push is a separate action: npm run release -- push --remote=${options.remote}`); return;
  }
  if (tagCommit(root, tag) !== head) throw Error(`Tag ${tag} does not match HEAD; push was blocked.`);
  const ref = `refs/tags/${tag}:refs/tags/${tag}`;
  if (options.dryRun) { console.log(`[dry run] git -c push.followTags=false push --atomic ${options.remote} ${ref}\nNo remote was contacted.`); return; }
  execFileSync('git', ['-c', 'push.followTags=false', 'push', '--atomic', options.remote, ref], { cwd: root, stdio: 'inherit', windowsHide: true });
  console.log(`Pushed ${tag} to ${RELEASE_REPOSITORY}. Review the Windows beta draft after the workflow finishes; no stable release was published.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { release(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
