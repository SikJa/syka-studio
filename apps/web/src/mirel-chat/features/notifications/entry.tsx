/** @jsxImportSource react */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { mainBridge } from '@/lib/ipc';
import { MAIN_CHANNELS } from '@desktop/main-channels';
import { accentTokens } from '@/lib/appearance/color';
import { Notification } from './notification';
import type { NoticeCommand, NoticeRegion, NoticeSnapshot } from '../../../../../../packages/agent-chat/src/notifications';
import './notifications.css';
import './notifications-window.css';

const command = (data: NoticeCommand) => mainBridge.call(MAIN_CHANNELS.SYKA_NOTIFICATIONS, data);
const sound = new Audio(new URL(location.protocol === 'file:' ? 'syka-notice.wav' : '/syka-notice.wav', window.location.href).href);
sound.preload = 'auto';
// The packaged page sits next to the shipped public asset (no machine paths).
if (location.protocol === 'file:') sound.src = new URL('syka-notice.wav', location.href).href;


function Notifications() {
  const [state, setState] = useState<NoticeSnapshot>({ notices: [], accent: '#008cff', sound: true });
  const stack = useRef<HTMLDivElement>(null), seen = useRef(new Set<string>()), lastSound = useRef(0);
  useLayoutEffect(() => {
    if (document.activeElement?.closest('.quick-body')) return;
    const frame = requestAnimationFrame(() => { if (stack.current) stack.current.scrollTop = stack.current.scrollHeight; });
    return () => cancelAnimationFrame(frame);
  }, [state.notices.length]);
  useEffect(() => {
    let disposed = false, current = 0;
    const apply = (data: NoticeSnapshot) => {
      if (disposed) return;
      current++;
      const fresh = data.notices.some(n => !seen.current.has(n.id));
      for (const notice of data.notices) seen.current.add(notice.id);
      while (seen.current.size > 1000) seen.current.delete(seen.current.values().next().value!);
      for (const [key, value] of Object.entries(accentTokens(data.accent, true))) document.documentElement.style.setProperty(key, value);
      setState(data);
      if (fresh && data.sound && Date.now() - lastSound.current >= 10_000 && localStorage.getItem('syka:chat-question-sound') !== 'off') { lastSound.current = Date.now(); sound.currentTime = 0; void sound.play().catch(console.error); }
    };
    const off = mainBridge.handle(MAIN_CHANNELS.SYKA_NOTICES_CHANGED, apply);
    const revision = current;
    void command({ action: 'list' }).then(data => { if (current === revision) apply(data); }).catch(console.error);
    let interactive = false;
    const pointer = (event: MouseEvent) => {
      const target = document.elementFromPoint(event.clientX, event.clientY);
      const next = !!target?.closest('.quick-bubble, .floating-orb');
      if (next !== interactive) { interactive = next; void command({ action: 'interactive', value: next }).catch(console.error); }
    };
    const leave = () => { interactive = false; void command({ action: 'interactive', value: false }).catch(console.error); };
    document.addEventListener('mousemove', pointer); document.addEventListener('mousedown', pointer); document.addEventListener('mouseleave', leave);
    document.addEventListener('pointermove', pointer); document.addEventListener('pointerdown', pointer);
    // A reload/HMR can happen while the native window is still interactive.
    leave();
    return () => { disposed = true; off(); sound.pause(); document.removeEventListener('mousemove', pointer); document.removeEventListener('mousedown', pointer); document.removeEventListener('mouseleave', leave); document.removeEventListener('pointermove', pointer); document.removeEventListener('pointerdown', pointer); leave(); };
  }, []);
  useLayoutEffect(() => {
    const element = stack.current;
    if (!element) return;
    let previous = '', frame = 0, settleUntil = 0;
    const fit = () => {
      frame = 0;
      const regions: NoticeRegion[] = [];
      const clip = element.getBoundingClientRect();
      for (const node of element.querySelectorAll<HTMLElement>('.quick-bubble, .floating-orb, .notice-badge')) {
        const rect = node.getBoundingClientRect();
        if (rect.bottom <= clip.top || rect.top >= clip.bottom) continue;
        const padding = node.matches('.quick-bubble') ? 5 : 2;
        const x = Math.max(0, rect.left - padding), y = Math.max(clip.top, rect.top - padding);
        const right = Math.min(innerWidth, rect.right + padding), bottom = Math.min(clip.bottom, rect.bottom + padding);
        regions.push({ x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y),
          radius: node.matches('.floating-orb') ? 0 : (parseFloat(getComputedStyle(node).borderRadius) || 0) + padding });
      }
      if (element.scrollHeight > element.clientHeight + 1) regions.push({ x: clip.right - 9, y: clip.top, width: 9, height: clip.height, radius: 3 });
      const payload: NoticeCommand = { action: 'layout', width: 370, height: Math.ceil(element.scrollHeight) + 18, regions };
      const key = JSON.stringify(payload);
      if (key !== previous) { previous = key; void command(payload).catch(console.error); }
      // Sample only during arrival/resize transitions. No idle polling.
      if (performance.now() < settleUntil) frame = requestAnimationFrame(fit);
    };
    const schedule = () => { settleUntil = performance.now() + 500; if (!frame) frame = requestAnimationFrame(fit); };
    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    const observe = () => { for (const row of element.children) observer.observe(row); schedule(); };
    const changes = new MutationObserver(observe); changes.observe(element, { childList: true }); observe();
    element.addEventListener('scroll', schedule, { passive: true });
    element.addEventListener('transitionrun', schedule);
    window.addEventListener('resize', schedule);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); changes.disconnect(); element.removeEventListener('scroll', schedule); element.removeEventListener('transitionrun', schedule); window.removeEventListener('resize', schedule); };
  }, []);
  return <div className="notice-stack" ref={stack} role="region" aria-label="Avisos de Syka Studio">{state.notices.map(notice => <Notification key={notice.id} notice={notice}/>)}</div>;
}
createRoot(document.getElementById('syka-notices')!).render(<Notifications/>);
