import { describe, expect, it } from 'vitest';
import type { LocalVoiceModel } from './assets';
import type { Parakeet } from './parakeet';
import { WHISPER_GGUF, WhisperAsr } from './whisper-asr';

/** A stand-in for one syka-asr model: installed or not, with segment-level results like Whisper's. */
function fake(installed: boolean) {
  const calls: string[] = [];
  const model = {
    ready: installed, calls,
    status: () => ({ engineReady: true, installed, download: null, error: null, device: null, cpuFallback: false, state: 'stopped', vocabulary: null, source: installed ? 'syka' : null, location: null, scanning: false }),
    discover: async () => undefined, startDownload: () => calls.push('download'), cancelDownload: () => undefined, remove: async () => { calls.push('remove'); },
    warmup: () => calls.push('warmup'), stop: () => calls.push('stop'),
    transcribe: async () => ({ text: 'hola mundo', words: [{ text: 'hola mundo', start_ms: 0, end_ms: 1500 }], language: 'es', wordLevel: false, audioMs: 1500, ms: 10 }),
  };
  return model as unknown as Parakeet & { calls: string[] };
}

function setup(installed: Partial<Record<LocalVoiceModel, boolean>>) {
  const models = { base: fake(!!installed.base), small: fake(!!installed.small), turbo: fake(!!installed.turbo) };
  let saved: LocalVoiceModel | null = null;
  const whisper = new WhisperAsr({ dir: 'x', roots: () => [], settings: { load: async () => saved, save: async model => { saved = model; } }, make: model => models[model] });
  return { whisper, models, saved: () => saved };
}

describe('WhisperAsr (Mac and Linux)', () => {
  it('uses the chosen model when installed, otherwise another one', async () => {
    const { whisper, saved } = setup({ base: true });
    expect(whisper.readyModel()).toBe('base');
    expect(whisper.status()).toMatchObject({ supported: true, preferred: 'small', readyModel: 'base' });
    expect(whisper.status().models.map(model => model.sizeBytes)).toEqual([WHISPER_GGUF.base.sizeBytes, WHISPER_GGUF.small.sizeBytes, WHISPER_GGUF.turbo.sizeBytes]);
    await whisper.choose('turbo');
    expect(saved()).toBe('turbo');
  });

  it('dictates with segment times, and sends captions to Parakeet instead of inventing word times', async () => {
    const { whisper } = setup({ small: true });
    await expect(whisper.transcribe({ audio: new Uint8Array(64), durationMs: 1500, language: 'es', words: false })).resolves.toMatchObject({ text: 'hola mundo' });
    await expect(whisper.transcribe({ audio: new Uint8Array(64), durationMs: 1500, language: null, words: true })).rejects.toThrow('usá Parakeet');
  });

  it('downloads one model at a time and deletes only the one asked', async () => {
    const { whisper, models } = setup({ base: true });
    whisper.startDownload('small');
    expect(models.small.calls).toEqual(['download']);
    await whisper.deleteModel('base');
    expect(models.base.calls).toEqual(['remove']);
    expect(models.turbo.calls).toEqual([]);
  });
});
