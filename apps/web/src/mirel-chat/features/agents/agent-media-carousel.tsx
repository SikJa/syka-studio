/** @jsxImportSource react */
import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import DepthCarousel from './depth-carousel';
import type { AgentLightboxImage } from './agent-image-lightbox';
import './agent-media-motion.css';
import './agent-media-carousel.css';

/** Original depth stack, compact by default and progressively wider with more images. */
export function AgentMediaCarousel({ images, onActivate, onRemove }: {
  images: readonly AgentLightboxImage[];
  onActivate(index: number, trigger: HTMLElement): void;
  onRemove?(id: string): void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const retainedImages = useRef(images);
  const hovered = useRef(false);
  const [present, setPresent] = useState(images.length > 0);
  const [open, setOpen] = useState(false);
  if (images.length) retainedImages.current = images;
  const displayedImages = images.length ? images : retainedImages.current;
  useLayoutEffect(() => {
    if (images.length) {
      setPresent(true);
      // Establish the closed style before opening so the first attachment animates too.
      void rootRef.current?.offsetHeight;
      const frame = requestAnimationFrame(() => setOpen(true));
      return () => cancelAnimationFrame(frame);
    }
    setOpen(false);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.sykaMotion === 'reduced';
    const duration = reduced ? 0 : parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--panel-close-dur')) || 350;
    const timer = setTimeout(() => { setPresent(false); retainedImages.current = []; }, duration);
    return () => clearTimeout(timer);
  }, [images.length]);
  const setExpanded = (expanded: boolean) => {
    const root = rootRef.current;
    if (!root) return;
    const style = getComputedStyle(root);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.sykaMotion === 'reduced';
    const scale = '1';
    const easing = style.getPropertyValue(expanded ? '--avatar-ease-in' : '--avatar-ease-out').trim();
    for (const element of root.querySelectorAll<HTMLElement>('.t-avatar')) {
      element.style.transitionTimingFunction = easing;
    }
    root.style.setProperty('--syka-carousel-scale', scale);
    root.style.setProperty('--scale-active', scale);
    root.style.setProperty('--shift', expanded && !reduced ? style.getPropertyValue('--avatar-lift') : '0px');
  };
  const [activeId, setActiveId] = useState(images[0]?.id);
  const items = useMemo(() => displayedImages.map(image => ({image:image.previewUrl,alt:image.name})), [displayedImages]);
  const index = Math.max(0, displayedImages.findIndex(image => image.id === activeId));
  const active = displayedImages[index];
  if (!active || (!present && !images.length)) return null;
  const many = displayedImages.length > 4;
  const spread = many ? Math.min(48, 32 + (displayedImages.length - 4) * 6) : 16;
  // Center the visible silhouette, including the cards behind the front image.
  const angle = 22 * Math.PI / 180;
  let right = 24;
  for (let d = 1; d <= Math.min(Math.floor(displayedImages.length / 2), many ? 6 : 3); d++) {
    for (const x of [-24, 24]) {
      right = Math.max(right, (spread * d + x * Math.cos(angle)) * 1400 / (1400 + 72 * d + x * Math.sin(angle)));
    }
  }
  const style = { '--syka-stack-offset': many ? '0px' : `${(24 - right) / 2}px` } as CSSProperties;
  return <div className="agent-media-presence t-resize" data-open={open}>
    <div ref={rootRef} className="agent-media-carousel t-panel-slide" data-many={many} data-open={open} style={style}
      aria-label="Galería de referencias" aria-hidden={!open} inert={!open}
      onPointerEnter={event => { if (event.pointerType === 'mouse') { hovered.current = true; setExpanded(true); } }}
      onPointerLeave={() => { hovered.current = false; if (!rootRef.current?.querySelector(':focus-visible')) setExpanded(false); }}
      onFocusCapture={() => setExpanded(true)}
      onBlurCapture={event => { if (!hovered.current && !event.currentTarget.contains(event.relatedTarget as Node | null)) setExpanded(false); }}>
    <DepthCarousel items={items} cardWidth={48} cardHeight={48} radius={9} autoScale={false}
      depth={many ? 10 : 72} spread={spread} fanOut={many}
      tilt={many ? 8 : 22} visibleCards={many ? displayedImages.length : 3} blur={many ? 1.2 : 3} falloff={many ? 0.045 : 0.2} duration={700} stageClassName="t-avatar"
      showControls={false} showIndicators={true}
      onRemove={onRemove ? index => {const image=images[index];if(image)onRemove(image.id)} : undefined}
      onChange={index => setActiveId(displayedImages[index]?.id)} onActivate={(index, trigger) => { if (images.length && open) onActivate(index, trigger); }}/>
  </div></div>;
}
