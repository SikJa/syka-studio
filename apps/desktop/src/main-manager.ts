/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { ipcMain } from "electron";
import type { BrowserWindow, IpcMainEvent } from "electron";
import { MAIN_WIRE } from "./main-channels";
import type {
  MainEvent,
  MainEventChannel,
  MainEventMap,
  MainReply,
  MainRequest,
  MainRequestChannel,
  MainRequestMap,
} from "./main-channels";

type RequestHandler<C extends MainRequestChannel> = (
  data: MainRequestMap[C]["request"],
  event: IpcMainEvent,
) => MainRequestMap[C]["response"] | Promise<MainRequestMap[C]["response"]>;

class MainBridge {
  private requestHandlers = new Map<
    MainRequestChannel,
    RequestHandler<MainRequestChannel>
  >();
  private bound = false;
  private requestGuard: (event: IpcMainEvent, request: MainRequest) => boolean = () => false;

  setRequestGuard(guard: (event: IpcMainEvent, request: MainRequest) => boolean): void {
    this.requestGuard = guard;
  }

  private bind(): void {
    if (this.bound) return;
    this.bound = true;

    ipcMain.on(MAIN_WIRE.REQUEST, async (event, raw: MainRequest) => {
      if (!raw || typeof raw.id !== "string" || typeof raw.channel !== "string" || !this.requestGuard(event, raw)) return;
      const handler = this.requestHandlers.get(raw.channel);
      let reply: MainReply;
      if (!handler) {
        reply = {
          id: raw.id,
          ok: false,
          error: `No handler for request "${raw.channel}"`,
        };
      } else {
        try {
          const data = await handler(raw.data as never, event);
          reply = { id: raw.id, ok: true, data };
        } catch (err) {
          reply = { id: raw.id, ok: false, error: (err as Error).message };
        }
      }
      if (!event.sender.isDestroyed()) {
        event.sender.send(MAIN_WIRE.RESPONSE, reply);
      }
    });
  }

  handle<C extends MainRequestChannel>(
    channel: C,
    handler: RequestHandler<C>,
  ): void {
    this.bind();
    this.requestHandlers.set(channel, handler as unknown as RequestHandler<MainRequestChannel>);
  }

  emit<C extends MainEventChannel>(
    window: BrowserWindow | null,
    channel: C,
    data: MainEventMap[C],
  ): void {
    if (!window || window.isDestroyed() || window.webContents.isLoading()) return;

    const envelope: MainEvent = { channel, data };
    window.webContents.send(MAIN_WIRE.EVENT, envelope);
  }
}

export const mainBridge = new MainBridge();
