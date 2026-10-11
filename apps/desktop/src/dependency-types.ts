import type { LocalToolStatus } from '../../../packages/agent-chat/src/host/local-tools';
export type DependencyProgress = { phase: 'idle' | 'installing' | 'ready' | 'error'; tool?: string; percent?: number; message?: string };
export type DependencyStatus = { tools: LocalToolStatus[]; runtime: string; packaged: boolean; setup: DependencyProgress };
