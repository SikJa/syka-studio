import { createEffect, createSignal, onCleanup, onMount } from 'solid-js';
import { Portal } from 'solid-js/web';
import { SykaChatOrb } from './mirel-messages';

/** One persistent canvas follows the header/activity anchors without being remounted. */
export function ChatIdentityOrb(props: { working: boolean; paused?: boolean }) {
  let anchor!: HTMLSpanElement;
  let frame: number | undefined;
  let activeTarget: Element | undefined;
  const [travel, setTravel] = createSignal(false);
  const [position, setPosition] = createSignal({ x: 0, y: 0, size: 28, visible: false, zIndex: 55 });
  const [theme, setTheme] = createSignal<string | undefined>();
  const measure = () => {
    setTheme(anchor.closest('[data-kb-theme]')?.getAttribute('data-kb-theme') ?? undefined);
    const panel = anchor.closest('.syka-agent-chat');
    const target = props.working
      ? panel?.querySelector('[data-chat-orb-anchor="question"]')
        ?? panel?.querySelector('[data-chat-orb-anchor="activity"]')
        ?? [...(panel?.querySelectorAll('[data-chat-message="assistant"] [data-chat-orb-anchor="response"]') ?? [])].at(-1)
        ?? anchor
      : anchor;
    if (activeTarget !== target) {
      setTravel(activeTarget !== undefined);
      activeTarget?.removeAttribute('data-orb-active');
      activeTarget = target;
    }
    if (props.working) target.setAttribute('data-orb-active', 'true');
    else target.removeAttribute('data-orb-active');
    const rect = target.getBoundingClientRect();
    const panelRect = panel?.getBoundingClientRect();
    let visible = !!panel && !!panelRect?.width && rect.width > 0 && getComputedStyle(panel).visibility !== 'hidden'
      && rect.top >= panelRect.top && rect.bottom <= panelRect.bottom;
    // The portal must respect the transcript's clipping. Otherwise a response
    // scrolled underneath the composer leaves its orb floating over the draft.
    for (let parent = target.parentElement; visible && parent && parent !== panel; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (/auto|scroll|hidden|clip/.test(style.overflowY)) {
        const clip = parent.getBoundingClientRect();
        visible = rect.top >= clip.top && rect.bottom <= clip.bottom;
      }
    }
    let zIndex = 55;
    for (let parent = panel; parent; parent = parent.parentElement) {
      const value = Number.parseInt(getComputedStyle(parent).zIndex, 10);
      if (Number.isFinite(value)) zIndex = Math.max(zIndex, value + 1);
    }
    // Question cards reserve a larger anchor. Size the same travelling canvas
    // to that slot rather than leaving a 28px orb inside a hero-sized space.
    const size = target.matches('[data-chat-orb-anchor="question"]')
      ? (target as HTMLElement).clientWidth || rect.width
      : 28;
    setPosition({ x: rect.left + rect.width / 2 - size / 2, y: rect.top + rect.height / 2 - size / 2, size, visible, zIndex });
  };
  const schedule = () => {
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(measure);
  };
  const trackDrag = (event: PointerEvent) => { if (event.buttons) schedule(); };
  const trackLayout = () => { setTravel(false); schedule(); };
  onMount(() => {
    const panel = anchor.closest('.syka-agent-chat');
    const resize = new ResizeObserver(schedule);
    const mutations = new MutationObserver(schedule);
    const themeChanges = new MutationObserver(schedule);
    themeChanges.observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ['data-kb-theme'] });
    if (panel) {
      resize.observe(panel);
      mutations.observe(panel, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
      panel.addEventListener('scroll', trackLayout, true);
    }
    window.addEventListener('resize', trackLayout);
    window.addEventListener('focus', trackLayout);
    document.addEventListener('visibilitychange', trackLayout);
    window.addEventListener('pointermove', trackDrag, { passive: true });
    schedule();
    onCleanup(() => {
      resize.disconnect(); mutations.disconnect(); themeChanges.disconnect();
      panel?.removeEventListener('scroll', trackLayout, true);
      window.removeEventListener('resize', trackLayout);
      window.removeEventListener('focus', trackLayout);
      document.removeEventListener('visibilitychange', trackLayout);
      window.removeEventListener('pointermove', trackDrag);
      if (frame !== undefined) cancelAnimationFrame(frame);
      activeTarget?.removeAttribute('data-orb-active');
    });
  });
  createEffect(() => { props.working; schedule(); });
  return <>
    <span ref={anchor} class="syka-orb-anchor" data-chat-orb-anchor="header" aria-hidden="true" />
    <Portal>
      <span class="syka-shared-chat-orb" data-working={props.working} data-travel={travel()} data-kb-theme={theme()} aria-hidden="true"
        style={{ '--chat-orb-size': `${position().size}px`, transform: `translate3d(${position().x}px,${position().y}px,0)`, opacity: position().visible ? 1 : 0, 'z-index': position().zIndex }}>
        <SykaChatOrb working={props.working && !props.paused} paused={props.paused} />
      </span>
    </Portal>
  </>;
}
