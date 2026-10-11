import { createSignal } from 'solid-js';
export const [visualPickMode,setVisualPickMode]=createSignal<'element'|'region'|'draw'|'comment'|null>(null);
/** The active project composer owns recording and draft attachment delivery. */
export const SCREEN_RECORDING_REQUEST = 'syka:screen-recording-request';
export function requestScreenRecording(options: {region?:boolean;chatKey:string}) {
  window.dispatchEvent(new CustomEvent(SCREEN_RECORDING_REQUEST,{detail:options,cancelable:true}));
}

export const VISUAL_SELECT_SHORTCUT = 'Ctrl + Shift + S';
export function isVisualSelectShortcut(event: KeyboardEvent) {
  return (event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey
    && !event.repeat && !event.isComposing && event.key.toLowerCase() === 's';
}

export function handleVisualSelectShortcut(event: KeyboardEvent) {
  if (!isVisualSelectShortcut(event)) return false;
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest('[role="dialog"]') && !target.closest('.syka-visual-target-card')) return false;
  event.preventDefault(); event.stopImmediatePropagation();
  setVisualPickMode(visualPickMode() === 'element' ? null : 'element');
  return true;
}
