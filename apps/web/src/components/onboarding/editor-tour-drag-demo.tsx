import { createEffect, createSignal, onCleanup, onMount, Show, untrack } from 'solid-js';
import { Portal } from 'solid-js/web';
import { t } from '@/i18n';
import { revealLibraryTourSource, type TourRect } from './editor-tour-model';

type Point = { x: number; y: number };
type Geometry = { source: TourRect; target: TourRect; from: Point; to: Point; label: string; detourY?: number };
const DURATION = 6800;
const CONTACT = 1150;
const DRAG_START = 1550;
const RELEASE = 3750;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => { const p = clamp(value); return p * p * (3 - 2 * p); };
const isVisible = (element: HTMLElement) => {
  const rect = box(element);
  return !element.closest('[inert], [aria-hidden="true"], [data-chat-transition-clone]')
    && rect.width > 16 && rect.height > 16
    && (!element.checkVisibility || element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }));
};
const visibleElement = (selector: string) => [...document.querySelectorAll<HTMLElement>(selector)].find(isVisible);
const box = (element: HTMLElement): TourRect => {
  const rect = element.getBoundingClientRect();
  let x = Math.max(8, rect.left), y = Math.max(8, rect.top);
  let right = Math.min(innerWidth - 8, rect.right), bottom = Math.min(innerHeight - 8, rect.bottom);
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent), bounds = parent.getBoundingClientRect();
    if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) { x = Math.max(x, bounds.left); right = Math.min(right, bounds.right); }
    if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) { y = Math.max(y, bounds.top); bottom = Math.min(bottom, bounds.bottom); }
  }
  return { x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) };
};
const boxStyle = (rect: TourRect) => ({ left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.width}px`, height: `${rect.height}px` });

/** A visual rehearsal over real controls. It never dispatches drag, drop or send. */
export function EditorTourDragDemo(props: { prepareDestination: (destination: 'chat' | 'timeline') => void }) {
  const [destination, setDestination] = createSignal<'chat' | 'timeline'>('chat');
  const [replay, setReplay] = createSignal(0);
  const [geometry, setGeometry] = createSignal<Geometry>();
  const [time, setTime] = createSignal(0);
  const [reduced, setReduced] = createSignal(false);
  const [paused, setPaused] = createSignal(false);
  const [playOnce, setPlayOnce] = createSignal(false);
  const [visible, setVisible] = createSignal(!document.hidden);
  const [thumbnail, setThumbnail] = createSignal<string>();
  const [unavailable, setUnavailable] = createSignal(false);
  const staticMode = () => reduced() && !playOnce();
  let frame = 0, prepareFrame = 0, layoutFrame = 0;
  const readGeometry = (): Geometry | undefined => {
    const source = visibleElement('[data-right-sidebar] [data-tour-resource="text"]');
    const control = visibleElement(destination() === 'chat' ? '[data-tour-target="chat-message"]' : '#timeline-canvas');
    if (!source || !control) return;
    const sourceBox = box(source);
    // A sliver left above the scroll boundary is not a useful source card.
    const fullSource = source.getBoundingClientRect();
    if (sourceBox.height < Math.min(fullSource.height - 2, 72) || sourceBox.width < Math.min(fullSource.width - 2, 72)) return;
    const target = box(destination() === 'chat' ? control.closest<HTMLElement>('.agent-composer') ?? control : control);
    if (destination() === 'timeline') {
      target.x += Math.min(70, target.width * .1);
      target.y += Math.min(35, target.height * .15);
      target.width = Math.min(240, target.width * .65);
      target.height = Math.min(62, target.height * .65);
    }
    const from = { x: sourceBox.x + sourceBox.width / 2, y: sourceBox.y + Math.min(45, sourceBox.height / 2) };
    const to = { x: target.x + Math.min(112, target.width / 2), y: target.y + Math.min(36, target.height / 2) };
    const guide = document.querySelector('.syka-tour-card')?.getBoundingClientRect();
    // In a short library, the direct drag crosses behind the guide. Pass below it.
    const detourY = guide && sourceBox.x >= guide.right && to.x < guide.right && sourceBox.y < guide.bottom + 14
      ? Math.min(innerHeight - sourceBox.height + (from.y - sourceBox.y) - 8, guide.bottom + (from.y - sourceBox.y) + 14)
      : undefined;
    return {
      source: sourceBox, target,
      from, to, detourY,
      label: source.dataset.tourResourceLabel || t('Texto'),
    };
  };
  const prepareDemo = (revealSource = false) => {
    cancelAnimationFrame(prepareFrame); setGeometry(undefined); setTime(0); setThumbnail(undefined); setUnavailable(false);
    if (revealSource) { props.prepareDestination(destination()); revealLibraryTourSource(); }
    const started = performance.now();
    let stableFrames = 0, previousGeometry = '';
    const prepare = () => {
      const next = readGeometry();
      if (!next) {
        // Mounting the real chat can take longer than a fixed number of frames.
        if (performance.now() - started < 6000) prepareFrame = requestAnimationFrame(prepare);
        else setUnavailable(true);
        return;
      }
      const signature = JSON.stringify(next);
      stableFrames = signature === previousGeometry ? stableFrames + 1 : 0;
      previousGeometry = signature;
      if (stableFrames < 2 && performance.now() - started < 6000) { prepareFrame = requestAnimationFrame(prepare); return; }
      setGeometry(next);
    };
    prepareFrame = requestAnimationFrame(prepare);
  };
  const snapshotCard = () => {
    const canvas = visibleElement('[data-right-sidebar] [data-tour-resource="text"]')?.querySelector('canvas');
    if (!canvas || !canvas.width || !canvas.height) return;
    try { setThumbnail(canvas.toDataURL()); } catch { /* A text card still explains the gesture if its poster is unavailable. */ }
  };
  const repeat = () => {
    setPaused(false);
    if (reduced()) setPlayOnce(true);
    setReplay(value => value + 1);
  };
  const togglePlayback = () => {
    if (staticMode()) repeat();
    else setPaused(value => !value);
  };
  onMount(() => {
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const syncMotion = () => {
      const next = motion.matches || document.documentElement.dataset.motion === 'reduced' || document.documentElement.dataset.sykaMotion === 'reduced';
      if (next !== reduced()) { setPlayOnce(false); setReduced(next); }
    };
    syncMotion();
    const observer = new MutationObserver(syncMotion);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion', 'data-syka-motion'] });
    motion.addEventListener('change', syncMotion);
    const reposition = () => {
      if (layoutFrame) return;
      layoutFrame = requestAnimationFrame(() => { layoutFrame = 0; untrack(() => prepareDemo()); });
    };
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    const sidebar = document.querySelector('.syka-right-sidebar');
    const libraryChanges = new MutationObserver(() => {
      // If a category changes while this step is open, recover its sample card.
      if (!sidebar?.querySelector('[data-tour-resource="text"]')) revealLibraryTourSource();
      reposition();
    });
    if (sidebar) libraryChanges.observe(sidebar, { childList: true, subtree: true });
    const librarySize = new ResizeObserver(() => { revealLibraryTourSource(); reposition(); });
    if (sidebar) librarySize.observe(sidebar);
    const visibility = () => {
      setVisible(!document.hidden);
      if (!document.hidden) setReplay(value => value + 1);
    };
    document.addEventListener('visibilitychange', visibility);
    createEffect(() => { destination(); replay(); untrack(() => prepareDemo(true)); });
    createEffect(() => {
      if (!geometry() || staticMode() || paused() || !visible()) return;
      let last = performance.now();
      const tick = (now: number) => {
        // Don't skip the pickup or release when a frame is delayed.
        const next = time() + Math.min(80, now - last);
        last = now;
        if (time() < CONTACT && next >= CONTACT) snapshotCard();
        if (next >= DURATION && reduced()) { setPlayOnce(false); setTime(0); return; }
        setTime(next % DURATION);
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
      onCleanup(() => cancelAnimationFrame(frame));
    });
    onCleanup(() => {
      cancelAnimationFrame(frame); cancelAnimationFrame(prepareFrame); cancelAnimationFrame(layoutFrame); observer.disconnect(); libraryChanges.disconnect(); librarySize.disconnect(); motion.removeEventListener('change', syncMotion);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('resize', reposition); window.removeEventListener('scroll', reposition, true);
    });
  });
  const progress = () => ease((time() - DRAG_START) / (RELEASE - DRAG_START));
  const position = () => {
    const g = geometry()!, p = progress();
    if (g.detourY !== undefined) {
      const down = Math.abs(g.detourY - g.from.y), across = Math.abs(g.to.x - g.from.x), end = Math.abs(g.to.y - g.detourY);
      const distance = p * (down + across + end);
      if (distance < down) return { x: g.from.x, y: g.from.y + (g.detourY - g.from.y) * ease(distance / down) };
      if (distance < down + across) return { x: g.from.x + (g.to.x - g.from.x) * ease((distance - down) / across), y: g.detourY };
      return { x: g.to.x, y: g.detourY + (g.to.y - g.detourY) * ease(end ? (distance - down - across) / end : 1) };
    }
    return { x: g.from.x + (g.to.x - g.from.x) * p, y: g.from.y + (g.to.y - g.from.y) * p - Math.sin(p * Math.PI) * Math.min(65, Math.abs(g.to.x - g.from.x) * .12) };
  };
  const cursor = () => {
    const g = geometry()!;
    if (staticMode()) return g.from;
    const p = position(), approach = 1 - ease((time() - 300) / (CONTACT - 300)), leave = ease((time() - 4500) / 750);
    return { x: p.x + approach * 48 + leave * 36, y: p.y + approach * 62 + leave * 24 };
  };
  const cursorOpacity = () => staticMode() ? 1 : ease(time() / 300) * (1 - ease((time() - 5100) / 450));
  const phase = () => staticMode() ? 'static' : time() < CONTACT ? 'approach' : time() < DRAG_START ? 'pick' : time() < RELEASE ? 'drag' : time() < 5600 ? 'drop' : 'rest';
  const caption = () => destination() === 'chat' ? t('Soltá como referencia') : t('Soltá para agregar el texto');
  const playbackLabel = () => staticMode() ? t('Ver animación') : paused() ? t('Continuar demostración') : t('Pausar demostración');
  return <div class="syka-tour-drag-demo">
    <div class="syka-tour-destinations" role="group" aria-label={t('Destino del arrastre')}>
      <button type="button" aria-pressed={destination() === 'chat'} onClick={() => setDestination('chat')}>{t('Al chat')}</button>
      <button type="button" aria-pressed={destination() === 'timeline'} onClick={() => setDestination('timeline')}>{t('A la timeline')}</button>
    </div>
    <div class="syka-tour-demo-footer">
      <span>{t('Demostración · tu proyecto no cambia')}</span>
      <div class="syka-tour-demo-playback">
      <button type="button" aria-label={playbackLabel()} title={playbackLabel()} onClick={togglePlayback}>
        <svg viewBox="0 0 20 20" aria-hidden="true"><Show when={paused() || staticMode()} fallback={<path d="M7 5v10M13 5v10" />}><path d="m7 4 9 6-9 6Z" /></Show></svg>
      </button>
      <button type="button" aria-label={t('Repetir demostración')} title={t('Repetir demostración')} onClick={repeat}>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 7a6 6 0 1 1 0 6M4 3v4h4" /></svg>
      </button>
      </div>
    </div>
    <Show when={unavailable()}><small class="syka-tour-muted" role="status">{t('Dejá visibles la biblioteca y el destino para ver la demostración.')}</small></Show>
    <Portal><Show when={geometry()}>{g =>
      <div class="syka-tour-drag-overlay" aria-hidden="true" data-destination={destination()} data-reduced={staticMode()} data-phase={phase()} data-paused={paused()}>
        <div class="syka-tour-drag-source" style={boxStyle(g().source)} />
        <div class="syka-tour-drag-target" data-ready={progress() > .8} style={boxStyle(g().target)}><span>{caption()}</span></div>
        <Show when={staticMode()}><svg class="syka-tour-drag-route" width="100%" height="100%"><path d={`M${g().from.x} ${g().from.y} Q${g().to.x} ${g().from.y} ${g().to.x} ${g().to.y}`} /></svg></Show>
        <Show when={staticMode() || (time() >= CONTACT && time() < RELEASE + 450)}>
          <div class="syka-tour-drag-ghost" style={{ width: `${g().source.width}px`, height: `${g().source.height}px`, 'transform-origin': `${g().from.x - g().source.x}px ${g().from.y - g().source.y}px`, transform: `translate(${(staticMode() ? g().from.x : position().x) - (g().from.x - g().source.x)}px,${(staticMode() ? g().from.y : position().y) - (g().from.y - g().source.y)}px) scale(${staticMode() ? 1 : 1 - Math.sin(clamp((time() - CONTACT) / 400) * Math.PI) * .04 - ease((time() - RELEASE) / 450) * .2})`, opacity: staticMode() ? 1 : 1 - ease((time() - RELEASE) / 450) }}>
            <Show when={thumbnail()} fallback={<span class="syka-tour-drag-poster">Aa</span>}>{src => <img class="syka-tour-drag-poster" src={src()} alt="" draggable={false} />}</Show><small>{g().label}</small>
          </div>
        </Show>
        <Show when={!staticMode() && time() >= RELEASE + 120 && time() < 5600}>
          <div class="syka-tour-drag-attached" style={{ left: `${g().target.x + 12}px`, top: `${g().target.y + 12}px`, 'max-width': `${g().target.width - 24}px`, opacity: ease((time() - RELEASE - 120) / 330) * (1 - ease((time() - 5250) / 350)) }}>
            <span>Aa</span><small>{g().label}</small><svg viewBox="0 0 16 16"><path d="m3 8 3 3 7-7" /></svg>
          </div>
        </Show>
        <Show when={!staticMode() && ((time() >= CONTACT && time() < DRAG_START) || (time() >= RELEASE && time() < RELEASE + 350))}>
          <div class="syka-tour-drag-press" style={{ left: `${cursor().x}px`, top: `${cursor().y}px`, transform: `translate(-50%,-50%) scale(${1 + clamp((time() - (time() < DRAG_START ? CONTACT : RELEASE)) / 350)})`, opacity: 1 - clamp((time() - (time() < DRAG_START ? CONTACT : RELEASE)) / 350) }} />
        </Show>
        <svg class="syka-tour-drag-cursor" data-cursor="macos" viewBox="0 0 32 40" style={{ transform: `translate(${cursor().x - 3}px,${cursor().y - 3}px) scale(${!staticMode() && time() >= CONTACT && time() < RELEASE ? .93 : 1})`, opacity: cursorOpacity() }}><path d="M3 3v28l7.5-7 6 12 5-2.5-6-12H26Z" /></svg>
      </div>
    }</Show></Portal>
  </div>;
}
