import type { McpConfig } from './harness';

/** Project identity travels with the connection, never in model-selected tool arguments. */
export function bindProjectMcp(mcp: McpConfig | null, id: string, dir: string): McpConfig | null {
  if (!mcp) return null;
  const url = new URL(mcp.url);
  url.searchParams.set('projectId', id);
  url.searchParams.set('projectDir', dir);
  return { ...mcp, url: url.href };
}

export const PROJECT_PREVIEW_INSTRUCTIONS = `Editor tools in this chat are bound to this project's identity and folder. Context/check/capture use a single internal preview worker with a fair queue; they do not require this project to be visible. Never ask the user to reopen or switch projects for a review. Wait for queued tools. If a review reports a changed source revision, finish saving the edit and retry it; a failed review must not be reported as passed. If the queue is full or a wait expires, retry after queued work drains without asking the user to switch projects. Inspect representative times at scene milestones and on completion rather than capturing every small source edit. Other projects can edit while reviews wait. Prefer short bounded media segments: long media jobs retain their existing timeout budget but also occupy the single worker until completion. Export remains manual.`;
