import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ group: 'drag-1' as string | undefined, write: vi.fn(), refresh: vi.fn() }));
vi.mock('../../web/src/projects/host', () => ({ writeProject: state.write }));
vi.mock('@/engine/history', () => ({ getEditHistory: () => ({ gestureGroup: () => state.group, refresh: state.refresh }) }));
vi.mock('@/engine/editor', () => ({ getDocumentEditor: () => ({ restamp: () => {}, discardPending: () => {}, unsettle: () => {} }) }));
vi.mock('somoto', () => ({ toast: { error: vi.fn() } }));
import { createEditWriter } from '../../web/src/projects/edits';

beforeEach(() => { vi.useFakeTimers(); state.write.mockReset(); state.refresh.mockReset().mockResolvedValue(undefined); state.group = 'drag-1'; });
afterEach(() => vi.useRealTimers());

describe('writer synchronization for shared undo', () => {
  it('drain waits for the pending write before undo can restore a source snapshot', async () => {
    let complete!: (value: { skipped: string[] }) => void;
    state.write.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    const writer = createEditWriter('project', {} as any);
    writer.push({ kind: 'prop', source: 'clip', name: 'start', value: 2, previous: 1 });
    let restored = false;
    const pendingUndo = writer.drain().then(() => { restored = true; });
    await Promise.resolve();
    expect(restored).toBe(false); expect(writer.hasPendingEdits()).toBe(true);
    complete({ skipped: [] }); await pendingUndo;
    expect(restored).toBe(true); expect(writer.hasPendingEdits()).toBe(false);
    expect(state.write.mock.calls[0][2]).toBe('drag-1');
    writer.dispose();
  });
  it('keeps one gesture group across debounce writes but gives a new command its own group', async () => {
    state.write.mockResolvedValue({ skipped: [] });
    const writer = createEditWriter('project', {} as any);
    writer.push({ kind: 'prop', source: 'clip', name: 'start', value: 2, previous: 1 });
    await writer.drain();
    writer.push({ kind: 'prop', source: 'clip', name: 'start', value: 3, previous: 2 });
    await writer.drain();
    state.group = 'command-2';
    writer.push({ kind: 'prop', source: 'clip', name: 'muted', value: true, previous: false });
    await writer.drain();
    expect(state.write.mock.calls.map(call => call[2])).toEqual(['drag-1', 'drag-1', 'command-2']);
    writer.dispose();
  });
  it('refuses a shared undo when persistence failed', async () => {
    state.write.mockResolvedValue({ skipped: ['clip'], error: 'SHA changed' });
    const writer = createEditWriter('project', {} as any);
    writer.push({ kind: 'prop', source: 'clip', name: 'muted', value: true, previous: false });
    await expect(writer.drain()).rejects.toThrow('SHA changed');
    expect(writer.hasPendingEdits()).toBe(true);
    writer.dispose();
  });
  it('does not advertise view-only changes as pending semantic edits', async () => {
    state.write.mockResolvedValue({ skipped: [] });
    const writer = createEditWriter('project', {} as any);
    writer.push({ kind: 'prop', source: 'clip', name: 'selected', value: true, previous: false });
    expect(writer.hasPendingEdits()).toBe(false);
    await writer.drain(); writer.dispose();
  });
});
