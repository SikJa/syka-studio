/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import type { JSX } from 'solid-js';
import { splitProps, onCleanup, onMount } from 'solid-js';
import { cx } from '@/lib/cva';

type ControlScrollAreaProps = JSX.IntrinsicElements['div'] & {
  /**
   * Remembers the scroll offset under this key and restores it the next time an
   * area with the same key mounts.
   */
  scrollKey?: string;
};

// The consumer remounts on every selection change, so offsets have to outlive
// the component. Bounded because keys are per selection and never reused.
const MAX_REMEMBERED_OFFSETS = 100;
const offsets = new Map<string, number>();

// Anything that means the user took over scrolling themselves.
const INTERRUPT_EVENTS = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;

// scrollTop is fractional at non-integer zoom, so the bottom edge needs slack.
const EDGE_TOLERANCE = 1;

function rememberOffset(key: string, top: number) {
  // Re-insert to keep the map ordered by recency, so eviction drops the oldest.
  offsets.delete(key);
  offsets.set(key, top);

  if (offsets.size > MAX_REMEMBERED_OFFSETS) {
    const oldest = offsets.keys().next();
    if (!oldest.done) offsets.delete(oldest.value);
  }
}

export function ControlScrollArea(props: ControlScrollAreaProps) {
  const [local, others] = splitProps(props, ['class', 'children', 'scrollKey']);
  let scrollEl: HTMLDivElement | undefined;
  let contentEl: HTMLDivElement | undefined;
  let borderEl: HTMLDivElement | undefined;
  let observer: ResizeObserver | undefined;

  // Set while the remembered offset is being re-applied. Panels that render
  // asynchronously are shorter than their final height, so scrollTop clamps;
  // without this the clamped value would overwrite the offset we're restoring.
  let restoring = false;
  let restoreTarget = 0;
  let stopRestore = () => { };

  // Set while the area sits at its bottom edge, so growing content is followed
  // instead of pushing the end out of view.
  let pinnedToBottom = false;

  const maxScrollTop = () => (scrollEl ? scrollEl.scrollHeight - scrollEl.clientHeight : 0);

  const isAtBottom = () => {
    const max = maxScrollTop();
    return scrollEl != null && max > 0 && max - scrollEl.scrollTop <= EDGE_TOLERANCE;
  };

  const updateBorder = () => {
    if (!scrollEl || !borderEl) return;
    borderEl.classList.toggle('hidden', scrollEl.scrollTop <= 0);
  };

  const onScroll = () => {
    updateBorder();
    if (restoring || !scrollEl) return;
    pinnedToBottom = isAtBottom();
    if (local.scrollKey != null) rememberOffset(local.scrollKey, scrollEl.scrollTop);
  };

  const applyRestore = () => {
    if (!scrollEl) return;
    scrollEl.scrollTop = restoreTarget;
    updateBorder();
    if (scrollEl.scrollTop >= restoreTarget) stopRestore();
  };

  onMount(() => {
    if (!scrollEl || !contentEl) return;
    scrollEl.addEventListener('scroll', onScroll);

    observer = new ResizeObserver(() => {
      if (restoring) {
        applyRestore();
      } else if (pinnedToBottom && scrollEl) {
        scrollEl.scrollTop = maxScrollTop();
      }
    });

    observer.observe(contentEl);

    restoreTarget = local.scrollKey != null ? (offsets.get(local.scrollKey) ?? 0) : 0;
    if (restoreTarget <= 0) return;

    restoring = true;

    // Give up once the content stops growing into reach of the offset, the user
    // scrolls themselves, or it stays out of reach for good.
    const timeout = setTimeout(() => stopRestore(), 2000);

    stopRestore = () => {
      if (!restoring) return;
      restoring = false;
      clearTimeout(timeout);
      for (const event of INTERRUPT_EVENTS) {
        scrollEl?.removeEventListener(event, stopRestore);
      }
      // Keep following the bottom when that is where the offset landed.
      pinnedToBottom = isAtBottom();
    };

    for (const event of INTERRUPT_EVENTS) {
      scrollEl.addEventListener(event, stopRestore, { passive: true });
    }
    applyRestore();
  });

  onCleanup(() => {
    stopRestore();
    observer?.disconnect();
    scrollEl?.removeEventListener('scroll', onScroll);
  });

  return (
    <div class={cx('relative', local.class)} {...others}>
      <div
        ref={scrollEl}
        class="overflow-y-auto overflow-x-hidden absolute inset-0"
      >
        <div ref={contentEl}>{local.children}</div>
      </div>
      <div
        ref={borderEl}
        class="hidden absolute left-0 right-0 top-0 h-px bg-border"
      />
    </div>
  );
}

