import { describe, expect, it, vi } from 'vitest';
vi.hoisted(() => {
  globalThis.DOMMatrix = class {} as typeof DOMMatrix;
  globalThis.HTMLCanvasElement = class {} as typeof HTMLCanvasElement;
  globalThis.HTMLElement = class {} as typeof HTMLElement;
  globalThis.Element = class {} as typeof Element;
  globalThis.HTMLImageElement = class {} as typeof HTMLImageElement;
});
import { ANIMATION_TYPES } from '@diffusionstudio/reconciler';
import { AnimationType } from '@diffusionstudio/runtime';
import { ANIMATION_GROUPS, animationOption, DEFAULT_ANIMATION } from './animation-types';

describe('editor and JSX share the native softRise preset', () => {
  it('is selectable for text and cards and reads back the same option identity', () => {
    const group = ANIMATION_GROUPS.find(g => g.options.some(o => o.name === 'softRise'))!;
    const option = group.options.find(o => o.name === 'softRise')!;
    expect(group.kind).toBeUndefined();
    expect(ANIMATION_TYPES[option.name]).toBe(AnimationType.SOFT_RISE);
    expect(animationOption(AnimationType.SOFT_RISE)).toBe(option);
    expect(option.label).toBe('Subida suave');
    expect(DEFAULT_ANIMATION.name).toBe('fade');
  });
});
