/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// What the film gate decides from its frame readings. Kept apart from the
// drawing so its thresholds can be tested without a renderer.

import type { GateIssue } from "@diffusionstudio/dapi";

export type Box = { minX: number; minY: number; maxX: number; maxY: number };
export type Drawn = { stamp?: string; box: Box; order: number; text: boolean; /** Painted with an image, video or html: a screenshot, UI, footage. */ picture?: boolean; /** A native text's characters. */ chars?: string };
export type PlanLine = { id: string; text: string; start: number; end: number; layer?: string; margins?: { top: number; bottom: number; left: number; right: number } };
export type FrameReading = {
  /** Share of sampled pixels that differ from the frame's ground colour. */
  content: number;
  /** Mean absolute grey difference from the previous frame, 0–255. */
  change: number;
  drawn: Drawn[];
  width: number;
  height: number;
};

export const area = (box: Box) => Math.max(0, box.maxX - box.minX) * Math.max(0, box.maxY - box.minY);
export const overlap = (a: Box, b: Box) => area({ minX: Math.max(a.minX, b.minX), minY: Math.max(a.minY, b.minY), maxX: Math.min(a.maxX, b.maxX), maxY: Math.min(a.maxY, b.maxY) });

type Run = { start: number; end: number };
/** Index runs where `flag` holds, as [first, last] inclusive. */
function runs(length: number, flag: (index: number) => boolean): Run[] {
  const found: Run[] = [];
  let start = -1;
  for (let i = 0; i <= length; i++) {
    if (i < length && flag(i)) { if (start < 0) start = i; }
    else if (start >= 0) { found.push({ start, end: i - 1 }); start = -1; }
  }
  return found;
}

const wordsOf = (text: string): string[] => Array.from(text.toLocaleLowerCase('es').normalize('NFD').replace(/\p{M}/gu, '').match(/[\p{L}\p{N}]+/gu) ?? []);
/** Share of the frame kept clear on every side for a plan line. */
export const SAFE_MARGIN = 0.05;

/**
 * Each plan line must read whole during its scene: every one of its words on
 * screen in native text at once, and the texts carrying them inside the safe
 * margin. A line spread over several texts (word by word) still counts. A line
 * not found where the plan names no layer may live inside an html component,
 * which the gate cannot read: a warning, not an error. The layer is a hint
 * for that severity only: words found whole in any native text count.
 */
export function judgeLines(readings: FrameReading[], step: number, lines: PlanLine[]): GateIssue[] {
  const issues: GateIssue[] = [];
  for (const line of lines) {
    const wanted = wordsOf(line.text);
    if (!wanted.length) continue;
    let found = false, safe = false;
    readings.forEach((reading, index) => {
      const t = index * step;
      if (safe || t < line.start - 1e-6 || t >= line.end - 1e-6) return;
      const carriers = reading.drawn.filter(item => item.text && item.chars && wordsOf(item.chars).some(word => wanted.includes(word)));
      const shown = new Set(carriers.flatMap(item => wordsOf(item.chars!)));
      if (!wanted.every(word => shown.has(word))) return;
      found = true;
      const m = line.margins ?? { top: SAFE_MARGIN, bottom: SAFE_MARGIN, left: SAFE_MARGIN, right: SAFE_MARGIN };
      const [left, top, right, bottom] = [reading.width * m.left, reading.height * m.top, reading.width * (1 - m.right), reading.height * (1 - m.bottom)];
      if (carriers.every(item => item.box.minX >= left && item.box.minY >= top && item.box.maxX <= right && item.box.maxY <= bottom)) safe = true;
    });
    const range = [{ start: line.start, end: line.end }];
    if (!found) issues.push({ code: 'line-missing', severity: line.layer ? 'error' : 'warning', node: line.layer, message: `The plan line «${line.text}» (${line.id}) never shows whole during its scene. If the screen shows other words, make the plan line and the on-screen text the same (syka_plan escenas); if it lives inside an html component, confirm it with capture.`, ranges: range });
    else if (!safe) issues.push({ code: 'line-unsafe', severity: 'error', node: line.layer, message: `The plan line «${line.text}» (${line.id}) shows, but never inside the ${line.margins ? "recipe's safe zone (kept clear for the app's buttons and captions)" : `${SAFE_MARGIN * 100}% safe margin`}: move it in from the edge.`, ranges: range });
  }
  return issues;
}

/**
 * Turns the frame readings into issues. Exported for tests: the thresholds
 * are the gate's contract, independent of how frames are drawn.
 */
export function judgeFrames(readings: FrameReading[], step: number, finalHold: number, stillMax = 1.6): GateIssue[] {
  const issues: GateIssue[] = [];
  const at = (index: number) => Math.round(index * step * 1000) / 1000;
  const span = (run: Run) => ({ start: at(run.start), end: at(run.end + 1) });
  const long = (run: Run, seconds: number) => (run.end - run.start + 1) * step >= seconds - 1e-6;
  const last = readings.length - 1;

  const empty = runs(readings.length, i => readings[i]!.content < 0.003).filter(run => long(run, 0.4));
  if (empty.length) issues.push({ code: "empty-frames", severity: "error", message: `Almost nothing on screen in ${empty.length} stretch${empty.length === 1 ? "" : "es"}: fill them or cut them.`, ranges: empty.map(span) });

  const still = runs(readings.length, i => i > 0 && readings[i]!.change < 0.2)
    .map(run => ({ start: run.start - 1, end: run.end }))
    .filter(run => run.end === last ? (run.end - run.start + 1) * step > Math.max(finalHold, stillMax) + 1e-6 : long(run, stillMax));
  if (still.length) issues.push({ code: "frozen", severity: "error", message: "The whole frame stands still too long: give it a move or shorten the hold.", ranges: still.map(span) });

  // The product shown as a small card in the middle of a bare frame reads as
  // unfinished: the camera should push in or the picture grow.
  const small = runs(readings.length, i => {
    const reading = readings[i]!;
    const pictures = reading.drawn.filter(item => item.picture);
    return pictures.length > 0 && reading.content < 0.35 && Math.max(...pictures.map(item => area(item.box))) < reading.width * reading.height * 0.12;
  }).filter(run => long(run, 1.5));
  if (small.length) issues.push({ code: "small-subject", severity: "warning", message: "The picture fills under 12% of a mostly empty frame: push the camera in or enlarge it. A small logo or icon on purpose may stay; say so.", ranges: small.map(span) });

  // Per text, the frames where it is cut, covered or overlapped, keyed so a
  // stretch reads as one issue.
  const marks = new Map<string, { code: GateIssue["code"]; node?: string; other?: string; frames: number[] }>();
  const mark = (code: GateIssue["code"], frame: number, node?: string, other?: string) => {
    const key = `${code}|${node}|${other}`;
    const entry = marks.get(key) ?? { code, node, other, frames: [] };
    entry.frames.push(frame);
    marks.set(key, entry);
  };
  readings.forEach((reading, frame) => {
    const canvasArea = reading.width * reading.height;
    for (const text of reading.drawn.filter(item => item.text)) {
      const box = text.box, size = area(box);
      const inside = overlap(box, { minX: 0, minY: 0, maxX: reading.width, maxY: reading.height });
      if (size > 0 && inside / size < 0.96) mark("text-cut", frame, text.stamp);
      for (const above of reading.drawn) {
        if (above.order <= text.order || above.stamp === text.stamp) continue;
        const shared = overlap(box, above.box);
        if (!shared) continue;
        if (above.text) { if (shared / Math.min(size, area(above.box)) >= 0.3) mark("text-overlap", frame, text.stamp, above.stamp); }
        // Full-frame layers (grain, vignettes, light) sit over everything on purpose.
        else if (area(above.box) < canvasArea * 0.6 && shared / size >= 0.25) mark("text-covered", frame, text.stamp, above.stamp);
      }
    }
  });
  for (const entry of marks.values()) {
    const set = new Set(entry.frames);
    const found = runs(readings.length, i => set.has(i)).filter(run => long(run, entry.code === "text-cut" ? 0.4 : 0.3));
    if (!found.length) continue;
    const message = entry.code === "text-cut" ? "Text runs past the edge of the frame while it is on screen."
      : entry.code === "text-covered" ? "An element drawn over this text hides part of it."
      : "Two texts sit on top of each other.";
    issues.push({ code: entry.code, severity: "error", message, ...(entry.node ? { node: entry.node } : {}), ...(entry.other ? { other: entry.other } : {}), ranges: found.map(span) });
  }
  return issues;
}
