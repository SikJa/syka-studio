import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { checkDistributionLayout } from './distribution-layout.mjs';
import { windowsTools } from './toolchain.mjs';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'syka-distribution-espacio-ñ-'));
  const write = (path, content = 'fixture') => {
    const target = join(root, path); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, content);
  };
  for (const path of ['dist/main.js', 'dist/preload.js', 'dist/screen-region-preload.js', 'dist/agent-host.mjs',
    'web/index.html', 'web/notifications.html', 'web/preview-worker.html', 'cli/dapi.js', 'cli/bin/dapi.cmd',
    'docs/INSTRUCTIONS.md', 'docs/SKILLS_INCLUDED.md', 'docs/LICENSE', 'docs/CREDITS.md', 'docs/LICENSE_POLICY.md', 'docs/licenses/bundled/inventory.json', 'runtime/background-removal-runner.mjs',
    'runtime/bin/LICENSE-Whispera', 'runtime/bin/TOOLS-NOTICE.txt',
    'runtime/node_modules/@esbuild/win32-x64/esbuild.exe',
    'runtime/node_modules/onnxruntime-node/bin/napi-v3/win32/x64/onnxruntime_binding.node',
    'runtime/node_modules/onnxruntime-node/bin/napi-v3/win32/x64/onnxruntime.dll',
    'runtime/node_modules/onnxruntime-node/bin/napi-v3/win32/x64/DirectML.dll',
    'runtime/node_modules/hyperframes/dist/pipeline-fixture.js']) write(path);
  write('release.config.json', JSON.stringify({ repository: 'SikJa/syka-studio' }));
  write('runtime/toolchain.json', JSON.stringify({ platform: 'win32', arch: 'x64', mode: 'verified-upstream-download', tools: windowsTools }));
  const dependencies = Object.fromEntries(['esbuild', '@babel/core', '@babel/preset-typescript', 'babel-preset-solid',
    'playwright-core', 'hyperframes', 'onnxruntime-node'].map(name => [name, '1.2.3']));
  write('runtime/package.json', JSON.stringify({ dependencies }));
  for (const name of Object.keys(dependencies)) {
    write(`runtime/node_modules/${name}/package.json`, JSON.stringify({ name, version: '1.2.3', main: 'index.cjs' }));
    write(`runtime/node_modules/${name}/index.cjs`, 'throw Error("This binary/module must never execute during a preflight")');
  }
  const executable = machine => {
    const bytes = Buffer.alloc(70); bytes.write('MZ'); bytes.writeUInt32LE(64, 60);
    bytes.writeUInt32LE(0x4550, 64); bytes.writeUInt16LE(machine, 68); return bytes;
  };
  write('runtime/bin/syka-screen-recorder.exe', executable(0x8664));
  const check = () => checkDistributionLayout({ appDir: root, platform: 'win32', arch: 'x64' });
  const clean = () => {
    assert.equal(dirname(resolve(root)), resolve(tmpdir())); assert.match(root, /syka-distribution-/);
    rmSync(root, { recursive: true, force: true });
  };
  return { root, write, executable, check, clean };
}

test('verifies a complete layout in a path with spaces/accents without loading a runtime module', () => {
  const f = fixture(); try {
    // HyperFrames is a CLI-only package with no main/exports field.
    f.write('runtime/node_modules/hyperframes/package.json', JSON.stringify({ name: 'hyperframes', version: '1.2.3', bin: { hyperframes: 'bin/hyperframes.mjs' } }));
    f.write('runtime/node_modules/hyperframes/bin/hyperframes.mjs', 'throw Error("Must not execute")');
    assert.equal(f.check().ok, true);
  } finally { f.clean(); }
});
test('rejects a missing preview page and tools bootstrap, even if a developer machine has tools on PATH', () => {
  const f = fixture();
  try {
    rmSync(join(f.root, 'web/preview-worker.html')); rmSync(join(f.root, 'runtime/toolchain.json'));
    const result = f.check(); assert.equal(result.ok, false);
    assert.deepEqual(result.checks.filter(c => !c.ok).map(c => c.label), ['web/preview-worker.html', 'verified upstream tools bootstrap']);
  } finally { f.clean(); }
});
test('rejects an executable built for another architecture', () => {
  const f = fixture();
  try {
    f.write('runtime/bin/syka-screen-recorder.exe', f.executable(0xaa64));
    assert.match(f.check().checks.find(c => c.label === 'Windows binary: syka-screen-recorder.exe').error, /found arm64/);
  } finally { f.clean(); }
});

test('rejects upstream update configuration and an unverified bootstrap artifact', () => {
  const f = fixture(); try {
    f.write('release.config.json', JSON.stringify({ repository: 'diffusionstudio/editor' }));
    const tools = windowsTools.map(tool => ({ ...tool, sha256: 'not-a-checksum' }));
    f.write('runtime/toolchain.json', JSON.stringify({ platform: 'win32', arch: 'x64', mode: 'verified-upstream-download', tools }));
    assert.deepEqual(f.check().checks.filter(check => !check.ok).map(check => check.label), ['Syka release source', 'verified upstream tools bootstrap']);
  } finally { f.clean(); }
});
test('rejects a runtime dependency resolving outside its resource directory', () => {
  const f = fixture();
  try {
    f.write('runtime/node_modules/esbuild/package.json', JSON.stringify({ name: 'esbuild', version: '1.2.3', main: '../../../outside.cjs' }));
    f.write('outside.cjs', 'throw Error("Must not execute")');
    assert.equal(f.check().checks.find(c => c.label === 'runtime module: esbuild').ok, false);
  } finally { f.clean(); }
});
