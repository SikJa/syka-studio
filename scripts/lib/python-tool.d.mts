import type { ExecFileOptions } from 'node:child_process';
import type { ToolManifest } from './toolchain.mjs';
export function pythonToolPath(toolsRoot: string): string;
export function ensurePythonTool(toolsRoot: string, options?: {
  execute?: (path: string, args: string[], options: ExecFileOptions) => Promise<unknown>;
  installTool?: (root: string, tool: ToolManifest) => Promise<unknown>;
}): Promise<string>;
