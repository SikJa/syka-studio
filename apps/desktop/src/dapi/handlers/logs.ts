/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { LOG_MESSAGE_MAX, LOG_TAIL } from "@diffusionstudio/dapi";

import type { LogEntry, LogLevel } from "@diffusionstudio/dapi";
import type { MainHandler } from "../handler";

const LEVEL_RANK: Record<LogLevel, number> = { debug: 0, info: 1, warning: 2, error: 3 };

export const logs: MainHandler<"logs"> = async ({ tail = LOG_TAIL, level, since, contains }, ctx) => {
  const min = level === undefined ? 0 : LEVEL_RANK[level];
  const needle = contains?.toLowerCase();
  const entries = ctx
    .logs()
    .filter(
      (e) =>
        LEVEL_RANK[e.level] >= min &&
        (since === undefined || e.ts > since) &&
        (needle === undefined || e.message.toLowerCase().includes(needle)),
    );
  return { entries: entries.slice(-tail).map(clip) };
};

function clip(entry: LogEntry): LogEntry {
  const over = entry.message.length - LOG_MESSAGE_MAX;
  return over > 0 ? { ...entry, message: `${entry.message.slice(0, LOG_MESSAGE_MAX)}… (${over} more chars)` } : entry;
}

/** One log entry as a line: local time, level, message, source. */
export function formatLogEntry(entry: LogEntry): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  const d = new Date(entry.ts);
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
  const source = entry.source ? `  (${entry.source})` : "";
  return `${time} [${entry.level}] ${entry.message}${source}`;
}
