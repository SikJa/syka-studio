import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname } from 'node:path';
import { isHarnessId, type HarnessId, type HarnessInfo } from '../protocol';

type CachedCatalog = Pick<HarnessInfo, 'id' | 'label' | 'models' | 'defaultModel'>;

/** Last confirmed model lists, shown while startup probes run. Never readiness, auth or account data. */
export async function loadCatalogCache(path: string): Promise<Map<HarnessId, HarnessInfo>> {
  const cached = new Map<HarnessId, HarnessInfo>();
  try {
    const value = JSON.parse(await readFile(path, 'utf8'));
    for (const entry of Array.isArray(value?.catalogs) ? value.catalogs as CachedCatalog[] : []) {
      if (!isHarnessId(entry?.id) || typeof entry.label !== 'string' || !Array.isArray(entry.models) || !entry.models.length
        || entry.models.some(model => typeof model?.id !== 'string' || typeof model.label !== 'string')) continue;
      cached.set(entry.id, { id: entry.id, label: entry.label, models: entry.models, ...(typeof entry.defaultModel === 'string' ? { defaultModel: entry.defaultModel } : {}),
        status: 'checking', catalogSource: 'cache', detail: 'Comprobando la conexión…' });
    }
  } catch { /* Missing or unreadable cache: probes still fill the list. */ }
  return cached;
}

export async function saveCatalogCache(path: string, probes: Iterable<HarnessInfo>): Promise<void> {
  const catalogs: CachedCatalog[] = [...probes].filter(info => info.models.length)
    .map(info => ({ id: info.id, label: info.label, models: info.models, ...(info.defaultModel ? { defaultModel: info.defaultModel } : {}) }));
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try { await writeFile(temporary, JSON.stringify({ version: 1, catalogs }), 'utf8'); await rename(temporary, path); }
  finally { await unlink(temporary).catch(() => {}); }
}

/** Only recognizable transport/deadline failures may preserve a display catalog. */
export function providerProbeFailure(error: unknown): HarnessInfo['probeFailure'] {
  const value = error instanceof Error ? `${error.message} ${(error as NodeJS.ErrnoException).code ?? ''}` : String(error);
  if (/auth|sign.in|login|credential|unauthorized|forbidden|\b40[13]\b/i.test(value)) return;
  if (/\b(?:ECONNRESET|ECONNREFUSED|ETIMEDOUT|EHOSTUNREACH|ENETUNREACH|EAI_AGAIN)\b|\btimeout\b|timed out|tiempo agotado/i.test(value)) return 'transient';
}

export function retainDisplayCatalog(previous: HarnessInfo | undefined, next: HarnessInfo): HarnessInfo {
  if (next.status !== 'error' || next.probeFailure !== 'transient' || next.models.length || !previous?.models.length
    || previous.id !== next.id || previous.status !== 'ready' && previous.catalogSource !== 'cache') return next;
  // Do not retain auth methods, account identity or readiness from a failed probe.
  return { ...next, models: previous.models, catalogSource: 'cache' };
}
