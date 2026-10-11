import {describe,it,expect} from 'vitest';
import {previewBounds,previewClock,previewTimecode} from './transport-model';
describe('preview limits and time display', () => {
  it('avoids the blank exclusive end and respects a trimmed workarea', () => {
    expect(previewBounds(681)).toEqual({start:0,last:680});
    expect(previewBounds(681,{start:60,end:180})).toEqual({start:60,last:179});
    expect(previewBounds(681,{start:0,end:900})).toEqual({start:0,last:680});
    expect(previewBounds(0)).toEqual({start:0,last:0});
  });
  it('uses the real frame rate and carries minutes/hours', () => {
    expect(previewTimecode(681,60)).toBe('00:00:11:21');
    expect(previewTimecode(108000,30)).toBe('01:00:00:00');
    expect(previewTimecode(65,30)).toBe('00:00:02:05');
    expect(previewTimecode(-1,30)).toBe('00:00:00:00');
  });
  it('keeps elapsed and total hours visible for long videos', () => {
    expect(previewClock(65,30,210)).toBe('00:02');
    expect(previewClock(30,30,108000)).toBe('00:00:01');
    expect(previewClock(108000,30,108000)).toBe('01:00:00');
    expect(previewClock(30*3600*12,30,30*3600*12)).toBe('12:00:00');
  });
});
