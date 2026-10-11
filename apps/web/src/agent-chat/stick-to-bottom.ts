/*
 * Vendored from @conciv/solid-stick-to-bottom 0.0.19, the SolidJS port of
 * use-stick-to-bottom (https://github.com/stackblitz-labs/use-stick-to-bottom).
 * De-minified, and its two @solid-primitives helpers (event-listener, timer)
 * replaced with plain addEventListener / setTimeout so it brings no new
 * dependency. The React original is the reference for fixes.
 *
 * MIT License
 *
 * Copyright (c) 2024 - present StackBlitz
 * Copyright (c) 2026 conciv contributors
 *
 * This package is a SolidJS port of use-stick-to-bottom
 * (https://github.com/stackblitz-labs/use-stick-to-bottom), created by StackBlitz and
 * licensed under the MIT License. Portions of this package are derived from that project.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { createEffect, onCleanup, untrack, type Accessor } from "solid-js";
import { createStore } from "solid-js/store";

export type SpringAnimation = { damping: number; stiffness: number; mass: number };
export type Animation = "instant" | Partial<SpringAnimation>;

export type ScrollToBottomOptions = {
  animation?: Animation;
  wait?: boolean | number;
  ignoreEscapes?: boolean;
  preserveScrollPosition?: boolean;
  duration?: number;
};

export type StickToBottomOptions = {
  initial?: Animation | boolean;
  resize?: Animation;
  follow?: Accessor<boolean>;
};

export type StickToBottom = {
  isAtBottom: Accessor<boolean>;
  isNearBottom: Accessor<boolean>;
  escapedFromLock: Accessor<boolean>;
  scrollToBottom: (options?: ScrollToBottomOptions) => Promise<boolean>;
  stopScroll: () => void;
};

type ResolvedAnimation = "instant" | Readonly<SpringAnimation>;

type RunningAnimation = { behavior: ResolvedAnimation; ignoreEscapes: boolean; promise: Promise<boolean> };

const DEFAULT_SPRING: SpringAnimation = { damping: 0.7, stiffness: 0.05, mass: 1.25 };
const STICK_TO_BOTTOM_OFFSET_PX = 70;
const SIXTY_FPS_INTERVAL_MS = 1000 / 60;
const RETAIN_ANIMATION_DURATION_MS = 350;
const DEBOUNCE_MS = 1;
const SCROLLABLE_OVERFLOW = new Set(["auto", "scroll"]);
const animationCache = new Map<string, Readonly<SpringAnimation>>();

function mergeAnimations(...animations: (Animation | boolean | undefined)[]): ResolvedAnimation {
  const result = { ...DEFAULT_SPRING };
  let instant = false;
  for (const animation of animations) {
    if (animation === "instant") {
      instant = true;
      continue;
    }
    if (typeof animation === "object") {
      instant = false;
      result.damping = animation.damping ?? result.damping;
      result.stiffness = animation.stiffness ?? result.stiffness;
      result.mass = animation.mass ?? result.mass;
    }
  }
  if (instant) return "instant";
  const key = JSON.stringify(result);
  const cached = animationCache.get(key);
  if (cached) return cached;
  const frozen = Object.freeze(result);
  animationCache.set(key, frozen);
  return frozen;
}

function hasGetSelection(node: Node): node is Node & { getSelection(): Selection | null } {
  return "getSelection" in node && typeof (node as { getSelection?: unknown }).getSelection === "function";
}

function hasSelectionWithin(element: HTMLElement): boolean {
  const root = element.getRootNode();
  const selection = hasGetSelection(root) ? root.getSelection() : null;
  if (!selection || !selection.rangeCount) return false;
  const range = selection.getRangeAt(0);
  return range.commonAncestorContainer.contains(element) || element.contains(range.commonAncestorContainer);
}

function scrollableParent(target: EventTarget | null): HTMLElement | null {
  let element = target instanceof HTMLElement ? target : null;
  while (element && !SCROLLABLE_OVERFLOW.has(getComputedStyle(element).overflowY)) element = element.parentElement;
  return element;
}

/** Watches the element and every descendant for size changes. */
function observeResize(element: HTMLElement, callback: () => void): () => void {
  const resizeObserver = new ResizeObserver(callback);
  const observed = new WeakSet<Element>();
  const observe = (child: Element) => {
    if (observed.has(child)) return;
    observed.add(child);
    resizeObserver.observe(child);
  };
  const observeChildren = () => {
    for (const child of element.children) observe(child);
  };
  const mutationObserver = new MutationObserver(observeChildren);
  mutationObserver.observe(element, { childList: true, subtree: true });
  resizeObserver.observe(element);
  observeChildren();
  return () => {
    resizeObserver.disconnect();
    mutationObserver.disconnect();
  };
}

export function createStickToBottom(scrollElement: Accessor<HTMLElement | undefined>, options: StickToBottomOptions = {}): StickToBottom {
  const [state, setState] = createStore({
    isAtBottom: options.initial !== false,
    isNearBottom: false,
    escapedFromLock: false,
  });

  const ctx: {
    resizeDifference: number;
    velocity: number;
    accumulated: number;
    lastTick?: number;
    animation?: RunningAnimation;
    ignoreScrollToTop?: number;
    lastScrollTop?: number;
  } = { resizeDifference: 0, velocity: 0, accumulated: 0 };

  let isSelecting = false;
  let lastScrollHeight: number | undefined;
  const timers = new Set<ReturnType<typeof setTimeout>>();

  const debounce = (fn: () => void) => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      fn();
    }, DEBOUNCE_MS);
    timers.add(timer);
  };
  onCleanup(() => {
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
  });

  const scrollTop = () => scrollElement()?.scrollTop ?? 0;

  const setScrollTop = (top: number) => {
    const element = scrollElement();
    if (!element) return;
    const { scrollBehavior } = getComputedStyle(element);
    if (scrollBehavior !== "auto") element.style.scrollBehavior = "auto";
    element.scrollTop = top;
    ctx.ignoreScrollToTop = element.scrollTop;
    if (scrollBehavior !== "auto") element.style.scrollBehavior = scrollBehavior;
  };

  const targetScrollTop = () => {
    const element = scrollElement();
    return element ? element.scrollHeight - 1 - element.clientHeight : 0;
  };

  const isAtBottom = () => untrack(() => state.isAtBottom);
  const escapedFromLock = () => untrack(() => state.escapedFromLock);
  const scrollDifference = () => targetScrollTop() - scrollTop();
  const isNearBottom = () => scrollDifference() <= STICK_TO_BOTTOM_OFFSET_PX;
  const follow = () => options.follow?.() ?? true;

  const isSelectingText = () => {
    if (!isSelecting) return false;
    const element = scrollElement();
    return element ? hasSelectionWithin(element) : false;
  };

  const tick = (animation: RunningAnimation) => {
    const now = performance.now();
    const elapsed = (now - (ctx.lastTick ?? now)) / SIXTY_FPS_INTERVAL_MS;
    ctx.animation ||= animation;
    if (ctx.animation.behavior === animation.behavior) ctx.lastTick = now;
    return elapsed;
  };

  const animate = (behavior: ResolvedAnimation, startTop: number, elapsed: number) => {
    if (behavior === "instant") {
      setScrollTop(targetScrollTop());
      return;
    }
    ctx.velocity = (behavior.damping * ctx.velocity + behavior.stiffness * scrollDifference()) / behavior.mass;
    ctx.accumulated += ctx.velocity * elapsed;
    setScrollTop(scrollTop() + ctx.accumulated);
    if (scrollTop() !== startTop) ctx.accumulated = 0;
  };

  const scrollToBottom = (scrollOptions: ScrollToBottomOptions = {}): Promise<boolean> => {
    const complete = (ignoreEscapes: boolean, until: number): Promise<boolean> | boolean => {
      ctx.animation = undefined;
      if (scrollTop() >= targetScrollTop()) return isAtBottom();
      return scrollToBottom({
        animation: mergeAnimations(options.resize),
        ignoreEscapes,
        duration: Math.max(0, until - Date.now()) || undefined,
      });
    };

    if (!scrollOptions.preserveScrollPosition) setState("isAtBottom", true);

    const waitUntil = Date.now() + (Number(scrollOptions.wait) || 0);
    const behavior = mergeAnimations(scrollOptions.animation);
    const ignoreEscapes = scrollOptions.ignoreEscapes ?? false;
    const durationUntil = waitUntil + (scrollOptions.duration ?? 0);
    let target = targetScrollTop();

    const step = (): Promise<boolean> => {
      const promise = new Promise<number>(requestAnimationFrame).then((): boolean | Promise<boolean> => {
        if (!isAtBottom()) {
          ctx.animation = undefined;
          return false;
        }
        const top = scrollTop();
        const elapsed = tick({ behavior, ignoreEscapes, promise });
        if (isSelectingText() || waitUntil > Date.now()) return step();
        if (top < Math.min(target, targetScrollTop())) {
          if (ctx.animation?.behavior === behavior) animate(behavior, top, elapsed);
          return step();
        }
        if (durationUntil > Date.now()) {
          target = targetScrollTop();
          return step();
        }
        return complete(ignoreEscapes, durationUntil);
      });
      return promise.then((result) => {
        requestAnimationFrame(() => {
          if (!ctx.animation) {
            ctx.lastTick = undefined;
            ctx.velocity = 0;
          }
        });
        return result;
      });
    };

    if (scrollOptions.wait !== true) ctx.animation = undefined;
    if (ctx.animation?.behavior === behavior) return ctx.animation.promise;
    return step();
  };

  const stopScroll = () => setState({ escapedFromLock: true, isAtBottom: false });

  const handleScrollDirection = (top: number, previous: number) => {
    if (top < previous) setState({ escapedFromLock: true, isAtBottom: false });
    if (top > previous) setState("escapedFromLock", false);
    if (!escapedFromLock() && isNearBottom()) setState("isAtBottom", true);
  };

  const handleScroll = (event: Event) => {
    const element = scrollElement();
    if (!element || event.target !== element) return;
    const top = element.scrollTop;
    const ignored = ctx.ignoreScrollToTop;
    let previous = ctx.lastScrollTop ?? top;
    ctx.lastScrollTop = top;
    ctx.ignoreScrollToTop = undefined;
    if (ignored && ignored > top) previous = ignored;
    setState("isNearBottom", isNearBottom());
    debounce(() => {
      if (ctx.resizeDifference || top === ignored) return;
      if (isSelectingText()) {
        setState({ escapedFromLock: true, isAtBottom: false });
        return;
      }
      if (ctx.animation?.ignoreEscapes) {
        setScrollTop(previous);
        return;
      }
      handleScrollDirection(top, previous);
    });
  };

  const handleWheel = (event: WheelEvent) => {
    const element = scrollElement();
    if (!element || event.deltaY >= 0) return;
    if (scrollableParent(event.target) !== element) return;
    if (element.scrollHeight <= element.clientHeight || ctx.animation?.ignoreEscapes) return;
    setState({ escapedFromLock: true, isAtBottom: false });
  };

  const handleResize = () => {
    const element = scrollElement();
    if (!element) return;
    const scrollHeight = element.scrollHeight;
    const difference = scrollHeight - (lastScrollHeight ?? scrollHeight);
    ctx.resizeDifference = difference;
    if (scrollTop() > targetScrollTop()) setScrollTop(targetScrollTop());
    setState("isNearBottom", isNearBottom());
    if (difference >= 0) {
      const animation = mergeAnimations(lastScrollHeight === undefined ? options.initial : options.resize);
      if (follow()) {
        void scrollToBottom({
          animation,
          wait: true,
          preserveScrollPosition: true,
          duration: animation === "instant" ? undefined : RETAIN_ANIMATION_DURATION_MS,
        });
      }
    } else if (isNearBottom()) {
      setState({ escapedFromLock: false, isAtBottom: true });
    }
    lastScrollHeight = scrollHeight;
    requestAnimationFrame(() => {
      debounce(() => {
        if (ctx.resizeDifference === difference) ctx.resizeDifference = 0;
      });
    });
  };

  createEffect(() => {
    const down = () => (isSelecting = true);
    const up = () => (isSelecting = false);
    document.addEventListener("mousedown", down);
    document.addEventListener("mouseup", up);
    document.addEventListener("click", up);
    onCleanup(() => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("mouseup", up);
      document.removeEventListener("click", up);
    });
  });

  createEffect(() => {
    const element = scrollElement();
    if (!element) return;
    lastScrollHeight = undefined;
    element.addEventListener("scroll", handleScroll, { passive: true });
    element.addEventListener("wheel", handleWheel, { passive: true });
    const stopObserving = observeResize(element, handleResize);
    onCleanup(() => {
      element.removeEventListener("scroll", handleScroll);
      element.removeEventListener("wheel", handleWheel);
      stopObserving();
    });
  });

  return {
    isAtBottom: () => state.isAtBottom || state.isNearBottom,
    isNearBottom: () => state.isNearBottom,
    escapedFromLock: () => state.escapedFromLock,
    scrollToBottom,
    stopScroll,
  };
}
