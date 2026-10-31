/** Keep GPU/decoder pressure bounded while independent projects make progress. */
export function previewCapacity(memoryBytes: number, cpuCount: number, configured?: string): number {
  if (configured?.trim()) {
    const value = Number(configured);
    if (!Number.isInteger(value) || value < 1 || value > 4) throw Error('SYKA_PREVIEW_CONCURRENCY debe ser un entero entre 1 y 4.');
    return value;
  }
  const gib = memoryBytes / 1024 ** 3;
  const byMemory = gib >= 30 ? 4 : gib >= 14 ? 2 : 1;
  return Math.max(1, Math.min(byMemory, Math.floor(cpuCount / 2) || 1));
}
