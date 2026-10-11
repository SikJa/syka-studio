export type ToolManifest = { id: string; names: string[]; version: string; format: string; url: string; sha256: string; prefix: string; files: string[]; license: string };
export const windowsTools: readonly ToolManifest[];
export function childPath(root: string, part: string): string;
export function validateTool(tool: ToolManifest): void;
export function toolComplete(root: string, tool: ToolManifest): Promise<boolean>;
export function downloadVerified(tool: ToolManifest, output: string, fetcher?: typeof fetch, progress?: (received: number, size: number) => void): Promise<void>;
export function installTool(root: string, tool: ToolManifest, options?: { fetcher?: typeof fetch; progress?: (received: number, size: number) => void; extractor?: (path: string, options: { dir: string }) => Promise<void> }): Promise<void>;
