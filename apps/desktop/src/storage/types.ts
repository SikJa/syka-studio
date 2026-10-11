export type StoragePolicy = {
  automatic: boolean;
  intervalMinutes: number;
  cacheDays: number;
  cacheLimitMB: number;
  orphanDays: number;
  trashDays: number;
  lowSpaceGB: number;
};
export const DEFAULT_STORAGE_POLICY: Readonly<StoragePolicy> = Object.freeze({
  automatic: true, intervalMinutes: 60, cacheDays: 30, cacheLimitMB: 2048,
  orphanDays: 1, trashDays: 7, lowSpaceGB: 5,
});
export const STORAGE_POLICY_CHOICES = {
  intervalMinutes: [15, 60, 360, 1440], cacheDays: [0, 7, 30, 90, 180],
  cacheLimitMB: [0, 256, 512, 1024, 2048, 4096], orphanDays: [1, 3, 7, 30],
  trashDays: [0, 1, 7, 30], lowSpaceGB: [0, 2, 5, 10],
} as const;
export type StoragePolicyState = { revision: number; policy: StoragePolicy };
export type CleanupCategory = 'cache' | 'temporary' | 'trash';
export type CleanupTotals = Record<CleanupCategory, { bytes: number; files: number }>;
export type StorageTrashEntry = { id: string; name: string; originalPath: string; discardedAt: number; bytes: number; files: number };
export type CleanupReport = { at: number; bytes: number; files: number; skipped: number; failures: number; automatic: boolean };
export type StorageOverview = StoragePolicyState & {
  runtime: string; availableBytes?: number; totals: CleanupTotals; eligible: CleanupTotals;
  trash: StorageTrashEntry[]; partial: boolean; lastCleanup?: CleanupReport;
};
export type StorageRequest =
  | { action: 'get' }
  | { action: 'overview' }
  | { action: 'save'; expectedRevision: number; policy: StoragePolicy }
  | { action: 'clean'; category: 'eligible' | 'cache' }
  | { action: 'restore'; id: string };
export type StorageResponse = StoragePolicyState & { overview?: StorageOverview; cleanup?: CleanupReport };

export function normalizeStoragePolicy(raw: unknown): StoragePolicy {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('La configuración de almacenamiento es inválida.');
  const value = raw as Record<string, unknown>;
  if (typeof value.automatic !== 'boolean') throw Error('Elegí si la limpieza automática está activada.');
  for (const key of Object.keys(STORAGE_POLICY_CHOICES) as (keyof typeof STORAGE_POLICY_CHOICES)[]) {
    if (typeof value[key] !== 'number' || !(STORAGE_POLICY_CHOICES[key] as readonly number[]).includes(value[key] as number)) throw Error('Revisá el plazo o límite de almacenamiento: ' + key + '.');
  }
  return Object.fromEntries(['automatic', ...Object.keys(STORAGE_POLICY_CHOICES)].map(key => [key, value[key]])) as StoragePolicy;
}
