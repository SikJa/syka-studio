import { createEffect, onCleanup, onMount } from 'solid-js';
import { createElement, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Sparkles, ChevronRight } from 'lucide-react';
import { MetalFx } from 'metal-fx';
import { createRoot, type Root } from '@/lib/react-root';
import { useComposerMetalAppearance } from '@/mirel-chat/shared/use-metal-appearance';

type SkillsCategoryProps = { selected: boolean; label: string; onSelect: () => void };

/** Reuse the chat's MetalFX renderer, theme and reduced-motion preference. */
function MetalSkillsButton(props: SkillsCategoryProps & { host: HTMLDivElement }) {
  const appearance = useComposerMetalAppearance();
  const [snapshotSize, setSnapshotSize] = useState('initial');
  const restoreFocus = useRef(false);
  // MetalFX 1.0.4 clears the canvas on resize but does not repaint a paused
  // instance. Recreate only its frozen snapshot, retaining the native fallback.
  useEffect(() => {
    if (!appearance.reducedMotion) return;
    const observer = new ResizeObserver(([entry]) => {
      const size = `${Math.round(entry.contentRect.width)}x${Math.round(entry.contentRect.height)}`;
      restoreFocus.current = props.host.contains(document.activeElement);
      setSnapshotSize(size);
    });
    observer.observe(props.host);
    return () => observer.disconnect();
  }, [appearance.reducedMotion, props.host]);
  const snapshotKey = `${appearance.theme}:${appearance.reducedMotion ? snapshotSize : 'live'}`;
  useLayoutEffect(() => {
    if (restoreFocus.current) { props.host.querySelector('button')?.focus({ preventScroll: true }); restoreFocus.current = false; }
  }, [snapshotKey, props.host]);
  return createElement(MetalFx, {
    key: snapshotKey,
    className: 'syka-skills-metal', variant: 'button', preset: 'chromatic',
    strength: .9, borderRadius: 10, theme: appearance.theme,
    paused: appearance.paused,
    children: createElement('button', {
      type: 'button', className: 'syka-skills-category',
      'aria-pressed': props.selected, onClick: props.onSelect,
    }, createElement(Sparkles, { size: 16, 'aria-hidden': true }),
    createElement('span', null, props.label),
    createElement(ChevronRight, { size: 14, 'aria-hidden': true })),
  });
}

export function SkillsCategory(props: SkillsCategoryProps) {
  let element!: HTMLDivElement, root: Root | undefined;
  onMount(() => {
    root = createRoot(element);
    createEffect(() => root!.render(createElement(MetalSkillsButton, {
      selected: props.selected, label: props.label, onSelect: props.onSelect, host: element,
    })));
  });
  onCleanup(() => root?.unmount());
  return <div class="syka-skills-category-slot" ref={element} />;
}
