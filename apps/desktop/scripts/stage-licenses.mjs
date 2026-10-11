/* MPL-2.0. Preserve the complete third-party notices used by compiled bundles. */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const desktop = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(desktop, '../..');
const target = join(desktop, 'docs', 'licenses', 'bundled');
mkdirSync(target, { recursive: true });
const inventory = [];
function notices(dir, name, version, license, kind) {
  const out = join(target, kind, name.replaceAll('/', '__')); mkdirSync(out, { recursive: true });
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !/^(licen[sc]e|copying|copyright|notice|third[_-]party[_-]licen[sc]es?)(?:[._-]|$)/i.test(entry.name)) continue;
    copyFileSync(join(dir, entry.name), join(out, entry.name)); files.push(entry.name);
  }
  inventory.push({ name, version, license: license || 'See package notices/source', kind, notices: files });
}
const lock = JSON.parse(readFileSync(join(repo, 'package-lock.json'), 'utf8'));
for (const [path, metadata] of Object.entries(lock.packages)) {
  if (!path.includes('node_modules/') || metadata.link) continue;
  const dir = join(repo, path), file = join(dir, 'package.json');
  if (!existsSync(file)) continue;
  const pkg = JSON.parse(readFileSync(file, 'utf8'));
  notices(dir, pkg.name, pkg.version, pkg.license, 'npm');
}
const runtime = join(desktop, 'runtime');
const runtimeLock = join(runtime, 'package-lock.json');
if (existsSync(runtimeLock)) {
  for (const [path, metadata] of Object.entries(JSON.parse(readFileSync(runtimeLock, 'utf8')).packages)) {
    if (!path.includes('node_modules/') || metadata.link) continue;
    const dir = join(runtime, path), file = join(dir, 'package.json');
    if (!existsSync(file)) continue;
    const pkg = JSON.parse(readFileSync(file, 'utf8'));
    notices(dir, pkg.name, pkg.version, pkg.license, 'runtime-npm');
  }
}
if (process.platform === 'win32') {
  const raw = execFileSync('cargo', ['metadata', '--locked', '--offline', '--format-version', '1', '--filter-platform', 'x86_64-pc-windows-msvc', '--manifest-path', join(desktop, 'native/screen-recorder/Cargo.toml')], { encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
  for (const pkg of JSON.parse(raw).packages) notices(dirname(pkg.manifest_path), pkg.name, pkg.version, pkg.license, 'rust');
}
writeFileSync(join(target, 'inventory.json'), JSON.stringify({ description: 'Installed dependency notices retained for source/binary publication. Includes build dependencies; this is not an exact binary SBOM.', packages: inventory }, null, 2) + '\n');
console.log(`stage-licenses: retained notices for ${inventory.length} npm/Rust packages`);
