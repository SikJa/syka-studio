/** @jsxImportSource react */
import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import './effort-slider.css';

const CRTWarp = lazy(() => import('../../components/crt-warp.js'));

/** Native range semantics, with a measured transitions.dev sliding thumb. */
export function EffortSlider({ efforts, index, label, ultra, onChange }: {
  efforts: readonly { id: string; label: string }[];
  index: number;
  label: string;
  ultra: boolean;
  onChange?: (id: string) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const thumb = useRef<HTMLSpanElement>(null);
  const currentIndex = useRef(index);
  const initialized = useRef(false);
  const [effectMounted, setEffectMounted] = useState(false);
  const [reduced, setReduced] = useState(false);
  currentIndex.current = index;

  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(media.matches || document.documentElement.dataset.sykaMotion === 'reduced');
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-syka-motion'] });
    sync(); media.addEventListener('change', sync);
    return () => { observer.disconnect(); media.removeEventListener('change', sync); };
  }, []);

  useEffect(() => {
    if (ultra && !reduced) { setEffectMounted(true); return; }
    // Keep the canvas through the exit, then release its WebGL resources.
    const duration = track.current ? parseFloat(getComputedStyle(track.current).getPropertyValue('--panel-close-dur')) : 200;
    const timer = setTimeout(() => setEffectMounted(false), reduced ? 0 : duration);
    return () => clearTimeout(timer);
  }, [ultra, reduced]);

  const position = (animate: boolean) => {
    const range = input.current, pill = thumb.current;
    if (!range || !pill) return;
    const previous = pill.style.transition;
    if (!animate) pill.style.transition = 'none';
    const fraction = efforts.length > 1 ? currentIndex.current / (efforts.length - 1) : 0;
    pill.style.width = '20px';
    pill.style.transform = `translateX(${range.offsetLeft + fraction * Math.max(0, range.clientWidth - 20)}px)`;
    if (!animate) { void pill.offsetWidth; pill.style.transition = previous; }
  };
  useLayoutEffect(() => { position(initialized.current); initialized.current = true; }, [index, efforts.length]);
  useLayoutEffect(() => {
    const observer = new ResizeObserver(() => position(false));
    if (input.current) observer.observe(input.current);
    return () => observer.disconnect();
  }, [efforts.length]);

  return <div ref={track} className="agent-composer-effort-slider syka-effort-motion" data-ultra={ultra}>
    <div className="syka-effort-effect t-panel-slide" data-open={ultra} aria-hidden="true">
      <span className="syka-effort-effect-base" />
      {effectMounted ? <Suspense fallback={null}>
        <CRTWarp className="agent-composer-effort-crt-warp" color="#c755f7" backgroundColor="#05010a"
          speed={0.35} curvature={0.25} scanlineStrength={0.16} scanlineFrequency={200}
          waveAmplitude={0.22} waveFrequency={2.5} bloom={1.15} bloomRadius={1} noise={0.04}
          vignette={0} brightness={1.05} pixelation={1} rgbShift={0.008} mouseReact={false}
          dpr={1} fps={30} paused={reduced} />
      </Suspense> : null}
    </div>
    <span className="syka-effort-ticks" aria-hidden="true">{efforts.map(effort => <i key={effort.id} />)}</span>
    <span ref={thumb} className="t-tabs-pill syka-effort-thumb" aria-hidden="true" />
    <input ref={input} type="range" min={0} max={Math.max(0, efforts.length - 1)} step={1} value={index}
      disabled={!onChange || efforts.length < 2} aria-label="Esfuerzo" aria-valuetext={label}
      onPointerDown={() => { if (track.current) track.current.dataset.dragging = 'true'; }}
      onPointerUp={() => { if (track.current) delete track.current.dataset.dragging; }}
      onPointerCancel={() => { if (track.current) delete track.current.dataset.dragging; }}
      onBlur={() => { if (track.current) delete track.current.dataset.dragging; }}
      onChange={event => { const effort = efforts[Number(event.currentTarget.value)]; if (effort) onChange?.(effort.id); }} />
  </div>;
}
