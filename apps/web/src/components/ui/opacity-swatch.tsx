/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import type { JSX } from "solid-js";
import { colorToHex } from "@/utils/color";

const CHECKERBOARD_SIZE = 8;

export function checkerboardStyle(checkerboardSize: number = CHECKERBOARD_SIZE): JSX.CSSProperties {
  const tileSize = Math.max(2, Math.round(checkerboardSize));
  const offset = tileSize / 2;

  return {
    "background-image":
      "linear-gradient(45deg, #666 25%, transparent 25%), linear-gradient(-45deg, #666 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #666 75%), linear-gradient(-45deg, transparent 75%, #666 75%)",
    "background-size": `${tileSize}px ${tileSize}px`,
    "background-position": `0 0, 0 ${offset}px, ${offset}px -${offset}px, -${offset}px 0px`,
  };
}

type OpacitySwatchProps = {
  color: number;
  opacity?: number;
};

export function OpacitySwatch(props: OpacitySwatchProps) {
  return (
    <div
      class="relative w-full h-full"
      style={checkerboardStyle()}
    >
      <div
        class="absolute left-0 top-0 w-1/2 bottom-0"
        style={{ "background-color": colorToHex(props.color) }}
      />
      <div
        class="absolute right-0 top-0 w-1/2 bottom-0"
        style={{ "background-color": colorToHex(props.color), opacity: props.opacity ?? 1 }}
      />
    </div>
  );
}
