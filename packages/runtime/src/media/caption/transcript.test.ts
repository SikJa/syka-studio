import { describe, expect, it } from 'vitest';
import { parseTranscriptJson } from './transcript';

const segments = [{ text: 'hola', words: [{ text: 'hola', start: 1.2, end: 1.46 }] }];
describe('caption transcript JSON compatibility', () => {
  it('accepts media_transcribe output without changing real timestamps', () => {
    expect(parseTranscriptJson(JSON.stringify({ segments }))).toEqual(segments);
  });
  it('preserves native transcript arrays', () => {
    expect(parseTranscriptJson(JSON.stringify(segments))).toEqual(segments);
  });
  it.each([{}, { segments: [{}] }, { segments: [{ text: 'bad', words: [{ text: 'bad', start: 2, end: 1 }] }] }])('rejects malformed timing data %j', value => {
    expect(() => parseTranscriptJson(JSON.stringify(value))).toThrow();
  });
});
