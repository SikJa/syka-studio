import { realpath } from 'node:fs/promises';
import { isAbsolute, join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

export const MOTION_KNOWLEDGE_TOOL = {
  type: 'function', name: 'syka_motion_knowledge',
  description: 'Search the motion knowledge included with Syka: distilled typography/composition/card/continuity rules, written reference studies and attributed MIT prompt texts. Works offline without reference-video downloads, a personal research folder, a viewer or an external Node CLI. Retrieve a few relevant examples; includeText reads only their bundled source text. Previous written studies are not videos watched this turn. Use the bundled syka-motion-references design-rules.md and validate the new Diffusion piece with its own project evidence.',
  inputSchema: { type: 'object', additionalProperties: false, properties: {
    query: { type: 'string' }, id: { type: 'string' },
    kind: { type: 'string', enum: ['all', 'video', 'skill'] },
    useCase: { type: 'string', enum: ['reel', 'storyboard', 'typography', 'product-launch', 'explainer', 'captions', 'camera-3d-captions', 'ui-motion', 'brand', 'data', 'audio', 'rendering', 'general'] },
    limit: { type: 'integer', minimum: 1, maximum: 8 },
    evidence: { type: 'string', enum: ['any', 'reviewed'] },
    includeText: { type: 'boolean' }, maxChars: { type: 'integer', minimum: 3000, maximum: 60000 },
  }, required: [] },
};

export async function motionKnowledge(docsDir: string | undefined, raw: unknown): Promise<unknown> {
  if (!docsDir) throw Error('Bundled Syka knowledge is unavailable: app docs resources are not configured.');
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('Knowledge query arguments required.');
  const args = raw as Record<string, unknown>;
  const allowed = new Set(['query', 'id', 'kind', 'useCase', 'limit', 'evidence', 'includeText', 'maxChars']);
  if (Object.keys(args).some(key => !allowed.has(key))) throw Error('Only bundled knowledge query options are accepted.');
  if (args.includeText !== undefined && typeof args.includeText !== 'boolean') throw Error('includeText must be boolean.');
  if (args.query !== undefined && typeof args.query !== 'string') throw Error('query must be text.');
  if (args.id !== undefined && typeof args.id !== 'string') throw Error('id must be text.');
  if (args.useCase !== undefined && typeof args.useCase !== 'string') throw Error('useCase must be text.');
  if (args.evidence !== undefined && !['any', 'reviewed'].includes(String(args.evidence))) throw Error('Use written-study evidence or any.');
  const root = await realpath(docsDir);
  const script = await realpath(join(root, 'skills/syka-motion-references/scripts/library.mjs'));
  const path = relative(root, script);
  if (isAbsolute(path) || path === '..' || path.startsWith('..' + sep)) throw Error('Knowledge script escapes app resources.');
  // Runs inside the app host's Node runtime. No shell, CLI or network process.
  const module = await import(pathToFileURL(script).href) as { retrieveLibrary: (options: Record<string, unknown>) => Promise<unknown> };
  return module.retrieveLibrary(args);
}
