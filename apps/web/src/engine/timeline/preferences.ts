import { createSignal } from 'solid-js';

const KEY = 'syka.timeline.snapping';
function readSnapping(): boolean {
	try { return globalThis.localStorage?.getItem(KEY) !== 'false'; } catch { return true; }
}
const [enabled, setEnabled] = createSignal(readSnapping());
export const timelineSnapping = enabled;
export function setTimelineSnapping(value: boolean): void {
	setEnabled(value);
	try { globalThis.localStorage?.setItem(KEY, String(value)); } catch { /* Session preference still works. */ }
}
