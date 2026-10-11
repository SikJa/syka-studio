/** Duration/end is exclusive: never seek to an empty last frame. */
export function previewBounds(duration: number, workarea?: { start: number; end: number }) {
  const end = Math.max(0, Math.round(Number.isFinite(duration) ? duration : 0));
  const start = Math.min(end, Math.max(0, Math.round(workarea?.start ?? 0)));
  const exclusiveEnd = Math.min(end, Math.max(start, Math.round(workarea?.end ?? end)));
  return { start, last: Math.max(start, exclusiveEnd - 1) };
}
export function previewTimecode(frame: number, fps: number) {
  const rate = Number.isFinite(fps) && fps > 0 ? fps : 30;
  const seconds = Math.max(0, frame) / rate;
  const whole = Math.floor(seconds);
  const subframe = Math.min(Math.ceil(rate) - 1, Math.floor((seconds - whole) * rate + 1e-6));
  return [Math.floor(whole / 3600), Math.floor(whole / 60) % 60, whole % 60, subframe]
    .map(value => String(value).padStart(2, '0')).join(':');
}

/** Keep hours visible for long source videos, using the same width for elapsed/total. */
export function previewClock(frame: number, fps: number, duration: number) {
  const elapsed = previewTimecode(frame, fps).split(':');
  const total = previewTimecode(duration, fps).split(':');
  return elapsed.slice(Number(elapsed[0]) > 0 || Number(total[0]) > 0 ? 0 : 1, 3).join(':');
}
