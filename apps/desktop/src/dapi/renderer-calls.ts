/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { randomUUID } from "node:crypto";
import { app, BrowserWindow, ipcMain } from "electron";
import { DAPI_WIRE, DapiError } from "@diffusionstudio/dapi";

import type { DapiCall, DapiCancel, DapiReply, DapiProjectTarget } from "@diffusionstudio/dapi";
import type { IpcMainEvent } from 'electron';

type InFlight = {
  contentsId: number;
  resolve(data: unknown): void;
  reject(error: Error): void;
};

/**
 * Runs renderer tools from main: one `dapi:call` per request, answered by
 * `dapi:reply`, or `dapi:cancel` if the caller gives up. Calls wait for the
 * current window to finish loading; a window that reloads or dies fails the
 * calls it was answering.
 */
export class RendererCalls {
  private readonly inFlight = new Map<string, InFlight>();
  private window: BrowserWindow | null = null;
  private readonly tracked = new WeakSet<BrowserWindow>();
  private readonly editorWindow?: () => BrowserWindow | null;
  constructor(editorWindow?: () => BrowserWindow | null) { this.editorWindow = editorWindow; }
  isBusy(): boolean { return this.inFlight.size > 0; }

  private readonly reply = (event: IpcMainEvent, reply: DapiReply) => {
    if (!reply || typeof reply.id !== 'string') return;
    const call = this.inFlight.get(reply.id);
    if (!call || call.contentsId !== event.sender.id || event.senderFrame !== event.sender.mainFrame) return;
    this.inFlight.delete(reply.id);
    if (reply.ok) call.resolve(reply.data);
    else call.reject(reply.error.code ? new DapiError(reply.error.code, reply.error.message) : new Error(reply.error.message));
  };
  private readonly created = (_event: unknown, window: BrowserWindow) => this.track(window);

  start(): void {
    ipcMain.on(DAPI_WIRE.REPLY, this.reply);
    // The app supplies its editor explicitly. An internal worker, notice or
    // detached chat window must never become the unscoped tool destination.
    if (!this.editorWindow) {
      app.on('browser-window-created', this.created);
      const windows = BrowserWindow.getAllWindows();
      if (windows.length > 0) this.track(windows[windows.length - 1]!);
    }
  }

  async call(tool: string, args: unknown, signal: AbortSignal): Promise<unknown> {
    const window = this.editorWindow?.() ?? this.window;
    if (!window) throw new Error('The app has no window');
    return this.callIn(window, tool, args, signal);
  }

  async callIn(window: BrowserWindow, tool: string, args: unknown, signal: AbortSignal, project?: DapiProjectTarget, handlersReady = false): Promise<unknown> {
    if (signal.aborted) throw new DapiError('canceled', 'The call was canceled.');
    this.observe(window);
    if (!handlersReady) await this.ready(window, signal);
    if (signal.aborted) throw new DapiError('canceled', 'The call was canceled.');
    const id = randomUUID();
    return new Promise((resolve, reject) => {
      const onAbort = () => {
        this.inFlight.delete(id);
        if (!window.isDestroyed()) window.webContents.send(DAPI_WIRE.CANCEL, { id } satisfies DapiCancel);
        reject(new DapiError("canceled", "The call was canceled."));
      };
      signal.addEventListener("abort", onAbort, { once: true });
      this.inFlight.set(id, {
        contentsId: window.webContents.id,
        resolve: (data) => {
          signal.removeEventListener("abort", onAbort);
          resolve(data);
        },
        reject: (error) => {
          signal.removeEventListener("abort", onAbort);
          reject(error);
        },
      });
      try { window.webContents.send(DAPI_WIRE.CALL, { id, tool, args, ...(project ? { project } : {}) } satisfies DapiCall); }
      catch (error) { this.inFlight.get(id)?.reject(error as Error); this.inFlight.delete(id); }
    });
  }

  stop(): void {
    ipcMain.off(DAPI_WIRE.REPLY, this.reply);
    app.off('browser-window-created', this.created);
    for (const call of this.inFlight.values()) call.reject(new DapiError('canceled', 'The app stopped.'));
    this.inFlight.clear();
  }

  private track(window: BrowserWindow): void {
    this.window = window;
    this.observe(window);
  }

  private observe(window: BrowserWindow): void {
    if (this.tracked.has(window)) return;
    this.tracked.add(window);
    const contentsId = window.webContents.id;
    const fail = (why: string) => () => this.failFor(contentsId, why);
    window.webContents.on("did-start-loading", fail("The app reloaded before replying"));
    window.webContents.on("render-process-gone", fail("The app's renderer crashed"));
    window.on("closed", () => {
      if (this.window === window) this.window = null;
      this.failFor(contentsId, "The app window closed before replying");
    });
  }

  private failFor(contentsId: number, message: string): void {
    for (const [id, call] of this.inFlight) {
      if (call.contentsId !== contentsId) continue;
      this.inFlight.delete(id);
      call.reject(new Error(message));
    }
  }

  // Resolves with the current window once it has finished loading.
  private ready(window: BrowserWindow, signal: AbortSignal, timeoutMs = 30000): Promise<BrowserWindow> {
    if (!window || window.isDestroyed()) return Promise.reject(new Error("The app has no window"));
    if (window.webContents.isCrashed()) return Promise.reject(new Error("The app's renderer crashed"));
    if (!window.webContents.isLoading()) return Promise.resolve(window);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("The app did not become ready in time"));
      }, timeoutMs);
      const cleanup = () => {
        clearTimeout(timer);
        window.webContents.off("did-finish-load", onLoad);
        window.webContents.off("did-fail-load", onFail);
        window.off('closed', onFail);
        signal.removeEventListener('abort', onAbort);
      };
      const onLoad = () => {
        cleanup();
        resolve(window);
      };
      const onFail = () => {
        cleanup();
        reject(new Error("The app failed to load"));
      };
      const onAbort = () => { cleanup(); reject(new DapiError('canceled', 'The call was canceled.')); };
      window.webContents.on("did-finish-load", onLoad);
      window.webContents.on("did-fail-load", onFail);
      window.once('closed', onFail);
      signal.addEventListener('abort', onAbort, { once: true });
    });
  }
}
