/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { createSignal } from "solid-js";

type Point = { x: number; y: number };

type ClientPointEvent = {
  clientX: number;
  clientY: number;
};

export function useClickPosition() {
  const [position, setPosition] = createSignal<Point | undefined>();

  const setFromEvent = (event: ClientPointEvent) => {
    setPosition({ x: event.clientX, y: event.clientY });
  };

  return {
    position,
    setFromEvent,
  };
}

