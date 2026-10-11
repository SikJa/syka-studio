import { describe, expect, it } from 'vitest';
import { canAdopt, detectFormat, formatOutput, parseDecision, planAdaptation, PRESETS, type LayoutNode } from './model';
const auto = { version: 1 as const, mode: 'auto' as const, provenance: 'first-media' as const, destination: 'none' as const, revision: 0, awaitingFirstMedia: true };
const node = (tag: string, props = {}, children: LayoutNode[] = []): LayoutNode => ({ id: tag, tag, props, children });
describe('source metadata and decisions', () => {
  it('recognizes all ratios and nearby display dimensions without guessing editorial intent', () => {
    for (const [ratio, size] of Object.entries(PRESETS)) expect(detectFormat(size)?.ratio).toBe(ratio);
    expect(detectFormat({ width: 1088, height: 1920 })?.ratio).toBe('9:16');
    expect(detectFormat({ width: 1000, height: 700 })?.ratio).toBe('custom');
    expect(formatOutput('scene', PRESETS['9:16']).destination).toBe('none');
  });
  it('rotates raw dimensions once, never double-rotates display metadata', () => {
    for (const rotation of [90, 270, -90]) expect(detectFormat({ width: 1920, height: 1080, rotation })?.ratio).toBe('9:16');
    expect(detectFormat({ width: 1080, height: 1920, rotation: 90, dimensionsAreDisplay: true })?.ratio).toBe('9:16');
    expect(detectFormat({ width: 1920, height: 1080, displayWidth: 1080, displayHeight: 1920, rotation: 90 })?.ratio).toBe('9:16');
    expect(detectFormat({ width: 1920, height: 1080, rotation: 180 })?.ratio).toBe('16:9');
  });
  it('does not invent missing or invalid metadata', () => {
    for (const value of [{}, { width: 0, height: 1080 }, { width: NaN, height: 12 }, { width: 100, height: Infinity }]) expect(detectFormat(value)).toBeUndefined();
  });
  it('only adopts the first visual in an explicitly eligible new scene', () => {
    expect(canAdopt(auto, 0)).toBe(true);
    expect(canAdopt(undefined, 0)).toBe(false);
    expect(canAdopt({ ...auto, mode: 'manual' }, 0)).toBe(false);
    expect(canAdopt(auto, 1)).toBe(false);
    expect(canAdopt({ ...auto, awaitingFirstMedia: false }, 0)).toBe(false);
  });
  it('roundtrips the decision, source and destination without secrets', () => {
    const decision = { ...auto, source: detectFormat({ width: 1920, height: 1080, duration: 12 }) };
    expect(parseDecision(JSON.stringify(decision))).toEqual(decision);
    expect(parseDecision('{bad')).toBeUndefined();
    expect(parseDecision(JSON.stringify({ ...auto, revision: -1 }))).toBeUndefined();
  });
});
describe('native layout planning', () => {
  const source = PRESETS['16:9'], target = PRESETS['9:16'];
  it('fits or fills video uniformly and never edits synchronization or media references', () => {
    const nodes = [node('rect', { width: 1920, height: 1080, start: 3, duration: 5 }, [node('videoPaint', { src: 'source.mp4' })])];
    const before = JSON.stringify(nodes);
    const fit = planAdaptation(source, target, nodes).changes[0].props;
    expect(Number(fit.width) / Number(fit.height)).toBeCloseTo(16 / 9);
    expect(fit.width).toBe(1080);
    const fill = planAdaptation(source, target, nodes, 'fill').changes[0].props;
    expect(fill.height).toBe(1920); expect(Number(fill.x)).toBeLessThan(0);
    expect(Object.keys(fill).sort()).toEqual(['height','width','x','y']);
    expect(JSON.stringify(nodes)).toBe(before);
  });
  it('reflows text and keeps smaller images/logos in the reading area', () => {
    const plan = planAdaptation(source, target, [node('text', { width: 1500, height: 120, fontSize: 70, y: 900 }), node('rect', { x: 1700, y: 30, width: 140, height: 140 }, [node('imagePaint')])]);
    const text = plan.changes[0].props, logo = plan.changes[1].props;
    expect(text.fontSize).toBeGreaterThanOrEqual(27);
    expect(Number(text.y) + Number(text.height)).toBeLessThanOrEqual(target.height * .85);
    expect(logo.width).toBe(logo.height);
    expect(Number(logo.x) + Number(logo.width)).toBeLessThanOrEqual(target.width * .93);
  });
  it('preserves animated/complex layouts and audio, explicitly warning about unsupported content', () => {
    const plan = planAdaptation(source, target, [node('group'), node('rect', { width: 20, height: 20 }, [node('animation')]), node('audio', { start: 2 }), node('captions', { src: 'transcript.json', offset: 2 })]);
    expect(plan.warnings).toHaveLength(3);
    expect(plan.changes).toEqual([]);
  });
  it('keeps loaded native captions within the reading area', () => {
    const plan = planAdaptation(source, target, [{ ...node('captions', { src: 'captions.json' }), bounds: { width: 1200, height: 180 } }]);
    const p = plan.changes[0].props;
    expect(Number(p.scale) * 1200).toBeLessThanOrEqual(target.width * .86);
    expect(Number(p.y) + 90 + 90 * Number(p.scale)).toBeCloseTo(target.height * .85);
  });
  it('changing only the destination leaves the composition untouched', () => {
    expect(planAdaptation(source, source, [node('text', { x: 150, y: 30, width: 300, height: 80 })]).changes).toEqual([]);
  });
  it('rejects invalid custom dimensions', () => { expect(() => planAdaptation(source, { width: 0, height: 3 }, [])).toThrow(); });
});
