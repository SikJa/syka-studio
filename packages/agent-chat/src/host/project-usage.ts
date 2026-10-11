/* MPL-2.0. Compact atomic ledger, independent of chat deletion and project paths. */
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { HarnessId, ProjectTokenUsage, TokenCounts, TokenUsageReport } from '../protocol';
import { addTokens, tokenCounts, tokenDelta, TOKEN_FIELDS } from './token-usage';

type Source = { tokens: TokenCounts; seen: Record<string, true>; cumulative?: boolean };
type Project = ProjectTokenUsage & { sources: Record<string, Source> };
type Ledger = { version: 1; trackedSince: number; projects: Record<string, Project> };

export class ProjectUsageStore {
  private state: Ledger = { version: 1, trackedSince: Date.now(), projects: {} };
  private queue: Promise<unknown> = Promise.resolve();
  private ready: Promise<void> | undefined;
  private readonly path: string;
  private readonly dataDir: string;
  constructor(dataDir: string) { this.dataDir = dataDir; this.path = join(dataDir, 'project-token-usage-v1.json'); }

  load(): Promise<void> {
    return this.ready ??= (async () => {
      try {
        const value = JSON.parse(await readFile(this.path, 'utf8')) as Ledger;
        if (value.version !== 1 || !value.projects || typeof value.trackedSince !== 'number') throw Error('Invalid token ledger');
        this.state = value;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    })();
  }

  async list(projectIds: string[]): Promise<ProjectTokenUsage[]> {
    await this.load(); await this.queue;
    return [...new Set(projectIds)].map(id => this.summary(id));
  }
  private summary(projectId: string): ProjectTokenUsage {
    const project = this.state.projects[JSON.stringify(projectId)];
    if (!project) return { projectId, tokens: { totalTokens: 0 }, models: [], trackedSince: this.state.trackedSince, updatedAt: 0, coverage: 'partial' };
    const { sources: _sources, ...summary } = project;
    return structuredClone(summary);
  }

  record(projectId: string, harness: HarnessId, selectedModel: string, report: TokenUsageReport): Promise<ProjectTokenUsage | null> {
    const action = this.queue.catch(() => {}).then(async () => {
      await this.load();
      const tokens = tokenCounts(report.tokens, 'codex');
      if (!tokens || !report.sessionId || !['cumulative', 'turn'].includes(report.kind) || report.kind === 'turn' && !report.measurementId) return null;
      const next = structuredClone(this.state);
      const project = next.projects[JSON.stringify(projectId)] ??= { projectId, tokens: { totalTokens: 0 }, models: [], sources: {}, trackedSince: next.trackedSince, updatedAt: 0, coverage: 'partial' };
      const sourceKey = JSON.stringify([harness, report.sessionId]);
      const source = project.sources[sourceKey] ??= { tokens: { totalTokens: 0 }, seen: {} };
      const firstCumulative = report.kind === 'cumulative' && !source.cumulative;
      const importedHistory = firstCumulative && report.historical;
      let delta: TokenCounts;
      if (report.kind === 'turn') {
        const measurementKey = JSON.stringify(report.measurementId);
        if (source.seen[measurementKey]) return null;
        source.seen[measurementKey] = true;
        delta = tokens;
      } else {
        // Ignore stale/reset snapshots as a whole, including their breakdown.
        if (tokens.totalTokens < source.tokens.totalTokens) return null;
        delta = tokenDelta(source.tokens, tokens);
      }
      if (report.kind === 'turn') source.tokens = addTokens(source.tokens, tokens);
      else for (const key of TOKEN_FIELDS) if (tokens[key] !== undefined) source.tokens[key] = Math.max(source.tokens[key] ?? 0, tokens[key]!);
      if (report.kind === 'cumulative') source.cumulative = true;
      const hasDelta = TOKEN_FIELDS.some(key => (delta[key] ?? 0) > 0);
      if (report.kind === 'cumulative' && !hasDelta && !firstCumulative) return null;
      // Imported session history has no reliable model attribution.
      const model = importedHistory ? '' : report.model ?? selectedModel;
      if (hasDelta || report.kind === 'turn' || project.models.length === 0) {
        let bucket = project.models.find(entry => entry.harness === harness && entry.model === model);
        if (!bucket) { bucket = { harness, model, tokens: { totalTokens: 0 } }; project.models.push(bucket); }
        bucket.tokens = addTokens(bucket.tokens, delta);
        project.tokens = addTokens(project.tokens, delta);
      }
      project.updatedAt = Math.max(Date.now(), project.updatedAt + 1);
      await mkdir(this.dataDir, { recursive: true });
      const tmp = `${this.path}.${randomUUID()}.tmp`;
      try {
        await writeFile(tmp, JSON.stringify(next), 'utf8');
        await rename(tmp, this.path);
      } finally {
        await unlink(tmp).catch(() => {});
      }
      this.state = next;
      return this.summary(projectId);
    });
    this.queue = action;
    return action;
  }
  async flush(): Promise<void> { await this.queue; }
}
