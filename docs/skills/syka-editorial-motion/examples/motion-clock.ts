// Pure scene-time motion. Seeking backwards never depends on previous frames.
export const unit = (time: number, at: number, duration: number) =>
  Math.max(0, Math.min(1, (time - at) / Math.max(.001, duration)));
export const smooth = (value: number) => value * value * (3 - 2 * value);
export const arrive = (value: number) => value === 1 ? 1 : 1 - Math.pow(1 - value, 4);
export const mix = (from: number, to: number, progress: number) => from + (to - from) * progress;
export const visibility = (time: number, duration: number, reduced = false) =>
  unit(time, 0, reduced ? .12 : .22) * (1 - unit(time, duration - .32, .32));
