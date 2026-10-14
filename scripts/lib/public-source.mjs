/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, mkdir, open, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, posix as logicalPath, relative, resolve, sep } from 'node:path';

export const UPSTREAM_BASE_COMMIT = '5310ff0324c186d78d3f8af8186fe57bf84d22be';
export const MAX_SOURCE_FILE_BYTES = 90 * 1024 * 1024;
const MAX_TEXT_BYTES = 16 * 1024 * 1024;
const ROOT_FILES = new Set([
  '.gitignore', 'LICENSE', 'CREDITS.md', 'LICENSE_POLICY.md', 'CONTRIBUTING.md', 'SECURITY.md',
  'README.md', 'README.en.md', 'README.pt-BR.md', 'OPEN_SOURCE_SETUP.md',
  'package.json', 'package-lock.json', 'tsconfig.base.json', 'tsconfig.json', 'vitest.config.ts',
]);
export const PUBLIC_DOC_ENTRIES = [
  'INSTRUCTIONS.md', 'SKILLS_INCLUDED.md', 'SERVICE_MAP_SYKA.md', 'THIRD_PARTY_NOTICES_HYPERFRAMES.md',
  'licenses', 'reference', 'skills', 'guides', 'examples', 'resources',
];
const PUBLIC_DOC_FILES = new Set(['INSTALLATION_PREPARATION.md', 'LICENSING_BOUNDARIES.md', 'RELEASING.md', 'WINDOWS-SIGNING.md']);
const DENIED_PARTS = new Set([
  '.git', '.runtime', 'node_modules', 'dist', 'out', 'build', 'target', 'coverage',
  '__pycache__', '.cache', 'cache', 'output', 'outputs', '.codex', '.agents', '.claude',
  '.vscode', '.idea', '.vercel', 'projects', 'profiles', 'credentials', 'conversations',
  'qa', 'qa-runtime', 'recordings',
]);
const TEXT_EXTENSIONS = new Set([
  '.md', '.txt', '.json', '.jsonc', '.yml', '.yaml', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.mts', '.cts', '.css', '.html', '.svg', '.rs', '.toml', '.lock', '.py', '.ps1', '.sh', '.bat',
  '.cmd', '.patch', '.wgsl', '.glsl', '.xml', '.manifest', '.example',
]);
const EXECUTABLE_EXTENSIONS = new Set(['.exe', '.dll', '.node', '.so', '.dylib', '.msi', '.dmg']);
const ARCHIVE_EXTENSIONS = new Set(['.zip', '.7z', '.rar', '.tar', '.gz', '.tgz', '.bz2']);
const MEDIA_EXTENSIONS = new Set(['.ico', '.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.mp4', '.mov', '.mkv', '.webm', '.wav', '.mp3', '.ogg', '.m4a', '.flac']);
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts']);
const SOURCE_RESOLUTION = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.json', '.css', '.svg', '.png', '.wgsl', '.glsl', '/index.ts', '/index.tsx', '/index.js', '/index.mjs'];
const posix = value => value.split(sep).join('/');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const inside = (root, path) => {
  const rel = relative(resolve(root), resolve(path));
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + sep));
};
const issue = (path, line, type, severity = 'error') => ({ path, line, type, severity });
// Human-reviewed synthetic test sentinels. A changed byte,
// filename, line, or finding type invalidates this exception.
const VERIFIED_TEST_FIXTURES = [
  { path: 'packages/agent-chat/test/codex-policy.test.ts', line: 30, type: 'credential-like-assignment', sha256: '4d0d5ccff9441f3228d2ec1f661e6ca49f55acc26f6d0fac75f94bddb4c3525a' },
  { path: 'packages/agent-chat/test/external-harnesses.test.ts', line: 23, type: 'credential-like-assignment', sha256: '20bc67ce10c00359e596a28c26d5f0ac46da952e8b7d14499447132615c817e2' },
  { path: 'packages/agent-chat/test/external-harnesses.test.ts', line: 23, type: 'credential-like-assignment', sha256: '401873f0ee3f334567b7635a9aa400afc9ef73421ff2c4b97566d3ca0e3ebb03' },
  { path: 'apps/desktop/src/syka-groq.test.ts', line: 29, type: 'groq-key', sha256: 'ed0e1b40a3025cb887487ffae811f91ad91ea2d22bc4e190f72b7aa507a976f6' },
  { path: 'apps/desktop/src/syka-groq.test.ts', line: 29, type: 'groq-key', sha256: '865b036cfcfda110dcf8a6ef6253e2fdd33701a3e95d944466ec189489124310' },
  { path: 'packages/agent-chat/test/hermes-login.test.py', line: 74, type: 'credential-like-assignment', sha256: '77acd97841d2005466a93fd8ba4f0422cda00095b8d8e6a5d375d1af1a95da3e' },
  { path: 'packages/agent-chat/test/hermes-login.test.py', line: 96, type: 'credential-like-assignment', sha256: '77acd97841d2005466a93fd8ba4f0422cda00095b8d8e6a5d375d1af1a95da3e' },
  { path: 'packages/agent-chat/test/hermes-login.test.ts', line: 18, type: 'credential-like-assignment', sha256: 'fb947152368339701098f2c8bb55790dd813832ae034a46857f83b604c78e117' },
];

/** Deliberate public-source allowlist. Never interpret .gitignore as publication permission. */
export function sourcePolicy(path, isDirectory = false) {
  const normalized = path.replaceAll('\\', '/');
  const parts = normalized.split('/');
  if (!normalized || normalized.startsWith('/') || parts.includes('..')) return { include: false, reason: 'invalid-path' };
  // This tracked editor module is source; private user project directories are not.
  const editorProjectSource = normalized === 'apps/web/src/projects' || normalized.startsWith('apps/web/src/projects/');
  const pinnedCuelume = normalized === 'scripts/lib/cuelume/dist' || normalized.startsWith('scripts/lib/cuelume/dist/');
  if (parts.some(part => DENIED_PARTS.has(part.toLowerCase()) && !(part === 'projects' && editorProjectSource) && !(part === 'dist' && pinnedCuelume))) return { include: false, reason: 'private-or-generated' };
  const name = parts.at(-1);
  if (/^\.env(?:\.|$)/i.test(name) && !/^\.env(?:\.[^.]+)*\.example$/i.test(name)) return { include: false, reason: 'private-environment' };
  if (/\.(?:log|sqlite(?:3)?|db|db-wal|db-shm|cpuprofile|tsbuildinfo|pyc|pdb|map)$/i.test(name) || name === '.DS_Store' || name === '.gitkeep') return { include: false, reason: 'generated-data' };
  if (/^(?:id_rsa|id_ed25519|credentials(?:\.|$)|secrets?(?:\.|$))/.test(name) || /\.(?:pem|key|p12|pfx)$/i.test(name)) return { include: false, reason: 'credential-file' };
  if (parts.length === 1) return { include: isDirectory ? ['apps', 'packages', 'scripts', 'patches', 'docs', '.github'].includes(name) : ROOT_FILES.has(name), reason: 'outside-root-allowlist' };
  if (parts[0] === '.github') return { include: normalized === '.github/workflows' || ['.github/workflows/build-windows.yml', '.github/workflows/release.yml'].includes(normalized), reason: 'nonessential-upstream-workflow' };
  if (parts[0] === 'docs') {
    const entry = parts[1];
    const allowed = PUBLIC_DOC_ENTRIES.includes(entry) || (parts.length === 2 && PUBLIC_DOC_FILES.has(entry));
    if (!allowed) return { include: false, reason: 'historical-or-private-documentation' };
    if (/(?:^|\/)(?:QA[_-]|AUDIT[_-]|AUDITORIA[_-]|HANDOFF[_-])/i.test(normalized)) return { include: false, reason: 'historical-qa-documentation' };
    return { include: true, reason: 'public-documentation' };
  }
  if (parts[0] === 'apps') {
    if (!['cli', 'desktop', 'web'].includes(parts[1])) return { include: false, reason: 'unknown-app' };
    if (parts[1] === 'desktop' && ['cli', 'runtime', 'web', 'docs', 'assets'].includes(parts[2])) return { include: false, reason: parts[2] === 'assets' ? 'excluded-upstream-brand-assets' : 'desktop-generated-stage' };
    return { include: true, reason: 'application-source' };
  }
  if (parts[0] === 'packages') {
    if (parts[1] === 'content-package' && (/^verify/.test(name) || name === 'prepare-example.mjs')) return { include: false, reason: 'nonessential-local-qa-helper' };
    return { include: true, reason: 'package-source' };
  }
  if (parts[0] === 'scripts') {
    if (parts.length === 2 && /^(?:qa-|recover-|onboarding-preview|dev-publication|test-personalization)/i.test(name)) return { include: false, reason: 'nonessential-local-qa-helper' };
    return { include: true, reason: 'build-and-development-source' };
  }
  if (parts[0] === 'patches') return { include: true, reason: 'dependency-patch' };
  return { include: false, reason: 'outside-allowlist' };
}

function placeholder(value) {
  return /(?:example|placeholder|dummy|fake|test[-_ ]?token|your[-_ ]?(?:key|token|secret)|insert[-_]|replace[-_]|changeme|xxxx|<[^>]+>|\$\{)/i.test(value);
}

/** Findings never contain matched values, source excerpts, or credential hashes. */
export function scanText(text, path) {
  const findings = [];
  const rules = [
    ['github-token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,255}|github_pat_[A-Za-z0-9_]{60,255})\b/g],
    ['openai-or-provider-key', /\bsk-(?:(?:proj|svcacct)-)?[A-Za-z0-9_-]{24,180}\b/g],
    ['groq-key', /\bgsk_[A-Za-z0-9_-]{32,180}\b/g],
    ['huggingface-token', /\bhf_[A-Za-z0-9]{24,180}\b/g],
    ['gitlab-token', /\bglpat-[A-Za-z0-9_-]{20,180}\b/g],
    ['npm-token', /\bnpm_[A-Za-z0-9]{30,180}\b/g],
    ['stripe-secret-key', /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{24,180}\b/g],
    ['supabase-secret-key', /\bsb_secret_[A-Za-z0-9_-]{24,180}\b/g],
    ['linear-api-key', /\blin_api_[A-Za-z0-9]{24,180}\b/g],
    ['google-api-key', /\bAIza[A-Za-z0-9_-]{35}\b/g],
    ['aws-access-key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
    ['slack-token', /\bxox[baprs]-[A-Za-z0-9-]{24,180}\b/g],
    ['discord-webhook-credential', /https?:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/api\/webhooks\/\d{15,25}\/[A-Za-z0-9_-]{30,200}/g],
    ['jwt-literal', /\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{20,}\b/g],
    ['private-key-material', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----[\s\S]{20,}?-----END (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g],
  ];
  for (const [type, regex] of rules) {
    for (const match of text.matchAll(regex)) {
      // Provider-shaped literals always block. Example wording cannot exempt
      // an opaque credential; only separately reviewed file/hash exceptions can.
      findings.push(issue(path, text.slice(0, match.index).split('\n').length, type));
    }
  }
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/(?:[A-Za-z]:[\\/]{1,4}(?:Users[\\/]{1,4}(?!Public\b|Default\b|<|%*example\b|test\b)[^\\/\s"'<>]+|Coding[ \t]+(?:Proyects|Projects)|Agencia|Claudot)|\/(?:Users|home)\/(?!runner\b|example\b|<)[A-Za-z0-9_.-]+\/)/i.test(line)) findings.push(issue(path, i + 1, 'personal-machine-path'));
    const assignment = /(?:api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token|password)\s*["']?\s*[:=]\s*["']([^"'\r\n]{20,})["']/ig;
    for (const match of line.matchAll(assignment)) {
      const value = match[1];
      if (!placeholder(value) && /^[A-Za-z0-9_+./=-]+$/.test(value) && new Set(value).size >= 10) findings.push(issue(path, i + 1, 'credential-like-assignment'));
    }
    if (/data:image\/(?:png|jpe?g|webp|avif);base64,/i.test(line) && extname(path) === '.svg' && !path.startsWith('docs/resources/logos/')) findings.push(issue(path, i + 1, 'embedded-raster-review', 'warning'));
  }
  const seen = new Set();
  return findings.filter(item => {
    const key = item.path + ':' + item.line + ':' + item.type;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function statIfPresent(path) {
  try { return await lstat(path); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

async function safeAncestors(root, path) {
  if (!inside(root, path)) throw Object.assign(Error('Path outside allowed root.'), { code: 'UNSAFE_PATH' });
  let cursor = resolve(root);
  const rootStat = await lstat(cursor);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) throw Object.assign(Error('Redirected source root.'), { code: 'UNSAFE_ROOT' });
  for (const part of relative(root, path).split(sep).filter(Boolean)) {
    cursor = resolve(cursor, part);
    const info = await statIfPresent(cursor);
    if (!info) break;
    if (info.isSymbolicLink()) throw Object.assign(Error('Redirected path.'), { code: 'SYMLINK_PATH' });
  }
}

async function fileHash(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

async function binarySignature(path) {
  const file = await open(path, 'r');
  try {
    const bytes = Buffer.alloc(512);
    const { bytesRead } = await file.read(bytes, 0, bytes.length, 0);
    const prefix = bytes.subarray(0, bytesRead);
    if (prefix.length < 4) return null;
    if (prefix[0] === 0x4d && prefix[1] === 0x5a && prefix.length >= 64) return 'executable-signature';
    if (prefix.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]))) return 'executable-signature';
    if ([0xfeedface, 0xcefaedfe, 0xfeedfacf, 0xcffaedfe, 0xcafebabe, 0xbebafeca].includes(prefix.readUInt32BE(0))) return 'executable-signature';
    if (prefix.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) || prefix.subarray(0, 4).equals(Buffer.from([0x37, 0x7a, 0xbc, 0xaf]))) return 'archive-signature';
    return null;
  } finally { await file.close(); }
}

function resolveSourceReference(file, reference, files) {
  if (!reference.startsWith('.')) return true;
  const clean = reference.split('?')[0].split('#')[0];
  const target = logicalPath.normalize(logicalPath.join(logicalPath.dirname(file), clean));
  if (files.has(target) || SOURCE_RESOLUTION.some(extension => files.has(target + extension))) return true;
  if (/\.(?:js|jsx)$/.test(target) && SOURCE_RESOLUTION.some(extension => files.has(target.replace(/\.(?:js|jsx)$/, extension)))) return true;
  return false;
}

/** Read import literals as tokens so strings containing example source do not become imports. */
function staticReferences(body) {
  const tokens = [];
  let cursor = 0;
  while (cursor < body.length) {
    const char = body[cursor];
    if (/\s/.test(char)) { cursor++; continue; }
    if (body.startsWith('//', cursor)) { const end = body.indexOf('\n', cursor + 2); cursor = end === -1 ? body.length : end + 1; continue; }
    if (body.startsWith('/*', cursor)) { const end = body.indexOf('*/', cursor + 2); cursor = end === -1 ? body.length : end + 2; continue; }
    if (char === '"' || char === "'" || char.charCodeAt(0) === 96) {
      const start = cursor++, quote = char;
      let value = '';
      while (cursor < body.length && body[cursor] !== quote) {
        if (body[cursor] === '\\') { cursor++; value += body[cursor] ?? ''; cursor++; }
        else value += body[cursor++];
      }
      cursor++;
      tokens.push({ kind: 'string', value, offset: start });
      continue;
    }
    const previous = tokens.at(-1)?.value;
    if (char === '/' && (!previous || ['(', '=', ':', ',', '[', 'return', '!', '?', ';', '|', '&'].includes(previous))) {
      cursor++;
      let inClass = false;
      while (cursor < body.length) {
        if (body[cursor] === '\\') { cursor += 2; continue; }
        if (body[cursor] === '[') inClass = true;
        else if (body[cursor] === ']') inClass = false;
        else if (body[cursor] === '/' && !inClass) { cursor++; break; }
        cursor++;
      }
      while (/[a-z]/i.test(body[cursor] ?? '') && cursor < body.length) cursor++;
      tokens.push({ kind: 'regex', value: 'regex', offset: cursor });
      continue;
    }
    if (/[A-Za-z_$]/.test(char)) {
      const start = cursor++;
      while (cursor < body.length && /[A-Za-z0-9_$]/.test(body[cursor])) cursor++;
      tokens.push({ kind: 'identifier', value: body.slice(start, cursor), offset: start });
      continue;
    }
    tokens.push({ kind: 'punctuation', value: char, offset: cursor++ });
  }
  const references = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.kind !== 'identifier') continue;
    if (['import', 'require'].includes(token.value) && tokens[i + 1]?.value === '(' && tokens[i + 2]?.kind === 'string' && tokens[i + 3]?.value === ')') references.push(tokens[i + 2]);
    else if (token.value === 'import' && tokens[i + 1]?.kind === 'string') references.push(tokens[i + 1]);
    else if (['import', 'export'].includes(token.value) && tokens[i + 1]?.value !== '.') {
      for (let j = i + 1; j < Math.min(i + 100, tokens.length) && tokens[j].value !== ';'; j++) {
        if (tokens[j].kind === 'identifier' && tokens[j].value === 'from' && tokens[j + 1]?.kind === 'string') { references.push(tokens[j + 1]); break; }
        if (tokens[j].kind === 'identifier' && ['const', 'function', 'class', 'default'].includes(tokens[j].value)) break;
      }
    }
  }
  return references.filter(item => item.value.startsWith('.') && !item.value.includes('$' + '{'));
}

export function validateSupport(entries, textFiles) {
  const findings = [];
  const files = new Set(entries.map(entry => entry.path));
  for (const path of ['README.md', 'README.en.md', 'README.pt-BR.md', 'CREDITS.md', 'LICENSE_POLICY.md', 'CONTRIBUTING.md', 'SECURITY.md']) {
    if (!textFiles.has(path)) continue;
    const body = textFiles.get(path);
    const targets = [...body.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)].map(match => ({ target: match[1], offset: match.index }))
      .concat([...body.matchAll(/(?:src|href)="([^"]+)"/g)].map(match => ({ target: match[1], offset: match.index })));
    for (const { target, offset } of targets) {
      if (/^(?:https?:|mailto:|#)/i.test(target)) continue;
      const clean = decodeURIComponent(target.split('#')[0].replace(/^<|>$/g, ''));
      if (!clean) continue;
      const resolved = logicalPath.normalize(logicalPath.join(logicalPath.dirname(path), clean));
      if (!files.has(resolved) && !entries.some(entry => entry.path.startsWith(resolved + '/'))) findings.push(issue(path, body.slice(0, offset).split('\n').length, 'missing-public-document-link'));
    }
  }
  for (const [path, body] of textFiles) {
    if (basename(path) === 'package.json') {
      let pkg;
      try { pkg = JSON.parse(body); } catch { findings.push(issue(path, 1, 'invalid-package-json')); continue; }
      for (const command of Object.values(pkg.scripts ?? {})) {
        for (const match of command.matchAll(/(?:^|[;&]\s*|\s)(?:node|python3?|sh|pwsh|powershell)\s+(?:-[A-Za-z][^\s]*\s+)*(?!-e\b|-c\b)([A-Za-z0-9_./-]+\.(?:m?js|cjs|ts|py|ps1|sh))/g)) {
          if (!resolveSourceReference(path, './' + match[1], files)) findings.push(issue(path, 1, 'missing-script-support'));
        }
      }
    }
    if (!SOURCE_EXTENSIONS.has(extname(path))) continue;
    for (const reference of staticReferences(body)) {
      if (!resolveSourceReference(path, reference.value, files)) findings.push(issue(path, body.slice(0, reference.offset).split('\n').length, 'missing-relative-import'));
    }
  }
  return findings;
}

export async function inventoryPublicSource(root, { approvedMedia = [], maxFileBytes = MAX_SOURCE_FILE_BYTES } = {}) {
  const requestedRoot = await lstat(resolve(root));
  if (requestedRoot.isSymbolicLink() || !requestedRoot.isDirectory()) throw Object.assign(Error('Redirected source root.'), { code: 'UNSAFE_ROOT' });
  const sourceRoot = await realpath(resolve(root));
  await safeAncestors(sourceRoot, sourceRoot);
  const entries = [], excluded = [], findings = [], reviewed = [], media = [], textFiles = new Map();
  const approvals = new Map(approvedMedia.map(item => [item.path, item.sha256]));
  async function walk(directory) {
    const children = (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name));
    for (const child of children) {
      const absolute = resolve(directory, child.name);
      const path = posix(relative(sourceRoot, absolute));
      const info = await lstat(absolute);
      const policy = sourcePolicy(path, info.isDirectory());
      if (!policy.include) { excluded.push({ path, directory: info.isDirectory(), reason: policy.reason }); continue; }
      if (info.isSymbolicLink()) { excluded.push({ path, directory: false, reason: 'symlink' }); findings.push(issue(path, 0, 'source-symlink')); continue; }
      if (info.isDirectory()) { await walk(absolute); continue; }
      if (!info.isFile()) { excluded.push({ path, directory: false, reason: 'nonregular-file' }); findings.push(issue(path, 0, 'nonregular-source')); continue; }
      if (info.size > maxFileBytes) { excluded.push({ path, directory: false, reason: 'oversized-source-file' }); findings.push(issue(path, 0, 'file-over-90-mib')); continue; }
      const extension = extname(path).toLowerCase();
      if (EXECUTABLE_EXTENSIONS.has(extension) || ARCHIVE_EXTENSIONS.has(extension)) {
        excluded.push({ path, directory: false, reason: 'binary-distribution-artifact' }); findings.push(issue(path, 0, 'binary-distribution-artifact')); continue;
      }
      const signature = await binarySignature(absolute);
      if (signature) { excluded.push({ path, directory: false, reason: signature }); findings.push(issue(path, 0, signature)); continue; }
      const hash = await fileHash(absolute);
      const entry = { path, bytes: info.size, sha256: hash, kind: MEDIA_EXTENSIONS.has(extension) ? 'media' : TEXT_EXTENSIONS.has(extension) || /(?:^|\/)(?:LICENSE[^/]*|NOTICE[^/]*|Cargo\.lock|\.gitignore)$/.test(path) ? 'text' : 'resource' };
      entries.push(entry);
      if (entry.kind === 'text') {
        if (info.size > MAX_TEXT_BYTES) findings.push(issue(path, 0, 'text-too-large-to-audit'));
        else {
          const body = await readFile(absolute, 'utf8');
          if (body.includes('\0')) findings.push(issue(path, 0, 'binary-in-text-source'));
          else {
            textFiles.set(path, body);
            for (const finding of scanText(body, path)) {
              const verified = VERIFIED_TEST_FIXTURES.find(item => item.path === path && item.sha256 === hash && item.line === finding.line && item.type === finding.type);
              if (verified) reviewed.push({ ...finding, sha256: hash });
              else findings.push(finding);
            }
          }
        }
      }
      if (entry.kind === 'media') {
        const approved = approvals.get(path) === hash;
        media.push({ path, bytes: info.size, sha256: hash, approved });
        if (!approved) findings.push(issue(path, 0, 'media-origin-and-privacy-review', 'warning'));
      }
    }
  }
  await walk(sourceRoot);
  entries.sort((a, b) => a.path.localeCompare(b.path));
  findings.push(...validateSupport(entries, textFiles));
  const stageDocs = textFiles.get('apps/desktop/scripts/stage-docs.mjs');
  if (stageDocs) {
    const declaration = stageDocs.match(/export\s+const\s+publicEntries\s*=\s*\[([^\]]+)\]/);
    const actual = declaration ? [...declaration[1].matchAll(/['"]([^'"]+)['"]/g)].map(match => match[1]).sort() : [];
    if (JSON.stringify(actual) !== JSON.stringify([...PUBLIC_DOC_ENTRIES].sort())) findings.push(issue('apps/desktop/scripts/stage-docs.mjs', 0, 'public-doc-policy-drift'));
  }
  const manifest = { schemaVersion: 1, policyVersion: 1, upstreamBaseCommit: UPSTREAM_BASE_COMMIT, files: entries };
  const manifestSha256 = sha256(JSON.stringify(manifest));
  const errors = findings.filter(item => item.severity === 'error').length;
  const unreviewedMedia = media.filter(item => !item.approved).length;
  return {
    manifest, manifestSha256, excluded, findings, reviewed, media,
    summary: { files: entries.length, bytes: entries.reduce((sum, entry) => sum + entry.bytes, 0), excludedEntries: excluded.length, errors, warnings: findings.length - errors, verifiedTestFixtures: reviewed.length, media: media.length, unreviewedMedia, ready: errors === 0 && unreviewedMedia === 0 },
  };
}

/** Only named audit outputs are written. No source content or matched secret values enter reports. */
export async function writeAudit(root, inventory, reportDirectory = resolve(root, '.runtime/release-audit')) {
  const allowed = resolve(root, '.runtime/release-audit');
  if (resolve(reportDirectory) !== allowed) throw Object.assign(Error('Audit report must use the allowed directory.'), { code: 'UNSAFE_REPORT_DIRECTORY' });
  await safeAncestors(root, allowed);
  await mkdir(allowed, { recursive: true });
  const files = {
    'public-source-manifest.json': { ...inventory.manifest, manifestSha256: inventory.manifestSha256 },
    'public-source-findings.json': { summary: inventory.summary, findings: inventory.findings, verifiedTestFixtures: inventory.reviewed, media: inventory.media },
    'public-source-excluded.json': inventory.excluded,
  };
  for (const [name, value] of Object.entries(files)) {
    const target = resolve(allowed, name);
    await safeAncestors(root, target);
    await writeFile(target, JSON.stringify(value, null, 2) + '\n', { encoding: 'utf8' });
  }
  const lines = [
    '# Public source dry-run audit', '', 'Snapshot without Git history. Source bytes are not modified.', '',
    ...Object.entries(inventory.summary).map(([name, value]) => '- ' + name + ': ' + value),
    '- manifest SHA-256: ' + inventory.manifestSha256, '',
    'Findings contain only filename, line, type and severity. Secret matching is a bounded heuristic, not proof that no unknown credential format exists.', '',
    '| File | Line | Type | Severity |', '| --- | --- | --- | --- |',
    ...inventory.findings.map(item => '| ' + item.path.replaceAll('|', '\\|') + ' | ' + item.line + ' | ' + item.type + ' | ' + item.severity + ' |'),
    '', 'Media requires a matching path + SHA-256 approval after origin/privacy review. All exclusions are listed separately; excluded directories were not traversed.',
  ];
  const report = resolve(allowed, 'public-source-report.md');
  await safeAncestors(root, report);
  await writeFile(report, lines.join('\n') + '\n', 'utf8');
  return allowed;
}

/** Creates an absent/empty destination only. Never deletes, replaces or resets a checkout. */
export async function exportPublicSource(root, inventory, destination = resolve(root, '.runtime/public-source')) {
  const target = resolve(destination);
  if (target !== resolve(root, '.runtime/public-source')) throw Object.assign(Error('Destination must be the designated public snapshot directory.'), { code: 'UNSAFE_DESTINATION' });
  if (!inventory.summary.ready) throw Object.assign(Error('Resolve blocking findings and media reviews first.'), { code: 'AUDIT_NOT_READY' });
  await safeAncestors(root, target);
  const targetStat = await statIfPresent(target);
  if (targetStat && (!targetStat.isDirectory() || (await readdir(target)).length)) throw Object.assign(Error('Destination is not an empty directory.'), { code: 'DESTINATION_NOT_EMPTY' });
  for (const entry of inventory.manifest.files) {
    const source = resolve(root, entry.path);
    await safeAncestors(root, source);
    const info = await lstat(source);
    if (!info.isFile() || info.size !== entry.bytes || await fileHash(source) !== entry.sha256) throw Object.assign(Error('Source changed after audit.'), { code: 'SOURCE_CHANGED' });
  }
  await mkdir(target, { recursive: true });
  for (const entry of inventory.manifest.files) {
    const source = resolve(root, entry.path);
    await safeAncestors(root, source);
    const bytes = await readFile(source);
    if (sha256(bytes) !== entry.sha256) throw Object.assign(Error('Source changed during export.'), { code: 'SOURCE_CHANGED' });
    const copied = resolve(target, entry.path);
    if (!inside(target, copied)) throw Object.assign(Error('Invalid manifest path.'), { code: 'UNSAFE_MANIFEST_PATH' });
    await safeAncestors(target, copied);
    await mkdir(dirname(copied), { recursive: true });
    await writeFile(copied, bytes, { flag: 'wx' });
  }
  await writeFile(resolve(target, 'PUBLIC_SOURCE_MANIFEST.json'), JSON.stringify({ ...inventory.manifest, manifestSha256: inventory.manifestSha256 }, null, 2) + '\n', { flag: 'wx' });
  return { destination: target, ...inventory.summary, manifestSha256: inventory.manifestSha256 };
}
