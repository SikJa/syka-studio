/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { assert } from "@/utils";
import * as cfg from "./config";

import type { Marquee } from "./surface";

type MousePosition = {
  state: 'idle';
  currentX: number;
  currentY: number;
} | {
  state: 'pressed' | 'pressing' | 'lifted';
  initialX: number;
  initialY: number;
  timestamp: number;
  currentX: number;
  currentY: number;
  deltaX: number;
  deltaY: number;
}

type TransformedRegion = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  id: string;
  passthrough: boolean;
}

type HitRegions = {
  prev: Array<TransformedRegion>;
  next: Array<TransformedRegion>;
  id: string;
  index: number;
};

export type TimelinePointer = ReturnType<typeof createPointer>;

type PointerOptions = {
  marquee?: Marquee | null;
  canvas?: HTMLCanvasElement | null;
  ctx?: CanvasRenderingContext2D | null;
};

export function createPointer(options: PointerOptions) {
  let position: MousePosition | null = null;
  let pressRegionID: string | null = null;
  let hitRegions: HitRegions = {
    prev: [],
    next: [],
    id: '',
    index: 0,
  };
  let lastClickPosition: {
    x: number;
    y: number;
    timestamp: number;
  } | null = null;

  let shiftPressed = false;

  function down(event: PointerEvent) {
    const rect = options.canvas?.getBoundingClientRect();
    if (!rect || event.button !== 0) return;

    const currentX = event.clientX - rect.left;
    const currentY = event.clientY - rect.top;

    position = {
      state: 'pressed',
      timestamp: performance.now(),
      initialX: currentX,
      initialY: currentY,
      currentX,
      currentY,
      deltaX: 0,
      deltaY: 0,
    };

    shiftPressed = event.shiftKey;
  }

  function move(event: PointerEvent) {
    const rect = options.canvas?.getBoundingClientRect();
    if (!rect) return;

    shiftPressed = event.shiftKey;

    const currentX = event.clientX - rect.left;
    const currentY = event.clientY - rect.top;

    if (!position) {
      position = {
        state: 'idle',
        currentX,
        currentY,
      };
      return;
    }

    if (position.state != 'idle') {
      position.deltaX = currentX - position.initialX;
      position.deltaY = currentY - position.initialY;
    }

    position.currentX = currentX;
    position.currentY = currentY;
  }

  function up(event: PointerEvent) {
    const rect = options.canvas?.getBoundingClientRect();
    if (!rect) return;
    if (!position || position.state === 'idle') return;

    const currentX = event.clientX - rect.left;
    const currentY = event.clientY - rect.top;

    position = {
      ...position,
      state: 'lifted',
      currentX,
      currentY,
      deltaX: currentX - position.initialX,
      deltaY: currentY - position.initialY,
    };
    pressRegionID = null;
    shiftPressed = event.shiftKey;
  }


  function scope(id: string) {
    hitRegions.id = id;
    hitRegions.index = 0;

    return pointer;
  }

  function region(x = 0, y = 0, w: number, h: number, id?: string, passthrough = false) {
    assert(options.ctx, 'Canvas context must be set');

    const regionData = {
      id: `${hitRegions.id}/${id ?? hitRegions.index}`,
      ...transformRegionToCanvas(options.ctx, x, y, w, h),
      passthrough,
    };
    hitRegions.index++;
    hitRegions.next.push(regionData);

    if (!position) return {
      hovering: false,
      clicked: false,
      pressing: false,
      pressed: false,
      dragging: false,
      doubleClicked: false,
      intersectsMarquee: false,
    };

    // Mouse position is in CSS pixels, scale to device pixels to match canvas coordinates
    const mouseX = position.currentX * window.devicePixelRatio;
    const mouseY = position.currentY * window.devicePixelRatio;

    const matches = hitRegions.prev.filter(({ minX, minY, maxX, maxY }) => (
      mouseX >= minX &&
      mouseX < maxX &&
      mouseY >= minY &&
      mouseY < maxY
    ));

    const lastMatch = matches.findLast(({ passthrough }) => !passthrough);

    let isPrimary = lastMatch?.id === regionData.id;
    let isPassive = matches.some(({ passthrough, id }) => passthrough && id == regionData.id);
    let hovering = isPrimary || isPassive;
    let pressing = hovering && position?.state == 'pressing';
    let pressed = hovering && position?.state == 'pressed';

    // Track the region that was pressed down on
    if (pressed) {
      pressRegionID = lastMatch?.id ?? null;
    }

    // Assign dragging state after a distance threshold has been passed
    let dragging = false;
    if (position?.state == 'pressing' && pressRegionID == regionData.id) {
      const distance = Math.sqrt(position.deltaX ** 2 + position.deltaY ** 2);
      dragging = distance >= cfg.CLICK_DISTANCE_THRESHOLD;
    }

    // Only consider click if pointer hasn't moved beyond the distance threshold
    let clicked = false;
    if (position?.state == 'lifted') {
      const distance = Math.sqrt(position.deltaX ** 2 + position.deltaY ** 2);
      clicked = distance < cfg.CLICK_DISTANCE_THRESHOLD && hovering;
    }

    let doubleClicked = false;
    if (clicked && lastClickPosition) {
      const delta = performance.now() - lastClickPosition.timestamp;
      const distance = Math.sqrt(
        Math.pow(position.currentX - lastClickPosition.x, 2) +
        Math.pow(position.currentY - lastClickPosition.y, 2)
      );
      doubleClicked = delta < cfg.DOUBLE_CLICK_THRESHOLD && hovering && distance < 10;
    }

    let intersectsMarquee = false;
    if (options.marquee) {
      // Convert marquee selection from CSS pixels to canvas coordinates
      const marqueeMinX = options.marquee.x * window.devicePixelRatio;
      const marqueeMaxX = (options.marquee.x + options.marquee.width) * window.devicePixelRatio;
      const marqueeMinY = options.marquee.y * window.devicePixelRatio;
      const marqueeMaxY = (options.marquee.y + options.marquee.height) * window.devicePixelRatio;

      // Check intersection: regions intersect if they overlap
      intersectsMarquee = !(
        regionData.maxX < marqueeMinX ||
        regionData.minX > marqueeMaxX ||
        regionData.maxY < marqueeMinY ||
        regionData.minY > marqueeMaxY
      );
    }

    return {
      hovering, // If the pointer is over the rect
      clicked, // If the rect was clicked this frame
      pressing, // If the pointer is pressing down on the rect this frame
      pressed, // If the just started pressing down on the rect this frame
      dragging, // If the pointer is dragging the rect this frame
      doubleClicked, // If the rect was double clicked this frame
      intersectsMarquee, // If the region intersects the marquee selection
    };
  }

  function reset() {
    hitRegions.prev = [...hitRegions.next];
    hitRegions.next.length = 0;

    if (position?.state == 'lifted') {
      position = {
        ...position,
        state: 'idle',
      };
      lastClickPosition = {
        x: position.currentX,
        y: position.currentY,
        timestamp: performance.now(),
      };
    }

    if (position?.state == 'pressed') {
      position = {
        ...position,
        state: 'pressing',
      };
    }
  }

  /** Hit-test the last rendered frame without generating a click or moving the playhead. */
  function hitAt(clientX: number, clientY: number): string | null {
    const rect = options.canvas?.getBoundingClientRect();
    if (!rect) return null;
    const x = (clientX - rect.left) * window.devicePixelRatio;
    const y = (clientY - rect.top) * window.devicePixelRatio;
    return hitRegions.prev.findLast(region => !region.passthrough &&
      x >= region.minX && x < region.maxX && y >= region.minY && y < region.maxY,
    )?.id ?? null;
  }

  const pointer = {
    get position() {
      return position;
    },
    get shiftPressed() {
      return shiftPressed;
    },
    down,
    move,
    up,
    scope,
    region,
    reset,
    hitAt,
  };

  return pointer;
}

function transformRegionToCanvas(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Transform the region to canvas coordinates when storing it
  const transform = ctx.getTransform();

  // Transform all four corners of the region to canvas coordinates
  const topLeft = transform.transformPoint(new DOMPoint(x, y));
  const topRight = transform.transformPoint(new DOMPoint(x + w, y));
  const bottomLeft = transform.transformPoint(new DOMPoint(x, y + h));
  const bottomRight = transform.transformPoint(new DOMPoint(x + w, y + h));

  // Compute bounding box in canvas coordinates
  return {
    minX: Math.min(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x),
    maxX: Math.max(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x),
    minY: Math.min(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y),
    maxY: Math.max(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y),
  };
}
