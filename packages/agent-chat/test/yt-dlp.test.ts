import { describe, expect, it } from 'vitest';
import { parseVideoToolJson, VideoToolOutput, YTDLP_METADATA_TEMPLATE } from '../src/host/yt-dlp';

describe('video command JSON output', () => {
  it('does not truncate a JSON response larger than the old reference buffer', () => {
    const value = { title: 'Una charla larga', description: 'x'.repeat(5 * 1024 * 1024), duration: 43200 };
    const output = new VideoToolOutput(true), json = JSON.stringify(value);
    for (let at = 0; at < json.length; at += 65536) output.append(json.slice(at, at + 65536));
    expect(parseVideoToolJson(output.read(), 'metadata')).toEqual(value);
  });
  it('rejects oversized JSON explicitly instead of passing its tail to JSON.parse', () => {
    const output = new VideoToolOutput(true);
    output.append('{"formats":"' + 'x'.repeat(9 * 1024 * 1024) + '"}');
    expect(() => output.read()).toThrow('sin recortar el JSON');
  });
  it('measures UTF-8 bytes and keeps bounded text logs independent of JSON', () => {
    const output = new VideoToolOutput(true, 12);
    output.append('"'); output.append('á'.repeat(6)); output.append('"');
    expect(() => output.read()).toThrow('demasiados metadatos');
    const log = new VideoToolOutput(false, 8);
    log.append('progress:1'); log.append(' finished');
    expect(log.read()).toBe('finished');
  });
  it('reports invalid or mixed output without exposing payloads or claiming login is required', () => {
    for (const raw of ['', '{"partial":', 'progress\n{"duration":1}', 'null', '[]']) {
      expect(() => parseVideoToolJson(raw, 'metadata')).toThrow('metadatos incompletos o inválidos');
    }
    expect(() => parseVideoToolJson('not json https://example.com/private?token=secret', 'probe')).toThrow('No se importó');
    expect(parseVideoToolJson('\uFEFF{"title":"Buen día"}\n', 'metadata')).toEqual({ title: 'Buen día' });
    expect(YTDLP_METADATA_TEMPLATE).not.toMatch(/formats|fragments|requested_downloads|description|entries/);
  });
});
