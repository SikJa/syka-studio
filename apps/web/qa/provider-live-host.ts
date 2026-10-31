import { createAgentHost } from '../../../packages/agent-chat/src/host/index';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomBytes } from 'node:crypto';

// Real providers and real authentication. This store owns no active projects.
const root = process.env.SYKA_PROVIDER_PREVIEW_ROOT;
if (!root) throw Error('Missing local provider preview directory');
const dataDir = resolve(root);
await mkdir(dataDir, { recursive: true });
const host = await createAgentHost({
  dataDir: join(dataDir, 'data'),
  runtimeDir: join(dataDir, 'runtime', 'codex-runtime'),
  token: randomBytes(32).toString('base64url'),
  host: '127.0.0.1', port: 0,
  allowedOrigins: ['http://localhost:5188', 'http://127.0.0.1:5188'],
  mcp: null, version: '0.208.0',
  log: () => {},
});
const endpoint = join(dataDir, 'endpoint.json');
await writeFile(endpoint + '.tmp', JSON.stringify({ url: host.url, pid: process.pid, mode: 'real', startedAt: Date.now() }));
await rename(endpoint + '.tmp', endpoint);
let stopping = false;
const stop = async () => { if (stopping) return; stopping = true; await host.stop(); process.exit(0); };
process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());
