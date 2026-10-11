/* MPL-2.0. Passive recovery: only cursor-linked native sessions, never provider calls. */
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { join, relative, resolve, isAbsolute } from 'node:path';
import { createInterface } from 'node:readline';
import { DatabaseSync } from 'node:sqlite';
import type { ChatMeta, ChatStore } from './store';
import { sameProjectFolder } from './project-folder';
import { tokenCounts } from './token-usage';
import type { TokenCounts } from '../protocol';

type Session = { id: string; rollout_path: string; cwd: string; parent?: string };
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const folder = (value: string) => value.replace(/^\\\\\?\\/, '');
const within = (root: string, path: string) => {
  const rel = relative(root, path);
  return !!rel && !rel.startsWith('..') && !isAbsolute(rel);
};

/** Cached by file identity, serialized across simultaneous dashboard queries.
 * SQLite queries are scoped to persisted cursors and verified spawn edges.
 * No auth/config files, unrelated rollouts, archived projects or disk scans.
 */
export class NativeUsageRecovery {
  private queue: Promise<unknown> = Promise.resolve();
  private readonly fingerprints = new Map<string, string>();
  private readonly runtimeDir: string;
  private readonly store: ChatStore;
  private readonly log: (message: string) => void;
  constructor(runtimeDir: string, store: ChatStore, log: (message: string) => void = () => {}) {
    this.runtimeDir = runtimeDir; this.store = store; this.log = log;
  }

  recover(projectIds: string[]): Promise<void> {
    const next = this.queue.catch(() => {}).then(() => this.run(new Set(projectIds)));
    this.queue = next;
    return next;
  }

  private async run(ids: Set<string>): Promise<void> {
    const metas = await this.store.list();
    const selected = metas.filter(m => ids.has(m.projectId) && m.resume && 'codex' in m.resume);
    if (!selected.length) return;
    let db: DatabaseSync;
    try { db = new DatabaseSync(join(this.runtimeDir, 'isolated-state', 'state_5.sqlite'), { readOnly: true }); }
    catch { return; } // Native index absent/unsupported: unknown, never zero.
    try {
      const root = await realpath(join(this.runtimeDir, 'profile'));
      const get = db.prepare('SELECT id, rollout_path, cwd FROM threads WHERE id = ?');
      const children = db.prepare('SELECT child_thread_id FROM thread_spawn_edges WHERE parent_thread_id = ? LIMIT 128');
      const visited = new Set<string>();
      let budget = 1024 * 1024 * 1024;
      let examined = 0;
      for (const meta of selected) {
        const cursor = meta.resume && 'codex' in meta.resume ? meta.resume.codex.threadId : '';
        if (!uuid.test(cursor)) continue;
        // A session claimed by distinct stable projects is ambiguous; do not guess.
        const owners = metas.filter(m => m.resume && 'codex' in m.resume && m.resume.codex.threadId === cursor);
        if (owners.some(m => m.projectId !== meta.projectId || !sameProjectFolder(folder(m.cwd), folder(meta.cwd)))) continue;
        const pending: { id: string; parent?: string }[] = [{ id: cursor }];
        for (let count = 0; pending.length && count < 128 && examined < 512; count++, examined++) {
          const link = pending.shift()!;
          if (!uuid.test(link.id) || visited.has(link.id)) continue;
          const row = get.get(link.id) as Session | undefined;
          if (!row || !sameProjectFolder(folder(row.cwd), folder(meta.cwd))) continue;
          // A descendant directly owned by another project cannot be imported here.
          if (metas.some(m => m.projectId !== meta.projectId && m.resume && 'codex' in m.resume && m.resume.codex.threadId === link.id)) continue;
          let path: string;
          try { path = await realpath(resolve(row.rollout_path)); } catch { continue; }
          if (!within(root, path) || !/\.jsonl$/i.test(path)
            || !['sessions', 'archived_sessions'].some(dir => within(join(root, dir), path))) continue;
          const info = await stat(path);
          if (!info.isFile() || info.size > 256 * 1024 * 1024) continue;
          const key = JSON.stringify([meta.projectId, row.id, path]);
          const fingerprint = `${info.size}:${info.mtimeMs}`;
          let verified = this.fingerprints.get(key) === fingerprint;
          if (!verified && info.size <= budget) {
            budget -= info.size;
            const result = await this.read(path, { ...row, parent: link.parent }, meta);
            verified = result.verified;
            if (verified) {
              if (result.tokens) await this.store.usage.record(meta.projectId, 'codex', '', {
                sessionId: row.id, kind: 'cumulative', historical: true, model: '', tokens: result.tokens,
              });
              // Complete reads only. A truncated last line remains retryable when size changes.
              this.fingerprints.set(key, fingerprint);
            }
          }
          if (!verified) continue;
          visited.add(row.id);
          for (const child of children.all(row.id) as { child_thread_id: string }[]) {
            if (pending.length < 128) pending.push({ id: child.child_thread_id, parent: row.id });
          }
        }
      }
    } catch (error) { this.log(`passive token recovery unavailable: ${(error as Error).name}`); }
    finally { db.close(); }
  }

  private async read(path: string, session: Session, meta: ChatMeta): Promise<{ verified: boolean; tokens?: TokenCounts }> {
    const input = createReadStream(path, { encoding: 'utf8' });
    const lines = createInterface({ input, crlfDelay: Infinity });
    let verified = false;
    let tokens: TokenCounts | undefined;
    try {
      for await (const line of lines) {
        // Avoid parsing prompts, responses, tools or credentials embedded in prose.
        if (!line.includes('"session_meta"') && !line.includes('"token_count"')) continue;
        let event: any;
        try { event = JSON.parse(line); } catch { continue; }
        if (event.type === 'session_meta') {
          const value = event.payload;
          const parent = value?.source?.subagent?.thread_spawn?.parent_thread_id;
          verified = value?.id === session.id && typeof value.cwd === 'string'
            && sameProjectFolder(folder(value.cwd), folder(meta.cwd))
            && !value.forked_from_id // Copied parent history needs a native fork baseline.
            && (session.parent ? parent === session.parent : true);
          if (!verified) return { verified: false };
        }
        if (verified && event.type === 'event_msg' && event.payload?.type === 'token_count') {
          const raw = event.payload.info?.total_token_usage;
          if (!raw) continue;
          const value = tokenCounts({ totalTokens: raw.total_tokens, inputTokens: raw.input_tokens,
            outputTokens: raw.output_tokens, cachedInputTokens: raw.cached_input_tokens,
            cacheWriteInputTokens: raw.cache_write_input_tokens, reasoningOutputTokens: raw.reasoning_output_tokens }, 'codex');
          if (value && (!tokens || value.totalTokens >= tokens.totalTokens)) tokens = value;
        }
      }
      return { verified, tokens };
    } finally { lines.close(); input.destroy(); }
  }
}
