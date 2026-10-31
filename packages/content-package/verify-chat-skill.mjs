// Read-only test of the existing WorkspaceTools discovery, with isolated personal/project fixtures.
import { registerHooks } from 'node:module';
import { mkdir, mkdtemp, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); }
  catch (error) { if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !path.extname(specifier)) return next(specifier + '.ts', context); throw error; }
} });
const { WorkspaceTools } = await import('../agent-chat/src/host/workspace-tools.ts');
const root = path.resolve('.runtime/content-chat-qa'); await mkdir(root, { recursive: true });
const project = await mkdtemp(path.join(root, 'discovery-'));
const workspace = new WorkspaceTools(project, path.resolve('docs'), path.join(project, 'personal-skills'));
const listed = await workspace.call('syka_skills', { action: 'list' });
const entry = listed.skills.find(s => s.name === 'syka-content-package' && s.path.startsWith(path.resolve('docs')));
assert.ok(entry);
const skill = await workspace.call('syka_skills', { action: 'read', path: entry.path });
const reference = await workspace.call('syka_skills', { action: 'read', path: entry.path, file: 'references/persistence.md' });
const context = await workspace.call('syka_skills', { action: 'read', path: entry.path, file: 'references/approved-context.md' });
const script = await workspace.call('syka_skills', { action: 'read', path: entry.path, file: 'scripts/content-memory.mjs' });
assert.ok(skill.revision && reference.revision && context.revision && script.content.includes('contentMemory'));
await workspace.call('syka_files', { action: 'create', path: '.syka/request.json', content: JSON.stringify({ action: 'read' }) });
assert.deepEqual(JSON.parse(await readFile(path.join(project, '.syka/request.json'), 'utf8')), { action: 'read' });
const result = { discovery: true, skillRead: true, supportRead: true, scriptRead: true, projectRequestCreate: true, runtime: 'isolated WorkspaceTools from assigned worktree; not live Electron', skillPath: entry.path };
await writeFile(path.join(root, 'discovery.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
