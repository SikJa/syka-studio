import { fileURLToPath } from 'node:url';
import { resolve, dirname, join } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.env.SYKA_RUNTIME_ROOT = join(root, '.runtime', 'publication');
process.env.SYKA_MEDIA_ROOT = join(root, '.runtime', 'publication', 'projects');
process.env.SYKA_DEV_PORT = '5298';
process.env.SYKA_MCP_PORT = '3298';
await import('./dev-syka.mjs');
