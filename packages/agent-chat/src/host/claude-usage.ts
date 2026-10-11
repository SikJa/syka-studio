/* MPL-2.0. Claude Code's native metrics, including cache and resumed sessions. */
import { randomUUID } from 'node:crypto';
import type { TokenCounts, TokenUsageReport } from '../protocol';

const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

/** Anthropic input excludes cache reads/writes. Include each input token once. */
export function claudeTokens(raw: unknown, modelUsage = false, inputOnly = false): TokenCounts | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  const [input, output, read, write] = modelUsage
    ? [value.inputTokens, value.outputTokens, value.cacheReadInputTokens, value.cacheCreationInputTokens]
    : [value.input_tokens, value.output_tokens, value.cache_read_input_tokens, value.cache_creation_input_tokens];
  if (!integer(input) || !inputOnly && !integer(output) || read !== undefined && !integer(read) || write !== undefined && !integer(write)) return null;
  const inputTokens = input + (read as number | undefined ?? 0) + (write as number | undefined ?? 0);
  const totalTokens = inputTokens + (inputOnly ? 0 : output as number);
  if (!Number.isSafeInteger(totalTokens)) return null;
  return { totalTokens, inputTokens, ...(!inputOnly ? { outputTokens: output as number } : {}),
    ...(read !== undefined ? { cachedInputTokens: read as number } : {}),
    ...(write !== undefined ? { cacheWriteInputTokens: write as number } : {}) };
}

/** v2.1.277 started restoring modelUsage totals when `claude -p` resumes. */
export function claudeCumulativeUsage(version: string): boolean {
  const match = version.match(/(\d+)\.(\d+)\.(\d+).*Claude Code/i);
  if (!match) throw Error('El ejecutable no se identifica como Claude Code.');
  const [major, minor, patch] = match.slice(1).map(Number);
  return major! > 2 || major === 2 && (minor! > 1 || minor === 1 && patch! >= 277);
}

type Observation = { model: string; tokens: TokenCounts };

/** Buffer step input until the final result: assistant output is only a placeholder. */
export class ClaudeUsageTracker {
  private readonly callId = randomUUID();
  private readonly steps = new Map<string, Observation>();
  private readonly covered = new Set<string>();
  private aggregateCovered = false;
  private sessionId: string;
  private readonly cumulative: boolean;
  private readonly emit: (report: TokenUsageReport) => void;
  constructor(sessionId: string, cumulative: boolean, emit: (report: TokenUsageReport) => void) {
    this.sessionId = sessionId; this.cumulative = cumulative; this.emit = emit;
  }
  private source(model: string) { return JSON.stringify(['claude-cli', this.sessionId, model]); }
  observe(message: any): void {
    if ((message.type === 'result' || message.type === 'system' && message.subtype === 'init') && typeof message.session_id === 'string' && message.session_id) this.sessionId = message.session_id;
    if (message.type === 'assistant' && !message.parent_tool_use_id) {
      const { id, model, usage } = message.message ?? {};
      const tokens = claudeTokens(usage, false, true);
      if (typeof id === 'string' && id && typeof model === 'string' && tokens) this.steps.set(id, { model, tokens });
    }
    if (message.type !== 'result') return;
    const models = message.modelUsage;
    const entries = models && typeof models === 'object' && !Array.isArray(models)
      ? Object.entries(models).map(([model, raw]) => ({ model, tokens: claudeTokens(raw, true) })).filter((entry): entry is Observation => entry.tokens !== null) : [];
    // A crashed process can report zeroed totals despite having consumed input.
    const zeroedCrash = message.is_error && message.subtype === 'error_during_execution'
      && !entries.some(entry => entry.tokens.totalTokens > 0) && [...this.steps.values()].some(step => step.tokens.totalTokens > 0);
    if (zeroedCrash) return;
    if (entries.length) {
      for (const { model, tokens } of entries) {
        this.covered.add(model);
        this.emit({ sessionId: this.source(model), kind: this.cumulative ? 'cumulative' : 'turn',
          ...(!this.cumulative ? { measurementId: `${this.callId}:result:${model}` } : {}), model, tokens });
      }
      return;
    }
    const tokens = claudeTokens(message.usage);
    if (!tokens) return;
    const mainModels = new Set([...this.steps.values()].map(step => step.model));
    const model = mainModels.size === 1 ? [...mainModels][0]! : '';
    // Modern sessions must reconcile with later per-model cumulative snapshots.
    // A mixed-model aggregate cannot be attributed safely; retain step input only.
    if (this.cumulative && !model && tokens.totalTokens > 0) return;
    this.aggregateCovered = true;
    // Legacy result.usage covers this call's main loop, excluding subagents.
    this.emit({ sessionId: model ? this.source(model) : JSON.stringify(['claude-cli-main-loop', this.sessionId]), kind: 'turn', measurementId: `${this.callId}:result`, model, tokens });
  }
  finish(): void {
    if (this.aggregateCovered) return;
    for (const [id, { model, tokens }] of this.steps) if (!this.covered.has(model)) {
      this.emit({ sessionId: this.source(model), kind: 'turn', measurementId: `assistant:${id}`, model, tokens });
    }
    this.steps.clear();
  }
}
