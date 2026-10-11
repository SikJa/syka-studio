/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { createSignal, onCleanup } from "solid-js";

type Point = { x: number; y: number };

export type UseDragOptions = {
  onDragStart?: (pos: Point, e: PointerEvent) => void;
  onDragMove?: (pos: Point, e: PointerEvent) => void;
  onDragEnd?: (pos: Point, e: PointerEvent) => void;
  disabled?: () => boolean;
};

export function useDrag(options: UseDragOptions = {}) {
  const [isDragging, setIsDragging] = createSignal(false);
  let activePointerId: number | null = null;

  const getPointerPos = (e: PointerEvent): Point => ({ x: e.clientX, y: e.clientY });

  const removeGlobalListeners = () => {
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
    window.removeEventListener("pointercancel", handlePointerUp);
    document.body.classList.remove("select-none");
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (activePointerId !== null && e.pointerId !== activePointerId) return;
    options.onDragMove?.(getPointerPos(e), e);
  };

  const handlePointerUp = (e: PointerEvent) => {
    if (activePointerId !== null && e.pointerId !== activePointerId) return;
    activePointerId = null;
    setIsDragging(false);
    removeGlobalListeners();
    options.onDragEnd?.(getPointerPos(e), e);
  };

  const onPointerDown = (e: PointerEvent) => {
    if (options.disabled?.()) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement | null)?.setPointerCapture?.(e.pointerId);
    activePointerId = e.pointerId;
    setIsDragging(true);
    document.body.classList.add("select-none");
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    options.onDragStart?.(getPointerPos(e), e);
  };

  onCleanup(removeGlobalListeners);

  return {
    isDragging,
    onPointerDown,
  };
}
