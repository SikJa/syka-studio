import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ call: vi.fn(), backend: null as any, error: vi.fn(), unbind: vi.fn() }));
vi.mock('@/lib/ipc', () => ({ mainBridge: { call: state.call } }));
vi.mock('@/engine/history', () => ({ getEditHistory: () => ({ bindBackend: (backend: any) => { state.backend = backend; return state.unbind; } }) }));
vi.mock('somoto', () => ({ toast: { error: state.error } }));
import { attachProjectHistory } from '../../web/src/projects/history';

const available = { ok: true, canUndo: true, canRedo: false, revision: 1 };
beforeEach(() => {
  state.call.mockReset().mockResolvedValue(available); state.error.mockReset(); state.unbind.mockReset();
  vi.stubGlobal('window', { desktop: {} });
  vi.stubGlobal('document', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
});
afterEach(() => vi.unstubAllGlobals());

describe('shared source history renderer', () => {
  it('flushes a pending manual edit, restores through IPC, then remounts before enabling editing', async () => {
    let finish!: () => void; let remount!: () => void;
    const drain = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const reload = vi.fn(() => new Promise<void>(resolve => { remount = resolve; }));
    const dispose = attachProjectHistory({} as any, 'project', { drain, pending: () => true, reload });
    await state.backend.refresh();
    state.backend.undo();
    expect(state.backend.busy()).toBe(true);
    expect(state.call.mock.calls.some(([channel]) => channel.endsWith(':undo'))).toBe(false);
    finish();
    await vi.waitFor(() => expect(reload).toHaveBeenCalledOnce());
    expect(state.call.mock.calls.some(([channel, args]) => channel.endsWith(':undo') && args.dir === 'project')).toBe(true);
    expect(state.backend.busy()).toBe(true);
    remount(); await vi.waitFor(() => expect(state.backend.busy()).toBe(false));
    dispose(); expect(state.unbind).toHaveBeenCalledOnce();
  });
  it('does not restore a project the user left while its flush was pending', async () => {
    let finish!: () => void;
    const reload = vi.fn(async () => {});
    const dispose = attachProjectHistory({} as any, 'old-project', { drain: () => new Promise<void>(resolve => { finish = resolve; }), pending: () => true, reload });
    await state.backend.refresh();
    state.backend.undo(); dispose(); finish();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(state.call.mock.calls.some(([channel]) => channel.endsWith(':undo'))).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
  it('a failed pending write blocks restore and leaves an actionable error', async () => {
    const reload = vi.fn(async () => {});
    const dispose = attachProjectHistory({} as any, 'project', { drain: async () => { throw Error('Cambió el archivo'); }, pending: () => true, reload });
    await state.backend.refresh();
    state.backend.undo(); await vi.waitFor(() => expect(state.backend.busy()).toBe(false));
    expect(state.error).toHaveBeenCalledWith('No se pudo restaurar el cambio', { description: 'Cambió el archivo' });
    expect(reload).not.toHaveBeenCalled();
    expect(state.call.mock.calls.some(([channel]) => channel.endsWith(':undo'))).toBe(false);
    dispose();
  });
  it('keeps the desktop backend authoritative on an initial conflict and reports it once', async () => {
    state.call.mockResolvedValue({ ok: false, error: 'Conflicto con una edición externa' });
    const drain = vi.fn(async () => {}); const reload = vi.fn(async () => {});
    const dispose = attachProjectHistory({} as any, 'project', { drain, pending: () => true, reload });
    await state.backend.refresh(); await state.backend.refresh();
    expect(state.backend.canUndo()).toBe(false); expect(state.backend.canRedo()).toBe(false);
    expect(state.backend.problem()).toBe('Conflicto con una edición externa');
    state.backend.undo(); state.backend.redo();
    expect(drain).not.toHaveBeenCalled(); expect(reload).not.toHaveBeenCalled();
    expect(state.error).toHaveBeenCalledOnce();
    expect(state.unbind).not.toHaveBeenCalled();
    dispose();
  });
});
