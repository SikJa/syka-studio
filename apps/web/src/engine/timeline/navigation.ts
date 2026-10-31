import { DEFAULT_TIMELINE_RESOLUTION, TIMELINE_PADDING_LEFT, TIMELINE_RESOLUTION_RANGE } from './config';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const extent = (end: number) => Number.isFinite(end) && end > 0 ? end : 300;
const viewport = (width: number) => Math.max(1, Number.isFinite(width) ? width : 1);

export function fitTimeline(end: number, width: number) {
  const resolution = Math.min(1 / TIMELINE_RESOLUTION_RANGE[0], Math.max(1, viewport(width) - 2 * TIMELINE_PADDING_LEFT) / extent(end));
  return { resolution, scrollX: -TIMELINE_PADDING_LEFT / resolution };
}

/** Leave a little room after the scene, but never pan into an entirely empty timeline. */
export function clampTimelineScroll(scrollX: number, resolution: number, end: number, width: number) {
  const min = -TIMELINE_PADDING_LEFT / resolution;
  const max = Math.max(min, extent(end) - viewport(width) / resolution + viewport(width) * 0.1 / resolution);
  return clamp(Number.isFinite(scrollX) ? scrollX : min, min, max);
}

export function zoomTimeline(resolution: number, scrollX: number, factor: number, anchor: number, width: number, end: number) {
  const old = Number.isFinite(resolution) && resolution > 0 ? resolution : DEFAULT_TIMELINE_RESOLUTION;
  // At most four scene lengths on screen, including very long or very short scenes.
  const min = fitTimeline(end, width).resolution / 4;
  const next = clamp(old * factor, min, 1 / TIMELINE_RESOLUTION_RANGE[0]);
  const x = clamp(anchor, 0, viewport(width));
  const origin = Number.isFinite(scrollX) ? scrollX : -TIMELINE_PADDING_LEFT / old;
  return { resolution: next, scrollX: clampTimelineScroll(origin + x / old - x / next, next, end, width) };
}
