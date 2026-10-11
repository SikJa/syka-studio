/* MPL-2.0. Provider-reported accounting only; no text tokenization or quota guesses. */
import type { TokenCounts } from '../protocol';

export const TOKEN_FIELDS = ['totalTokens', 'inputTokens', 'outputTokens', 'cachedInputTokens', 'cacheWriteInputTokens', 'reasoningOutputTokens'] as const;

export function tokenCounts(raw: unknown, format: 'codex' | 'agy' | 'acp'): TokenCounts | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  const keys = format === 'agy'
    ? ['total_tokens', 'input_tokens', 'output_tokens', 'cache_read_tokens', 'cache_write_tokens', 'thinking_tokens']
    : format === 'acp'
      ? ['totalTokens', 'inputTokens', 'outputTokens', 'cachedReadTokens', 'cachedWriteTokens', 'thoughtTokens']
      : TOKEN_FIELDS;
  const counts: Partial<TokenCounts> = {};
  TOKEN_FIELDS.forEach((field, index) => {
    const n = value[keys[index]!];
    if (typeof n === 'number' && Number.isSafeInteger(n) && n >= 0) counts[field] = n;
  });
  return typeof counts.totalTokens === 'number' ? counts as TokenCounts : null;
}

export function addTokens(a: TokenCounts, b: TokenCounts): TokenCounts {
  const result: TokenCounts = { ...a };
  for (const key of TOKEN_FIELDS) if (b[key] !== undefined) result[key] = (a[key] ?? 0) + b[key]!;
  return result;
}

/** Cumulative observations may repeat or arrive late. Keep a high-water mark. */
export function tokenDelta(previous: TokenCounts, next: TokenCounts): TokenCounts {
  const delta: TokenCounts = { totalTokens: 0 };
  for (const key of TOKEN_FIELDS) if (next[key] !== undefined) delta[key] = Math.max(0, next[key]! - (previous[key] ?? 0));
  return delta;
}
