import { describe, expect, it } from 'vitest';
import { judgeFrames, type Drawn, type FrameReading } from './gate-judge';

const W = 480, H = 270, STEP = 0.2;
const plate: Drawn = { stamp: 'plate', box: { minX: 40, minY: 20, maxX: 440, maxY: 250 }, order: 0, text: false };
const caption = (minX = 140): Drawn => ({ stamp: 'caption', box: { minX, minY: 200, maxX: minX + 200, maxY: 230 }, order: 1, text: true });
/** A busy frame: something on screen that keeps moving. */
const frame = (index: number, drawn: Drawn[] = [plate, caption()], overrides: Partial<FrameReading> = {}): FrameReading =>
  ({ content: 0.3, change: index === 0 ? Infinity : 4, drawn, width: W, height: H, ...overrides });
const film = (count: number, at: (index: number) => FrameReading = i => frame(i)) => Array.from({ length: count }, (_, i) => at(i));

describe('film gate', () => {
  it('passes a film where something is always on screen and moving', () => {
    expect(judgeFrames(film(60), STEP, 3)).toEqual([]);
  });

  it('fails an almost empty stretch, like a lone dot at second 21', () => {
    const readings = film(60, i => i >= 20 && i < 24 ? frame(i, [], { content: 0.001 }) : frame(i));
    expect(judgeFrames(readings, STEP, 3)).toEqual([expect.objectContaining({ code: 'empty-frames', severity: 'error', ranges: [{ start: 4, end: 4.8 }] })]);
  });

  it('lets a single dim frame pass: a fade through black is not a gap', () => {
    const readings = film(60, i => i === 10 ? frame(i, [], { content: 0.001 }) : frame(i));
    expect(judgeFrames(readings, STEP, 3)).toEqual([]);
  });

  it('fails a frozen stretch mid-film but allows the final hold', () => {
    const midFreeze = film(60, i => i >= 10 && i < 20 ? frame(i, undefined, { change: 0 }) : frame(i));
    expect(judgeFrames(midFreeze, STEP, 3)).toEqual([expect.objectContaining({ code: 'frozen', ranges: [{ start: 1.8, end: 4 }] })]);
    const finalHold = film(60, i => i >= 50 ? frame(i, undefined, { change: 0 }) : frame(i));
    expect(judgeFrames(finalHold, STEP, 3)).toEqual([]);
  });

  it('fails a button drawn over the typed text, as in second 6', () => {
    const button: Drawn = { stamp: 'send', box: { minX: 280, minY: 195, maxX: 340, maxY: 235 }, order: 2, text: false };
    const readings = film(60, i => i >= 30 && i < 34 ? frame(i, [plate, caption(), button]) : frame(i));
    expect(judgeFrames(readings, STEP, 3)).toEqual([expect.objectContaining({ code: 'text-covered', node: 'caption', other: 'send', ranges: [{ start: 6, end: 6.8 }] })]);
  });

  it('ignores full-frame layers drawn over everything on purpose', () => {
    const grain: Drawn = { stamp: 'grain', box: { minX: 0, minY: 0, maxX: W, maxY: H }, order: 2, text: false };
    expect(judgeFrames(film(60, i => frame(i, [plate, caption(), grain])), STEP, 3)).toEqual([]);
  });

  it('fails text that stays past the edge, not text sliding in', () => {
    const stuck = film(60, i => frame(i, [plate, caption(-60)]));
    expect(judgeFrames(stuck, STEP, 3)).toEqual([expect.objectContaining({ code: 'text-cut', node: 'caption', ranges: [{ start: 0, end: 12 }] })]);
    const sliding = film(60, i => i < 1 ? frame(i, [plate, caption(-60)]) : frame(i));
    expect(judgeFrames(sliding, STEP, 3)).toEqual([]);
  });

  it('warns when the product capture sits small in an empty frame, not when it fills it', () => {
    const card: Drawn = { stamp: 'capture', box: { minX: 200, minY: 110, maxX: 280, maxY: 160 }, order: 0, text: false, picture: true };
    const tiny = film(60, i => frame(i, [card], { content: 0.05 }));
    expect(judgeFrames(tiny, STEP, 3)).toEqual([expect.objectContaining({ code: 'small-subject', severity: 'warning', ranges: [{ start: 0, end: 12 }] })]);
    const pushedIn = film(60, i => frame(i, [{ ...card, box: { minX: 40, minY: 20, maxX: 440, maxY: 250 } }], { content: 0.6 }));
    expect(judgeFrames(pushedIn, STEP, 3)).toEqual([]);
  });

  it('fails two captions laid over each other', () => {
    const next: Drawn = { stamp: 'next', box: { minX: 150, minY: 205, maxX: 330, maxY: 232 }, order: 2, text: true };
    const readings = film(60, i => i >= 40 && i < 43 ? frame(i, [plate, caption(), next]) : frame(i));
    expect(judgeFrames(readings, STEP, 3)).toEqual([expect.objectContaining({ code: 'text-overlap', node: 'caption', other: 'next', ranges: [{ start: 8, end: 8.6 }] })]);
  });
});
