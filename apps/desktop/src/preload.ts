/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { contextBridge, ipcRenderer, webUtils } from "electron";
import { MAIN_WIRE } from "./main-channels";
import { DAPI_WIRE } from "@diffusionstudio/dapi";

import type { IpcRendererEvent } from "electron";

// The sandboxed preload has a location, but the main-process TS project has no DOM lib.
declare const window: { readonly location: { readonly pathname: string } };

const ALLOWED_RENDERER_TO_MAIN: ReadonlySet<string> = new Set([MAIN_WIRE.REQUEST, DAPI_WIRE.REPLY, DAPI_WIRE.PREVIEW_READY]);

const ALLOWED_MAIN_TO_RENDERER: ReadonlySet<string> = new Set([
  MAIN_WIRE.RESPONSE,
  MAIN_WIRE.EVENT,
  DAPI_WIRE.CALL,
  DAPI_WIRE.CANCEL,
]);

// The review renderer imports shared modules that define UI stores at startup.
// It must use its ephemeral partition, not the editor's durable preferences IPC.
const internalPreview = window.location.pathname.endsWith('/preview-worker.html');
contextBridge.exposeInMainWorld("desktop", {
  getPathForFile,
  platform: process.platform,
  send,
  on,
  ...(!internalPreview ? { preferences: {
    getItem(key: string): string | null { return preferenceRequest({ action: 'get', key }).value ?? null; },
    setItem(key: string, value: string): void { preferenceRequest({ action: 'set', key, value }); },
    removeItem(key: string): void { preferenceRequest({ action: 'set', key, value: null }); },
  } } : {}),
});

function preferenceRequest(request: { action: string; key: string; value?: string | null }) {
  const reply = ipcRenderer.sendSync('syka:ui-preferences', request);
  if (!reply?.ok) throw Error(reply?.error ?? 'No se pudieron guardar las preferencias.');
  return reply;
}

function getPathForFile(file: File): string {
  return webUtils.getPathForFile(file);
}

function send(channel: string, payload: unknown): void {
  if (!ALLOWED_RENDERER_TO_MAIN.has(channel)) return;
  ipcRenderer.send(channel, payload);
}

function on(channel: string, cb: (payload: unknown) => void): () => void {
  if (!ALLOWED_MAIN_TO_RENDERER.has(channel)) return () => {};
  const listener = (_event: IpcRendererEvent, payload: unknown) => cb(payload);
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}
