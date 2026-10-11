/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { createEffect, createMemo, createSignal, onCleanup, type Accessor } from "solid-js";

type TruncatedName = {
  shouldTruncate: boolean;
  start: string;
  end: string;
};

type ExpandableFileName = {
  showFullName: Accessor<boolean>;
  truncatedName: Accessor<TruncatedName>;
  closeFullName: () => void;
  toggleFullName: () => void;
  showCompleteName: () => void;
  setContainerRef: (node: HTMLDivElement | undefined) => void;
};

export function createExpandableFileName(name: Accessor<string>): ExpandableFileName {
  const [showFullName, setShowFullName] = createSignal(false);
  let containerRef: HTMLDivElement | undefined;

  const truncatedName = createMemo<TruncatedName>(() => {
    const value = name();
    const startLength = 24;
    const endLength = 9;
    const dotIndex = value.lastIndexOf(".");
    const hasExt = dotIndex > 0 && dotIndex < value.length - 1;
    const base = hasExt ? value.slice(0, dotIndex) : value;
    const ext = hasExt ? value.slice(dotIndex) : "";
    const endBaseLength = Math.max(0, endLength - ext.length);
    const shouldTruncate = base.length > startLength + endBaseLength;
    const start = base.slice(0, startLength);
    const endBase = endBaseLength > 0 ? base.slice(-endBaseLength) : "";
    const end = ext ? `${endBase}${ext}` : endBase;

    return { shouldTruncate, start, end };
  });

  const closeFullName = () => setShowFullName(false);
  const showCompleteName = () => setShowFullName(true);

  const toggleFullName = () => {
    if (!truncatedName().shouldTruncate) return;
    setShowFullName((prev) => !prev);
  };

  const setContainerRef = (node: HTMLDivElement | undefined) => {
    containerRef = node;
  };

  createEffect(() => {
    if (!showFullName()) return;
    if (typeof document === "undefined") return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && containerRef?.contains(target)) return;
      closeFullName();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    onCleanup(() => {
      document.removeEventListener("pointerdown", handlePointerDown);
    });
  });

  return {
    showFullName,
    truncatedName,
    closeFullName,
    toggleFullName,
    showCompleteName,
    setContainerRef,
  };
}
