/* MPL-2.0. Local, bounded harness diagnostics. Never persist payload contents. */
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { mkdir, rename, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { HARNESS_IDS, type HarnessId, type TokenCounts, type TokenUsageReport, type TurnStatus } from '../protocol';

export type PayloadSize = { chars: number; utf8Bytes: number };
export type TraceBoundary = 'host' | 'codex_dynamic' | 'codex_native' | 'mcp_workspace' | 'claude_cli' | 'antigravity_cli' | 'acp';
export type PayloadCategory = 'instruction_source' | 'instructions' | 'history' | 'schemas' | 'user' | 'tool_arguments' | 'tool_response' | 'wire_request' | 'wire_response';
export type TraceFailure = 'quota' | 'rate_limit' | 'auth' | 'model' | 'permission' | 'tool_schema' | 'timeout' | 'transport' | 'unconfirmed' | 'other';
export type SessionReason = 'new_chat' | 'host_reopen' | 'idle' | 'transport_closed' | 'provider_reconfigured' | 'active_session';
type Payload = PayloadSize & { boundary: TraceBoundary; category: PayloadCategory };
type ToolScope = { operation?: string; readMode?: string };
type ToolTrace = ToolScope & { name: string; boundary: TraceBoundary; durationMs: number | null; status: 'done' | 'failed'; arguments: PayloadSize | null; response: PayloadSize | null; textResponse: PayloadSize | null; upstream: 'unknown' };
type NativeUsage = { kind: TokenUsageReport['kind']; tokens: TokenCounts; historical: boolean };
export type HarnessTraceRecord = {
  version: 1;
  /** New local diagnostic identifier; not a chat, project or provider identifier. */
  id: string;
  startedAt: string;
  harness: HarnessId;
  admission: 'accepted' | 'rejected';
  status: TurnStatus | null;
  preparationMs: number;
  queueWaitMs: number | null;
  session: { action: 'reuse' | 'new' | 'resume'; reason: SessionReason; durationMs: number } | null;
  instructionReuse: 'confirmed_session' | 'sent' | 'per_invocation_unverified_persistence' | null;
  timing: { readyMs: number | null; firstActivityMs: number | null; firstOutputMs: number | null; totalMs: number | null };
  payloads: Payload[];
  tools: ToolTrace[];
  toolCount: number;
  droppedPayloads: number;
  droppedTools: number;
  nativeUsage: NativeUsage[] | null;
  droppedNativeUsage: number;
  errors: TraceFailure[];
  /** These are not observable through Syka's CLI/app-server adapters. */
  unknown: readonly ['provider_internal_calls', 'provider_input_tokens_without_native_usage', 'provider_upstream_payloads', 'provider_cache_behavior'];
};

const MAX_TURNS = 100, MAX_PAYLOADS = 96, MAX_TOOLS = 128, MAX_USAGE = 32, MAX_BYTES = 2_000_000;
const context = new AsyncLocalStorage<HarnessTurnTrace>();
const sessions = new WeakMap<object, () => HarnessTurnTrace | undefined>();
const knownTools = new Set(['commandExecution', 'fileChange', 'webSearch', 'imageGeneration', 'functionCallOutput', 'permission', 'read_file', 'write_file', 'run_command', 'call_mcp_tool', 'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep']);
const boundaries = new Set<TraceBoundary>(['host', 'codex_dynamic', 'codex_native', 'mcp_workspace', 'claude_cli', 'antigravity_cli', 'acp']);
const categories = new Set<PayloadCategory>(['instruction_source', 'instructions', 'history', 'schemas', 'user', 'tool_arguments', 'tool_response', 'wire_request', 'wire_response']);
const operations = new Set(['list', 'read', 'save', 'create', 'summary', 'search', 'query', 'inspect', 'import', 'status', 'get', 'set']);
const readModes = new Set(['full', 'range', 'outline', 'search', 'section']);
function toolScope(args: unknown): ToolScope {
  if (!args || typeof args !== 'object') return {};
  const value = args as {action?:unknown;mode?:unknown};
  return { ...(typeof value.action === 'string' && operations.has(value.action) ? {operation:value.action}:{}), ...(typeof value.mode === 'string' && readModes.has(value.mode) ? {readMode:value.mode}:{}) };
}

/** Call only with source-controlled tool definitions, never with provider input. */
export function registerTraceTools(definitions: readonly { name: string }[]): void {
  for (const { name } of definitions) if (/^[a-zA-Z][a-zA-Z0-9_]{0,95}$/.test(name)) knownTools.add(name);
}
export function currentHarnessTrace(): HarnessTurnTrace | undefined { return context.getStore(); }
/** HTTP/native callbacks outlive open(); resolve the active turn at callback time. */
export function bindHarnessTrace(options: object, active: () => HarnessTurnTrace | undefined): void { sessions.set(options, active); }
export function harnessTraceFor(options: object): HarnessTurnTrace | undefined { return sessions.has(options) ? sessions.get(options)!() : currentHarnessTrace(); }

export function payloadSize(value: unknown): PayloadSize | null {
  try {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    return typeof text === 'string' ? { chars: text.length, utf8Bytes: Buffer.byteLength(text, 'utf8') } : null;
  } catch { return null; }
}
function duration(ms: number): number { return Number.isFinite(ms) ? Math.max(0, Math.round(ms)) : 0; }
function textSize(result: unknown): PayloadSize | null {
  if (!result || typeof result !== 'object') return typeof result === 'string' ? payloadSize(result) : null;
  const value = result as { content?: unknown; contentItems?: unknown };
  const parts = Array.isArray(value.content) ? value.content : Array.isArray(value.contentItems) ? value.contentItems : null;
  if (!parts) return null;
  let chars = 0, utf8Bytes = 0;
  for (const part of parts) if (part && typeof part === 'object' && typeof part.text === 'string') {
    chars += part.text.length; utf8Bytes += Buffer.byteLength(part.text, 'utf8');
  }
  return { chars, utf8Bytes };
}

/** Only a fixed category leaves this function. Raw diagnostics are never stored. */
export function traceFailure(error: unknown): TraceFailure {
  const text = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  if (/individual quota reached|quota exceeded|agot[oó] la cuota/i.test(text)) return 'quota';
  if (/RESOURCE_EXHAUSTED|\b429\b|rate.?limit|limit[oó] esta solicitud/i.test(text)) return 'rate_limit';
  if (/unauthenticated|authentication required|not logged|login required|sign.in required|invalid credentials|credenciales inv[aá]lidas|no pudo recuperar la sesi[oó]n|sesi[oó]n de Google/i.test(text)) return 'auth';
  if (/model.*(?:not found|unknown|unsupported|access)|modelo.*(?:no.*(?:cat[aá]logo|anunci|confirm|disponible)|acceso)/i.test(text)) return 'model';
  if (/permission|permis[os]|denied/i.test(text)) return 'permission';
  if (/INVALID_ARGUMENT|invalid[_ ]args|invalid arguments|invalid tool|schema|argumentos.*herramienta|unknown.*(?:tool|mcp)|conexi[oó]n MCP/i.test(text)) return 'tool_schema';
  if (/DEADLINE|timed?.?out|tiempo agotado|super[oó] el tiempo de espera|no respondi[oó] a tiempo/i.test(text)) return 'timeout';
  if (/connection|network|transport|exited|conexi[oó]n|CLI.*sali[oó]|error de ejecuci[oó]n/i.test(text)) return 'transport';
  if (/sin.*(?:confirm|respuesta|devolver)|no.*confirm/i.test(text)) return 'unconfirmed';
  return 'other';
}

export class HarnessTurnTrace {
  readonly record: HarnessTraceRecord;
  private readonly started = performance.now();
  private readonly seenUsage = new Set<string>();
  private readonly nativeTools = new Map<string, { started: number | null; name: string; boundary: TraceBoundary; args: PayloadSize | null; scope: ToolScope }>();
  private readonly finishedTools = new Set<string>();
  private finished = false;
  constructor(harness: HarnessId, preparationMs = 0, queueWaitMs: number | null = null) {
    this.record = {
      version: 1, id: randomUUID(), startedAt: new Date().toISOString(), harness: HARNESS_IDS.includes(harness) ? harness : 'codex', admission: 'accepted', status: null,
      preparationMs: duration(preparationMs), queueWaitMs: queueWaitMs === null ? null : duration(queueWaitMs), session: null, instructionReuse: null,
      timing: { readyMs: null, firstActivityMs: null, firstOutputMs: null, totalMs: null }, payloads: [], tools: [], toolCount: 0,
      droppedPayloads: 0, droppedTools: 0, nativeUsage: null, droppedNativeUsage: 0, errors: [],
      unknown: ['provider_internal_calls', 'provider_input_tokens_without_native_usage', 'provider_upstream_payloads', 'provider_cache_behavior'],
    };
  }
  run<T>(work: () => T): T { return context.run(this, work); }
  reject(): void { if (!this.finished) this.record.admission = 'rejected'; }
  payload(boundary: TraceBoundary, category: PayloadCategory, value: unknown): void {
    if (this.finished || !boundaries.has(boundary) || !categories.has(category)) return;
    const size = payloadSize(value); if (!size) return;
    if (this.record.payloads.length < MAX_PAYLOADS) this.record.payloads.push({ boundary, category, ...size }); else this.record.droppedPayloads++;
  }
  session(action: 'reuse' | 'new' | 'resume', reason: SessionReason, ms: number): void { if (!this.finished) this.record.session = { action, reason, durationMs: duration(ms) }; }
  instructions(mode: NonNullable<HarnessTraceRecord['instructionReuse']>): void { if (!this.finished) this.record.instructionReuse = mode; }
  ready(): void { if (!this.finished) this.record.timing.readyMs = duration(performance.now() - this.started); }
  activity(output = false): void {
    if (this.finished) return;
    this.record.timing.firstActivityMs ??= duration(performance.now() - this.started);
    if (output) this.record.timing.firstOutputMs ??= duration(performance.now() - this.started);
  }
  error(error: unknown): void { const kind = traceFailure(error); if (!this.finished && !this.record.errors.includes(kind)) this.record.errors.push(kind); }
  usage(report: TokenUsageReport): void {
    if (this.finished) return;
    // Native cumulative reports must never be summed as per-turn consumption.
    const tokens: TokenCounts = { totalTokens: report.tokens.totalTokens };
    for (const key of ['inputTokens', 'outputTokens', 'cachedInputTokens', 'cacheWriteInputTokens', 'reasoningOutputTokens'] as const) {
      const value = report.tokens[key]; if (Number.isSafeInteger(value) && value! >= 0) tokens[key] = value;
    }
    if (!Number.isSafeInteger(tokens.totalTokens) || tokens.totalTokens < 0) return;
    const key = JSON.stringify([report.sessionId, report.kind, report.measurementId, tokens]);
    if (this.seenUsage.has(key)) return;
    if (this.seenUsage.size < MAX_USAGE * 2) this.seenUsage.add(key);
    const reports = this.record.nativeUsage ??= [];
    if (reports.length < MAX_USAGE) reports.push({ kind: report.kind === 'cumulative' ? 'cumulative' : 'turn', tokens, historical: report.historical === true }); else this.record.droppedNativeUsage++;
  }
  tool(name: string, boundary: TraceBoundary, args: unknown): (response: unknown, failed?: boolean) => void {
    const start = performance.now(), input = payloadSize(args), scope = toolScope(args); let settled = false;
    return (response, failed = false) => {
      if (settled || this.finished) return; settled = true;
      this.addTool({ name: knownTools.has(name) ? name : 'native_tool', ...scope, boundary, durationMs: duration(performance.now() - start), status: failed ? 'failed' : 'done', arguments: input, response: payloadSize(response), textResponse: textSize(response), upstream: 'unknown' });
    };
  }
  /** Native updates may be cumulative; count the final observed result once. */
  nativeTool(key: string, name: string, boundary: TraceBoundary, status: 'running' | 'done' | 'failed', response?: unknown, args?: unknown): void {
    if (this.finished || this.finishedTools.has(key)) return;
    if (!this.nativeTools.has(key)) {
      if (this.nativeTools.size >= MAX_TOOLS) { this.record.droppedTools++; return; }
      this.nativeTools.set(key, { started: status === 'running' ? performance.now() : null, name, boundary, args: payloadSize(args), scope: toolScope(args) });
    }
    if (status === 'running') return;
    const tool = this.nativeTools.get(key)!; this.nativeTools.delete(key);
    if (this.finishedTools.size < MAX_TOOLS) this.finishedTools.add(key);
    this.addTool({ name: knownTools.has(tool.name) ? tool.name : 'native_tool', ...tool.scope, boundary: tool.boundary, durationMs: tool.started === null ? null : duration(performance.now() - tool.started), status, arguments: tool.args, response: payloadSize(response), textResponse: textSize(response), upstream: 'unknown' });
  }
  private addTool(tool: ToolTrace): void {
    this.record.toolCount++;
    if (this.record.tools.length < MAX_TOOLS) this.record.tools.push(tool); else this.record.droppedTools++;
  }
  finish(status: TurnStatus, error?: string): HarnessTraceRecord {
    if (!this.finished) {
      if (error) this.error(error);
      this.record.status = status; this.record.timing.totalMs = duration(performance.now() - this.started); this.finished = true;
      this.nativeTools.clear(); this.finishedTools.clear(); this.seenUsage.clear();
    }
    return structuredClone(this.record);
  }
}

/** Rolling local metadata, deliberately independent from transcripts and usage ledgers. */
export class HarnessTraceStore {
  readonly path: string;
  private readonly dataDir: string;
  private records: HarnessTraceRecord[] = [];
  private writing: Promise<void> = Promise.resolve();
  private dirty = false;
  private draining = false;
  constructor(dataDir: string) { this.dataDir = dataDir; this.path = join(dataDir, 'harness-trace-v1.json'); }
  begin(harness: HarnessId, preparationMs = 0, queueWaitMs: number | null = null): HarnessTurnTrace { return new HarnessTurnTrace(harness, preparationMs, queueWaitMs); }
  snapshot(): HarnessTraceRecord[] { return structuredClone(this.records); }
  save(trace: HarnessTurnTrace, status: TurnStatus, error?: string): void {
    const record = trace.finish(status, error);
    this.records = [...this.records.filter(previous => previous.id !== record.id), record].slice(-MAX_TURNS);
    let contents = this.serialize();
    while (Buffer.byteLength(contents) > MAX_BYTES && this.records.length > 1) { this.records.shift(); contents = this.serialize(); }
    // Coalesce bursts; diagnostics cannot build a per-turn disk queue or fail a turn.
    this.dirty = true;
    this.scheduleDrain();
  }
  private scheduleDrain(): void {
    if (this.draining) return;
    this.draining = true;
    this.writing = this.drain().finally(() => { this.draining = false; if (this.dirty) this.scheduleDrain(); });
  }
  private async drain(): Promise<void> {
    while (this.dirty) {
      this.dirty = false;
      const contents = this.serialize(), temporary = this.path + '.' + randomUUID() + '.tmp';
      try { await mkdir(this.dataDir, { recursive: true }); await writeFile(temporary, contents, { mode: 0o600 }); await rename(temporary, this.path); }
      catch { /* Diagnostics must not interrupt editing, including disk-full failures. */ }
      finally { await unlink(temporary).catch(() => {}); }
    }
  }
  private serialize(): string { return JSON.stringify({ version: 1, scope: 'process_local_recent_turns', accounting: 'boundary_observations_overlap_do_not_sum', units: 'utf16_chars_and_utf8_bytes_not_tokens', records: this.records }, null, 2); }
  async flush(): Promise<void> { while (this.draining || this.dirty) await this.writing; }
}
