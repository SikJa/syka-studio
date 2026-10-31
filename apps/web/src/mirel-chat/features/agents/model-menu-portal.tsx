/** @jsxImportSource react */
import { useLayoutEffect, useState, type RefObject, type ReactNode, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { EffortOrientation } from './model-picker-preferences';

/** Escape the chat's overflow:hidden and fit the whole menu inside the viewport. */
export function ModelMenuPortal({ anchor, children, placement = 'top', orientation = 'vertical' }: { anchor: RefObject<HTMLButtonElement | null>; children: ReactNode; placement?: 'top' | 'bottom'; orientation?: EffortOrientation }) {
  const [style, setStyle] = useState<CSSProperties>({ visibility: 'hidden' });
  const [side, setSide] = useState(placement);
  useLayoutEffect(() => {
    const place = () => {
      const trigger = anchor.current; if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const owner = trigger.closest('.agent-composer');
      const composer = owner?.getBoundingClientRect() ?? rect;
      const surface = owner?.querySelector('.agent-composer-surface') ?? trigger;
      const material = getComputedStyle(surface);
      const margin = 12, gap = 8;
      const width = Math.min(orientation === 'vertical' ? 384 : 432, window.innerWidth - margin * 2);
      const height = orientation === 'vertical' ? 320 : 402;
      const below = Math.max(0, window.innerHeight - composer.bottom - gap - margin);
      const above = Math.max(0, composer.top - gap - margin);
      const preferred = placement === 'bottom' ? below : above;
      const opposite = placement === 'bottom' ? above : below;
      const actual = preferred < height && opposite > preferred ? (placement === 'bottom' ? 'top' : 'bottom') : placement;
      const available = actual === 'bottom' ? below : above;
      setSide(actual);
      setStyle({ width, left: Math.max(margin, Math.min(composer.left + (composer.width - width) / 2, window.innerWidth - width - margin)),
        ...(actual === 'bottom' ? { top: composer.bottom + gap } : { bottom: window.innerHeight - composer.top + gap }),
        fontFamily: material.fontFamily,
        '--model-menu-height': `${Math.max(0, Math.min(height - 2, available - 2))}px`,
        '--studio-picker-background': material.backgroundColor,
        '--studio-picker-border': material.borderTopColor,
        '--studio-picker-shadow': material.boxShadow,
        '--studio-picker-blur': material.backdropFilter,
        '--studio-picker-color': material.color,
      } as CSSProperties & Record<`--${string}`, string>);
    };
    const observer = new ResizeObserver(place);
    if (anchor.current) observer.observe(anchor.current.closest('.agent-composer') ?? anchor.current);
    const appearance = new MutationObserver(place);
    appearance.observe(document.documentElement, { attributes: true, attributeFilter: ['class','style','data-theme','data-kb-theme','data-syka-chat-material'] });
    let focusFrame = 0;
    const afterFocus = () => { cancelAnimationFrame(focusFrame); focusFrame = requestAnimationFrame(place); };
    const afterMaterialTransition = (event: TransitionEvent) => {
      if (event.target === anchor.current?.closest('.agent-composer')?.querySelector('.agent-composer-surface')) place();
    };
    window.addEventListener('focusin', afterFocus);
    window.addEventListener('focusout', afterFocus);
    window.addEventListener('transitionend', afterMaterialTransition);
    place(); window.addEventListener('resize', place); window.addEventListener('scroll', place, true);
    return () => { observer.disconnect(); appearance.disconnect(); cancelAnimationFrame(focusFrame); window.removeEventListener('focusin', afterFocus); window.removeEventListener('focusout', afterFocus); window.removeEventListener('transitionend', afterMaterialTransition); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [anchor, placement, orientation]);
  return createPortal(<div className="syka-mirel-composer agent-composer syka-model-portal" data-placement={side} style={style}>{children}</div>, document.fullscreenElement ?? document.body);
}
