import { createHash } from 'node:crypto';
import { realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import type { NoticeReport } from '../notifications';

export const DELIVERY_TOOL = {
  type: 'function', name: 'syka_delivery',
  description: 'Publish a desktop notice for a real project delivery or a blocking issue. Never use for an ordinary final message. Ready/review require an existing project artifact. Ready also requires existing review evidence; this verifies files, not aesthetic quality or user approval. Use review while visual/audio checks remain pending. The notice opens this exact project and chat.',
  inputSchema: { type: 'object', additionalProperties: false, properties: {
    status: { type: 'string', enum: ['ready', 'review', 'blocked'] },
    message: { type: 'string', maxLength: 600 }, artifact: { type: 'string' },
    evidence: { type: 'array', maxItems: 8, items: { type: 'string' } },
  }, required: ['status', 'message'] },
};

export async function projectDelivery(cwd: string, raw: unknown): Promise<NoticeReport> {
  const args = raw as { status?: string; message?: string; artifact?: string; evidence?: string[] };
  if (!args || !['ready', 'review', 'blocked'].includes(args.status ?? '') || typeof args.message !== 'string' || !args.message.trim() || args.message.length > 600) throw Error('Entrega inválida.');
  const root = await realpath(cwd);
  const file = async (value: unknown) => {
    if (typeof value !== 'string' || !value) throw Error('Indicá un archivo existente del proyecto.');
    const path = await realpath(resolve(root, value)), rel = relative(root, path);
    if (!rel || isAbsolute(rel) || rel === '..' || rel.startsWith('..' + sep)) throw Error('La entrega debe pertenecer al proyecto.');
    const info = await stat(path);
    if (!info.isFile() || !info.size) throw Error('El archivo de entrega está vacío.');
    return { path, info };
  };
  const artifact = args.status === 'blocked' ? undefined : await file(args.artifact);
  if (args.status === 'ready') {
    if (!Array.isArray(args.evidence) || !args.evidence.length || args.evidence.length > 8) throw Error('Falta la evidencia de revisión; usá review si hay comprobaciones pendientes.');
    for (const path of args.evidence) await file(path);
  }
  // Same file revision is one delivery, even if the provider retries the tool.
  const revision = createHash('sha256').update(JSON.stringify([args.status, args.message.trim(), artifact?.path, artifact?.info.size, artifact?.info.mtimeMs])).digest('hex');
  return { kind: args.status === 'ready' ? 'complete' : args.status === 'review' ? 'review' : 'blocked', operationId: revision, message: args.message.trim(), ...(artifact ? { artifact: artifact.path } : {}) };
}
