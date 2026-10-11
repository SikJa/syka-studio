export type RetainedSpan = { sourceIn: number; sourceOut: number; timelineStart: number; playbackRate: number };
export type TimedText = { start: number; end: number; text: string };
/** Seconds, half-open intervals. Outputs scene time: don't apply source trim a second time. */
export function captionsAfterRecut(words: TimedText[], spans: RetainedSpan[]) {
  for (const span of spans) {
    if (![span.sourceIn,span.sourceOut,span.timelineStart,span.playbackRate].every(Number.isFinite)
      || span.sourceIn < 0 || span.sourceOut <= span.sourceIn || span.timelineStart < 0 || span.playbackRate <= 0) throw new RangeError('Invalid retained span');
  }
  for (const word of words) {
    if (![word.start,word.end].every(Number.isFinite) || word.start < 0 || word.end <= word.start) throw new RangeError('Invalid caption interval');
  }
  return spans.flatMap(span => words.flatMap(word => {
    const start = Math.max(word.start,span.sourceIn), end = Math.min(word.end,span.sourceOut);
    return end <= start ? [] : [{
      text:word.text, start:span.timelineStart+(start-span.sourceIn)/span.playbackRate,
      end:span.timelineStart+(end-span.sourceIn)/span.playbackRate,
      clipped:start !== word.start || end !== word.end,
    }];
  })).sort((a,b) => a.start-b.start || a.end-b.end);
}
