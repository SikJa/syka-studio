import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkDistributionLayout } from './lib/distribution-layout.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argument = (name, fallback) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
if (process.argv.includes('--help')) {
  console.log('node scripts/check-distribution.mjs [--app-dir=path] [--resources-dir=path] [--platform=win32|darwin] [--arch=x64|arm64] [--json]');
  process.exit(0);
}
const appDir = resolve(argument('app-dir', resolve(root, 'apps/desktop')));
const result = checkDistributionLayout({ appDir, resourcesDir: resolve(argument('resources-dir', appDir)),
  platform: argument('platform', process.platform), arch: argument('arch', process.arch) });
if (process.argv.includes('--json')) console.log(JSON.stringify(result, null, 2));
else {
  for (const check of result.checks) console.log(`${check.ok ? 'OK' : 'MISSING'} ${check.label}${check.error ? ': ' + check.error : ''}`);
  console.log(`Distribution preparation: ${result.ok ? 'passed' : 'incomplete'} (${result.platform}/${result.arch}). No installer created.`);
}
if (!result.ok) process.exitCode = 1;
