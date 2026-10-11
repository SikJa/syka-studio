import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CODE_GRAPH_TOOL, codeGraph } from '../src/host/code-graph';
import { WorkspaceTools, WORKSPACE_TOOLS } from '../src/host/workspace-tools';
import { startEditorToolBridge } from '../src/host/editor-tool-bridge';
import { chatInstructions } from '../src/host/harness';

const hash = (text: string) => createHash('sha256').update(text).digest('hex');
let root: string;
let policy: string;
const source = 'export function render() { return double(2); }';
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'syka-code-graph-test-'));
  await Promise.all(['scripts', 'src', 'graphify-out'].map(p => mkdir(join(root, p))));
  policy = JSON.stringify({ files: [], directories: ['src'], patterns: [], extensions: ['.ts'], maxFiles: 20, maxFileBytes: 10000 });
  await writeFile(join(root, 'scripts/graphify-scope.json'), policy);
  await writeFile(join(root, 'src/main.ts'), source);
  const graphJson = JSON.stringify({ nodes: [
    { id: 'render', label: 'render()', source_file: 'src/main.ts', source_location: 'L1' },
    { id: 'double', label: 'double()', source_file: 'src/main.ts', source_location: 'L1' },
  ], links: [{ source: 'render', target: 'double', relation: 'calls', confidence: 'INFERRED', source_file: 'src/main.ts', source_location: 'L1' }] });
  await writeFile(join(root, 'graphify-out/code-index.json'), JSON.stringify({ schemaVersion: 1, pipelineVersion: 1, sourceRoot: root, files: { 'src/main.ts': hash(source) }, scopeHash: hash(policy), generation: 'fixture', generatedAt: new Date().toISOString(), extractor: 'fixture (not real AST)', graphJson, checksum: hash(graphJson) }));
});
afterEach(async () => {
  if (!resolve(root).startsWith(resolve(tmpdir()) + sep) || !root.includes('syka-code-graph-test-')) throw Error('Unsafe fixture cleanup');
  await rm(root, { recursive: true, force: true });
});

describe('code map tool boundaries (synthetic graph, real filesystem and MCP)', () => {
  it('finds routes, bounded relations and confidence through workspace dispatch', async () => {
    expect(WORKSPACE_TOOLS).toContain(CODE_GRAPH_TOOL);
    expect(chatInstructions('/video/project', undefined, true)).toContain('syka_code_graph query first');
    expect(chatInstructions('/video/project')).not.toContain('syka_code_graph query first');
    const tools = new WorkspaceTools('/video/project', undefined, undefined, undefined, root);
    expect(await tools.call('syka_code_graph', { action: 'query', query: 'render' })).toMatchObject({ status: { current: true }, matches: [{ id: 'render', path: 'src/main.ts' }] });
    expect(await tools.call('syka_code_graph', { action: 'relations', nodeId: 'render', limit: 1 })).toMatchObject({ relations: [{ relation: 'calls', confidence: 'INFERRED', to: { id: 'double' } }] });
  });
  it('verifies content on each call, including additions and deletions', async () => {
    await writeFile(join(root, 'src/main.ts'), source.replace('2', '3'));
    expect(await codeGraph(root, { action: 'query', query: 'render' })).toMatchObject({ status: { current: false, changedCount: 1 } });
    await writeFile(join(root, 'src/new.ts'), 'export function newRoute() {}');
    expect(await codeGraph(root, { action: 'search', query: 'newRoute' })).toMatchObject({ source: 'direct-source', matches: [{ path: 'src/new.ts', line: 1 }] });
    await rm(join(root, 'src/main.ts'));
    expect(await codeGraph(root, { action: 'status' })).toMatchObject({ status: { current: false, changedCount: 2 } });
  });
  it('denies private sources/traversal, bounds results and signals missing coverage', async () => {
    await writeFile(join(root, 'src/credentials.ts'), 'private_marker');
    await writeFile(join(root, 'src/file.mp4'), 'private_marker');
    expect(await codeGraph(root, { action: 'search', query: 'private_marker' })).toMatchObject({ matches: [] });
    await expect(codeGraph(root, { action: 'search', query: 'token', path: '../private' })).rejects.toThrow();
    await expect(codeGraph(root, { action: 'query', query: 'render', limit: 10000 })).rejects.toThrow();
    expect(await codeGraph(root, { action: 'query', query: 'not-covered' })).toMatchObject({ matches: [], coverage: { completeRepository: false } });
    expect(await codeGraph(undefined, { action: 'status' })).toMatchObject({ status: { current: false, state: 'unavailable' } });
  });
  it('corrupt snapshots never claim freshness and direct search remains available', async () => {
    await writeFile(join(root, 'graphify-out/code-index.json'), '{bad');
    expect(await codeGraph(root, { action: 'search', query: 'render' })).toMatchObject({ status: { current: false }, matches: [{ path: 'src/main.ts' }] });
  });
  it('advertises and executes the tool over the real MCP bridge used by Claude/ACP', async () => {
    const bridge = await startEditorToolBridge({ cwd: root, model: 'fixture', env: { env: { SYKA_CODE_GRAPH_ROOT: root }, extraDirs: [] }, mcp: null, emit: () => {} });
    const request = async (method: string, params?: unknown) => (await fetch(bridge.url, { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), headers: { 'Content-Type': 'application/json' } })).json();
    try {
      const listing = await request('tools/list');
      expect(listing.result.tools).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'syka_code_graph' })]));
      const answer = await request('tools/call', { name: 'syka_code_graph', arguments: { action: 'query', query: 'render' } });
      expect(JSON.parse(answer.result.content[0].text)).toMatchObject({ status: { current: true }, matches: [{ id: 'render' }] });
    } finally { await bridge.close(); }
  });
});
