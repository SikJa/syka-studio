import { createServer } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { DapiServer } from './server';

vi.mock('./renderer-calls', () => ({ RendererCalls: class { start() {} call() { return Promise.resolve({}); } } }));
vi.mock('./handlers', async () => {
  const { tools } = await import('@diffusionstudio/dapi');
  return { mainHandlers: Object.fromEntries(tools.filter(t => t.environment === 'main').map(t => [t.name, async () => ({})])) };
});

const running: DapiServer[] = [];
afterEach(() => { for (const server of running.splice(0)) server.stop(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

async function reservePort() {
  const server = createServer();
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = (server.address() as { port: number }).port;
  return { port, close: () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) };
}

function editor(port: number) {
  vi.stubEnv('SYKA_MCP_PORT', String(port));
  const server = new DapiServer({ version: 'test', docsDir: null, logs: () => [], onFirstConnection() {} });
  running.push(server); server.start(); return server;
}

describe('editor MCP instance ownership', () => {
  it('advertises the actual isolated endpoint and catalog without another editor', async () => {
    const reservation = await reservePort(); await reservation.close();
    const server = editor(reservation.port), url = `http://127.0.0.1:${reservation.port}/mcp`;
    expect(await server.status()).toEqual({ url, available: true, error: null });
    expect(await server.mcpUrl()).toBe(url);
    const client = new Client({ name: 'instance-test', version: '1' });
    try {
      await client.connect(new StreamableHTTPClientTransport(new URL(url + '?client=chat')));
      expect((await client.listTools()).tools.map(t => t.name)).toEqual(expect.arrayContaining(['context', 'capture', 'check']));
    } finally { await client.close(); }
    server.stop();
    expect((await server.status()).available).toBe(false);
  });

  it('reports a taken port and never adopts the owner or chooses another port', async () => {
    const occupied = await reservePort(); vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const server = editor(occupied.port), status = await server.status();
      expect(status).toMatchObject({ url: `http://127.0.0.1:${occupied.port}/mcp`, available: false });
      expect(status.error).toContain(`El puerto ${occupied.port} ya está ocupado`);
      expect(status.error).toContain('no se usará otra ventana');
      expect(await server.mcpUrl()).toBeNull();
    } finally { await occupied.close(); }
  });
});
