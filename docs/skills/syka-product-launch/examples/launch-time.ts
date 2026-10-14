/** Pure composition-clock states. No timers, accumulated progress or random frames. */
const unit = (time: number, at: number, duration: number) => Math.max(0, Math.min(1, (time - at) / Math.max(.001, duration)));
const smooth = (v: number) => v * v * (3 - 2 * v);
export function demoState(time: number, revealAt = 1.2, reduced = false) {
  const reveal = reduced ? 1 : smooth(unit(time, revealAt, .45));
  return { before: 1 - reveal, after: reveal, progress: reveal };
}
export function focusState(time: number, clickAt = .9, reduced = false) {
  const arrive = reduced ? 1 : 1 - Math.pow(1 - unit(time, 0, .65), 4);
  const pulse = reduced ? 0 : Math.sin(Math.PI * unit(time, clickAt, .28));
  return { arrive, pulse, cursorVisible: !reduced };
}
export function coverLight(time: number, ambient = true, reduced = false) {
  return ambient && !reduced ? { x: 50 + Math.sin(time * Math.PI / 3) * 12, opacity: .11 + Math.sin(time * Math.PI / 3) * .025 } : { x: 50, opacity: .11 };
}
