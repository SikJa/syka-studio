import { closeSync, openSync, readFileSync, readSync, realpathSync, statSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, relative, sep } from 'node:path';

function inside(root, path) {
  const rel = relative(realpathSync(root), realpathSync(path));
  return rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel);
}

function windowsMachine(path) {
  const fd = openSync(path, 'r');
  try {
    const dos = Buffer.alloc(64);
    if (readSync(fd, dos, 0, 64, 0) !== 64 || dos.toString('ascii', 0, 2) !== 'MZ') throw Error('invalid PE executable');
    const offset = dos.readUInt32LE(60), pe = Buffer.alloc(6);
    if (offset < 64 || readSync(fd, pe, 0, 6, offset) !== 6 || pe.readUInt32LE(0) !== 0x4550) throw Error('invalid PE header');
    return ({ 0x8664: 'x64', 0xaa64: 'arm64', 0x14c: 'ia32' })[pe.readUInt16LE(4)] ?? 'unknown';
  } finally { closeSync(fd); }
}

/** Read-only check of prepared app/resources; does not stage, install or run binaries. */
export function checkDistributionLayout({ appDir, resourcesDir = appDir, platform = process.platform, arch = process.arch }) {
  const checks = [];
  function check(label, run) {
    try { run(); checks.push({ label, ok: true }); }
    catch (error) { checks.push({ label, ok: false, error: error.message }); }
  }
  function file(root, path) {
    const absolute = join(root, path);
    const info = statSync(absolute);
    if (!info.isFile() || info.size === 0 || !inside(root, absolute)) throw Error(`Missing, empty or redirected file: ${path}`);
    return absolute;
  }
  for (const path of ['dist/main.js', 'dist/preload.js', 'dist/screen-region-preload.js', 'dist/agent-host.mjs',
    'web/index.html', 'web/notifications.html', 'web/preview-worker.html']) check(path, () => file(appDir, path));
  if (platform === 'darwin') check('native window style', () => file(appDir, 'dist/corner_radius.node'));
  check('cli/dapi.js', () => file(resourcesDir, 'cli/dapi.js'));
  check('cli wrapper', () => {
    const path = file(resourcesDir, platform === 'win32' ? 'cli/bin/dapi.cmd' : 'cli/bin/dapi');
    if (platform !== 'win32' && !(statSync(path).mode & 0o111)) throw Error('The CLI wrapper is not executable.');
  });
  for (const path of ['docs/INSTRUCTIONS.md', 'docs/SKILLS_INCLUDED.md', 'docs/LICENSE', 'docs/CREDITS.md', 'docs/LICENSE_POLICY.md', 'docs/licenses/bundled/inventory.json']) check(path, () => file(resourcesDir, path));
  check('Syka release source', () => {
    const config = JSON.parse(readFileSync(file(appDir, 'release.config.json'), 'utf8'));
    if (config.repository !== 'SikJa/syka-studio') throw Error('Updates must use the Syka release repository.');
  });
  const runtime = join(resourcesDir, 'runtime');
  check('runtime dependency manifest', () => {
    const path = file(resourcesDir, 'runtime/package.json');
    const pkg = JSON.parse(readFileSync(path, 'utf8'));
    const dependencies = pkg.dependencies ?? {};
    if (!['esbuild', '@babel/core', '@babel/preset-typescript', 'babel-preset-solid', 'playwright-core', 'hyperframes', 'onnxruntime-node'].every(name => dependencies[name])) {
      throw Error('The runtime is missing compiler, browser or background-removal dependencies.');
    }
    for (const [name, version] of Object.entries(dependencies)) {
      check(`runtime module: ${name}`, () => {
        if (!/^\d+\.\d+\.\d+(?:[-+].*)?$/.test(version)) throw Error('Runtime versions must be pinned to tested versions.');
        const installedPath = file(runtime, `node_modules/${name}/package.json`);
        const installed = JSON.parse(readFileSync(installedPath, 'utf8'));
        if (installed.version !== version) throw Error(`Expected ${version}, found ${installed.version}.`);
        if (installed.main || installed.exports) {
          const require = createRequire(path);
          const entry = require.resolve(name);
          if (!inside(runtime, entry)) throw Error('The module resolved from the developer checkout instead of the staged runtime.');
        } else {
          const bins = typeof installed.bin === 'string' ? [installed.bin] : Object.values(installed.bin ?? {});
          if (!bins.length) throw Error('The package has no resolvable module or CLI entry.');
          for (const bin of bins) file(dirname(installedPath), bin);
        }
        if (name === 'hyperframes' && !readdirSync(join(dirname(installedPath), 'dist')).some(p => /^pipeline-[\w-]+\.js$/.test(p))) {
          throw Error('HyperFrames does not include the background-removal pipeline.');
        }
      });
    }
  });
  check('background-removal runner', () => file(resourcesDir, 'runtime/background-removal-runner.mjs'));
  check('native esbuild for target', () => file(resourcesDir,
    `runtime/node_modules/@esbuild/${platform}-${arch}/${platform === 'win32' ? 'esbuild.exe' : 'bin/esbuild'}`));
  check('native ONNX for target', () => file(resourcesDir,
    `runtime/node_modules/onnxruntime-node/bin/napi-v3/${platform}/${arch}/onnxruntime_binding.node`));
  if (platform === 'win32') {
    for (const name of ['onnxruntime.dll', 'DirectML.dll']) check(`ONNX library: ${name}`, () => file(resourcesDir,
      `runtime/node_modules/onnxruntime-node/bin/napi-v3/win32/${arch}/${name}`));
    for (const name of ['syka-screen-recorder.exe']) check(`Windows binary: ${name}`, () => {
      const path = file(resourcesDir, 'runtime/bin/' + name);
      const machine = windowsMachine(path);
      if (machine !== arch) throw Error(`Expected ${arch} executable, found ${machine}.`);
    });
    for (const name of ['LICENSE-Whispera', 'TOOLS-NOTICE.txt']) check(`notice: ${name}`, () => file(resourcesDir, 'runtime/bin/' + name));
    check('verified upstream tools bootstrap', () => {
      const value = JSON.parse(readFileSync(file(resourcesDir, 'runtime/toolchain.json'), 'utf8'));
      if (value.platform !== platform || value.arch !== arch || value.mode !== 'verified-upstream-download') throw Error('Invalid tool bootstrap target.');
      for (const id of ['node', 'ffmpeg', 'yt-dlp']) {
        const tool = value.tools?.find(tool => tool.id === id);
        if (!tool || !/^[a-f0-9]{64}$/.test(tool.sha256) || !/^https:\/\/(github\.com|nodejs\.org)\//.test(tool.url)) throw Error(`Missing verified bootstrap for ${id}.`);
      }
    });
  }
  return { platform, arch, ok: checks.every(c => c.ok), checks,
    limitations: ['Does not install or launch a distributed app.', 'Does not verify signing/notarization or exercise codecs on another PC.'] };
}
