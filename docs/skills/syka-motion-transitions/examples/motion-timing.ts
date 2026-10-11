/** Seconds on a sourceless clip clock; each requested value is finite and nonnegative. */
export function revealTiming(duration: number, enter = 0.5, exit = 0.2) {
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(enter) || enter < 0 || !Number.isFinite(exit) || exit < 0) {
    throw new RangeError('Use a positive duration and nonnegative finite enter/exit times');
  }
  // Preserve a readable middle instead of letting entrance and exit overlap.
  const requested = enter + exit;
  const factor = requested > 0 ? Math.min(1, duration * 0.6 / requested) : 1;
  const inEnd = enter * factor;
  const outStart = duration - exit * factor;
  return { inEnd, outStart, duration };
}
