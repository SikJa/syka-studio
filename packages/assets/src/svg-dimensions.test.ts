import { describe, expect, it } from 'vitest';
import { svgDimensions } from './svg-dimensions';

describe('SVG intrinsic dimensions', () => {
  it('uses viewBox for icon exports in relative em and percent units', () => {
    expect(svgDimensions('1em', '1em', '0 0 24 24')).toEqual({ width: 24, height: 24 });
    expect(svgDimensions('100%', '100%', '0,0,120,60')).toEqual({ width: 120, height: 60 });
  });
  it('preserves explicit pixel size and infers a missing dimension from aspect ratio', () => {
    expect(svgDimensions('240px', null, '0 0 24 12')).toEqual({ width: 240, height: 120 });
    expect(svgDimensions(null, '60', '0 0 24 12')).toEqual({ width: 120, height: 60 });
    expect(svgDimensions('200', '50', '0 0 24 12')).toEqual({ width: 200, height: 50 });
  });
  it('converts physical units to CSS pixels', () => {
    expect(svgDimensions('1in', '72pt', null)).toEqual({ width: 96, height: 96 });
  });
  it('rejects invalid or nonpositive geometry instead of inserting a broken box', () => {
    expect(svgDimensions('-1', 'NaN', '0 0 -24 0')).toEqual({ width: 300, height: 150 });
  });
});
