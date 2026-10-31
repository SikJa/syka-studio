import type { ToolManifest } from './toolchain.mjs';
export const GRAPHIFY_VERSION: string;
export const GRAPHIFY_UV: Readonly<ToolManifest>;
export function ensureGraphifyRuntime(root: string, log?: (message: string) => void): Promise<string>;
