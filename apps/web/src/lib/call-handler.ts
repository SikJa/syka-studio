/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// https://github.com/kobaltedev/kobalte/blob/main/packages/utils/src/assertion.ts
// https://github.com/kobaltedev/kobalte/blob/main/packages/utils/src/events.ts

import type { JSX } from "solid-js"

// Function assertions
export const isFunction = (value: unknown): value is Function =>
  typeof value === "function"

/** Call a JSX.EventHandlerUnion with the event. */
export const callHandler = <T, E extends Event>(
  event: E & { currentTarget: T; target: Element },
  handler: JSX.EventHandlerUnion<T, E> | undefined,
) => {
  if (handler) {
    if (isFunction(handler)) {
      handler(event)
    } else {
      handler[0](handler[1], event)
    }
  }

  return event.defaultPrevented
}
