/** Pure scene time: the same timestamp has the same pose, including backwards seeks. */
export const clamp = (x: number) => Math.max(0, Math.min(1, x));
export const phase = (t: number, at: number, duration: number) => clamp((t - at) / Math.max(.001, duration));
export const out = (x: number) => 1 - Math.pow(1 - clamp(x), 4);
export const smooth = (x: number) => { const p = clamp(x); return p * p * (3 - 2 * p); };
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const visible = (t: number, duration: number) => phase(t, 0, .24) * (1 - phase(t, duration - .3, .3));
/** A fast sweep then a readable hold. Progress is continuous at cycle boundaries. */
export const carouselProgress = (t: number, secondsPerCard = 2.2) => {
  const progress = Math.max(0, t) / Math.max(.25, secondsPerCard);
  const whole = Math.floor(progress);
  return whole + smooth(phase(progress - whole, .08, .36));
};
