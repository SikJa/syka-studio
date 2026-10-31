import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureGraphifyRuntime } from './lib/graphify-setup.mjs';

// stdout is only the executable path for launchers; progress belongs on stderr.
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
console.log(await ensureGraphifyRuntime(root, message => console.error(message)));
