# Token accounting across active providers

Implemented on 2026-10-11. Extends the persistent project ledger from PROJECT_TOKEN_USAGE_QA_2026-10-11.md.

- Claude Code native `--print --output-format stream-json` now emits usage reports to the same project ledger. No Agent SDK, extra API key, account change or model request is needed for instrumentation.
- Native `result.modelUsage` supplies actual model attribution, including nested-agent consumption. It takes precedence over main-loop `result.usage` so their overlapping counts are not added twice.
- Cache reads and writes are disjoint from Anthropic input tokens: normalized input and total include each once. The cache fields remain breakdowns.
- Claude Code >= 2.1.277 restores per-model totals on resume; older versions return per-call totals. Passive version detection selects cumulative reconciliation or per-call addition. Installed Syka binary reports `2.1.289 (Claude Code)`.
- Duplicate assistant API response IDs are deduplicated. If execution crashes without reliable final totals, only native main-loop input/cache counts are recovered. Assistant output placeholders are excluded. Later cumulative results reconcile that partial consumption. Native session resets have separate identities.
- A legacy result with one known model reconciles against later per-model totals. A modern mixed-model aggregate without `modelUsage` retains recoverable input only, rather than attributing an ambiguous aggregate that could later be counted twice.
- Codex and Antigravity/Gemini remain on their existing native metric adapters. Hermes, Cursor, Grok and OpenCode use ACP `session/prompt` response usage. `usage_update.used`, context-window size and USD cost are not token-consumption totals.
- Missing metrics remain unknown. Unsupported/non-reporting connections cannot supply exact counters merely because their provider name is recognized.
- Muse is absent from the active host catalog and cannot be newly configured. Historical protocol IDs, chats, ledger rows and configuration remain readable. Other configured routes are retained.

## Validation

95 unique tests passed across 10 test files: provider subprocesses, Claude usage contract, persistent ledger, WebSocket end-to-end, external harness configuration, Codex transport, Antigravity CLI, OpenCode, installed agents, store and reducer. The initial combined run passed 94; the final Claude-only rerun passed all 14 tests after adding the zero/mixed-model regression. Tests use local fake providers, not paid model calls. They verify multi-model attribution, old/new resume semantics, cache arithmetic, crash recovery, errors/zeros/reset IDs, context-only updates, the four ACP route identities and Muse retirement.

Agent-chat and web TypeScript checks passed. Desktop agent-host bundle built successfully. Native Claude CLI version was checked passively. Real paid turns for Claude/Cursor/Grok/OpenCode were not executed. The installed Hermes adapter source was inspected: it emits `PromptResponse.usage` with native input/output/total/cache/reasoning counters.

Activation: the chat utility was restarted after verifying that all persisted chat states were idle, preserving the main editor process (33620). The replacement host opened a new loopback listener. Graphify refreshed automatically and resolves `ClaudeUsageTracker` in the new source file (2087-node graph); no API analysis was run.

## Contract sources

- [Anthropic: tracking costs and usage](https://platform.claude.com/docs/en/agent-sdk/cost-tracking): resume cutoff, nested-agent totals, assistant output placeholders, crash recovery.
- [Anthropic: prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching): separate input, cache creation and cache read buckets.
- [ACP prompt turn](https://agentclientprotocol.com/protocol/v1/prompt-turn): response consumption versus context/cost notifications.
- [OpenCode ACP usage implementation](https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/acp/usage.ts).
