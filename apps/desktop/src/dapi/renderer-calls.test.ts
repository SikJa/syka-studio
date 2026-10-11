import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { ipcMain } from 'electron';
import { DAPI_WIRE } from '@diffusionstudio/dapi';
import { RendererCalls } from './renderer-calls';
import type { BrowserWindow } from 'electron';

vi.mock('electron', async () => {
  const { EventEmitter } = await import('node:events');
  return { ipcMain: new EventEmitter(), app: new EventEmitter(), BrowserWindow: { getAllWindows: () => [] } };
});
function window(id: number, loading = false) {
  const webContents = Object.assign(new EventEmitter(), { id, mainFrame: {}, isCrashed: () => false,
    isLoading: () => loading, send: vi.fn() });
  return Object.assign(new EventEmitter(), { webContents, isDestroyed: () => false }) as unknown as BrowserWindow;
}
function answer(w: BrowserWindow, id: string, data: unknown) {
  ipcMain.emit(DAPI_WIRE.REPLY, { sender: w.webContents, senderFrame: w.webContents.mainFrame }, { id, ok: true, data });
}

describe('renderer ownership', () => {
  it('keeps UI and internal worker replies separate and rejects other senders', async () => {
    const editor = window(1), worker = window(2), alien = window(3);
    const calls = new RendererCalls(() => editor); calls.start();
    const ui = calls.call('context', {}, new AbortController().signal);
    const preview = calls.callIn(worker, 'check', {}, new AbortController().signal, { id: 'p', dir: process.cwd() });
    await vi.waitFor(() => expect(worker.webContents.send).toHaveBeenCalled());
    const workerId = vi.mocked(worker.webContents.send).mock.calls[0]![1].id;
    const editorId = vi.mocked(editor.webContents.send).mock.calls[0]![1].id;
    answer(alien, workerId, 'wrong');
    answer(editor, workerId, 'also-wrong');
    answer(worker, workerId, 'worker-result');
    answer(editor, editorId, 'editor-result');
    expect(await preview).toBe('worker-result'); expect(await ui).toBe('editor-result');
    calls.stop();
  });
  it('a worker crash fails only its own call while the visible editor remains usable', async () => {
    const editor = window(4), worker = window(5), calls = new RendererCalls(() => editor); calls.start();
    const ui = calls.call('context', {}, new AbortController().signal);
    const preview = calls.callIn(worker, 'capture', {}, new AbortController().signal);
    const failed = expect(preview).rejects.toThrow('crashed');
    await vi.waitFor(() => expect(worker.webContents.send).toHaveBeenCalled());
    worker.webContents.emit('render-process-gone'); await failed;
    answer(editor, vi.mocked(editor.webContents.send).mock.calls[0]![1].id, 'still-open');
    expect(await ui).toBe('still-open'); calls.stop();
  });
  it('canceling during bootstrap removes load listeners and sends no tool to the renderer', async () => {
    const worker = window(6, true), calls = new RendererCalls(() => worker); calls.start();
    const controller = new AbortController();
    const pending = calls.call('context', {}, controller.signal);
    const failed = expect(pending).rejects.toMatchObject({ code: 'canceled' });
    controller.abort(); await failed;
    expect(worker.webContents.send).not.toHaveBeenCalled();
    expect(worker.webContents.listenerCount('did-finish-load')).toBe(0);
    calls.stop();
  });
});
