type Beat = { id: string; start: number; end: number; holdStart: number; holdEnd: number; copy: string[]; review: string[] };
type Event = { id: string; plannedSeconds: number; kind: string; weight?: string; nativeAnchor: unknown };
/** Review points are derived from the shared beat map, never a fixed three-second interval. */
export function motionReviewSchedule(beats: Beat[], events: Event[], duration: number, fps: number) {
  const last = Math.max(0, duration - 1 / fps);
  const bounded = (time: number) => Math.round(Math.max(0, Math.min(last, time)) * fps) / fps;
  const reading = beats.filter(beat => beat.copy.length).map(beat => {
    const words = beat.copy.join(' ').trim().split(/\s+/).length;
    return { beat: beat.id, seconds: bounded((beat.holdStart + beat.holdEnd) / 2), holdSeconds: beat.holdEnd - beat.holdStart,
      suggestedMinimumSeconds: Math.round((.35 + words / 3) * 100) / 100, heuristic: true };
  });
  const anchors = events.filter(event => event.kind === 'sfx' || event.kind === 'review' || event.kind === 'visual')
    .map(event => ({ id: event.id, seconds: bounded(event.plannedSeconds), priority: event.weight === 'hero' ? 3 : event.kind === 'review' ? 2 : 1, hasNativeAnchor: Boolean(event.nativeAnchor), timingEvidence: 'planned' }))
    .sort((a, b) => b.priority - a.priority || a.seconds - b.seconds);
  const transitions = beats.filter(beat => beat.holdEnd < beat.end).map(beat => ({ beat: beat.id, seconds: bounded((beat.holdEnd + beat.end) / 2) }));
  const focusTime = anchors[0]?.seconds ?? transitions[0]?.seconds ?? bounded(duration / 2);
  const readingTimes = [...new Set(reading.map(row => row.seconds))].slice(0, 12);
  return {
    timebase: 'composition-seconds', detail: 'standard', focusTime, readingTimes,
    events: anchors.slice(0, 12), opening: 0, closing: bounded(last),
    coverage: { totalBeats: beats.length, totalEvents: anchors.length, selectedEvents: Math.min(12, anchors.length), omittedEvents: Math.max(0, anchors.length - 12),
      totalReadingBeats: reading.length, selectedReadingTimes: readingTimes.length, omittedReadingBeats: reading.filter(row => !readingTimes.includes(row.seconds)).length,
      totalTransitions: transitions.length, omittedTransitions: Math.max(0, transitions.length - 12) },
    reading, transitions: transitions.slice(0, 12),
    note: 'Planned checkpoints, not inspection. Resolve event IDs with motion_events after retiming; subtract the real export origin from focus/reading, pass exportStartSeconds for event mapping. Review remaining risky beats in another targeted pass when coverage is incomplete.',
    playbackContract: { version: 1, clock: 'native-scene', seekSequence: [0, focusTime, bounded(last), focusTime, readingTimes[0] ?? bounded(duration / 3)],
      checks: ['Same time yields the same frame regardless of seek order; seeded random and ready fonts/assets.', 'Pause/resume reanchors audio without doubled buffers; inactive preview/unmount releases its own clocks and media.', 'Retiming preserves measured audio attacks, trim, playback rate and native event IDs.', 'Final frame and audio tail match the intended ending; no unintended repeat or live wall-clock animation.'],
      status: 'needs_runtime_evidence', sourceExportCorrespondence: 'unverified' },
  };
}
