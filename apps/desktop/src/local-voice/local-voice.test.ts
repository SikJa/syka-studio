import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ModelAsset, RuntimeAsset } from './assets';
import { LocalVoice, timedWords } from './local-voice';
import { buildZip } from './test-zip';
import { audioContextFor, WhisperServer, type ServerProcess, type WhisperServerDeps } from './whisper-server';

const dirs: string[] = [];
afterEach(async () => { for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true }); });
const temp = async () => { const dir = await mkdtemp(join(tmpdir(), 'syka-local-voice-')); dirs.push(dir); return dir; };
const sha = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');
const bytes = (text: string) => new TextEncoder().encode(text);

function fakeProcess(): ServerProcess & { killed: boolean } {
  const handlers: Record<string, (...args: never[]) => void> = {};
  const process = {
    pid: 4242, stdout: { on: () => undefined }, stderr: { on: () => undefined }, killed: false,
    once: (event: string, listener: (...args: never[]) => void) => { handlers[event] = listener; return process; },
    kill: () => { process.killed = true; (handlers.close as ((code: number, signal: null) => void) | undefined)?.(0, null); return true; },
  };
  return process as never;
}

function server(fetcher: typeof fetch, spawned: string[][] = []): WhisperServer {
  const deps: WhisperServerDeps = {
    spawn: (command, args) => { spawned.push([command, ...args]); return fakeProcess(); },
    fetch: fetcher, freePort: async () => 9911,
    timers: { set: () => 1, clear: () => undefined }, wait: async () => undefined, now: () => 0,
    threads: 4, idleMs: 1000, startTimeoutMs: 1000, requestTimeoutMs: 1000, pollMs: 1, log: () => undefined,
  };
  return new WhisperServer(deps);
}

describe('timedWords', () => {
  it('keeps one timed word per segment and drops non-speech marks', () => {
    expect(timedWords({ text: ' hola mundo', segments: [{ text: ' hola', start: 0, end: 0.4 }, { text: '[BLANK_AUDIO]', start: 0.4, end: 1 }, { text: ' mundo.', start: 1, end: 0.9 }] }))
      .toEqual([{ word: 'hola', start: 0, end: 0.4 }, { word: 'mundo.', start: 1, end: 1 }]);
    expect(() => timedWords({ text: 'x' })).toThrow('tiempos por palabra');
  });
});

describe('WhisperServer', () => {
  it('starts once, asks for one word per segment for captions and plain text for dictation', async () => {
    const forms: FormData[] = [];
    const spawned: string[][] = [];
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/health')) return new Response('{}', { status: 200 });
      forms.push(init!.body as FormData);
      return new Response(JSON.stringify({ text: 'hola', segments: [] }), { status: 200 });
    });
    const whisper = server(fetcher as never, spawned);
    await whisper.transcribe('C:/w/whisper-server.exe', 'C:/w/model.bin', { audio: new Uint8Array(64), durationMs: 5000, language: 'es', words: true, prompt: 'Syka' });
    await whisper.transcribe('C:/w/whisper-server.exe', 'C:/w/model.bin', { audio: new Uint8Array(64), durationMs: 5000, language: null, words: false });
    expect(spawned).toEqual([['C:/w/whisper-server.exe', '-m', 'C:/w/model.bin', '--host', '127.0.0.1', '--port', '9911', '-t', '4']]);
    expect([forms[0]!.get('response_format'), forms[0]!.get('max_len'), forms[0]!.get('split_on_word'), forms[0]!.get('language'), forms[0]!.get('prompt')]).toEqual(['verbose_json', '1', 'true', 'es', 'Syka']);
    expect([forms[1]!.get('response_format'), forms[1]!.get('language'), forms[1]!.get('audio_ctx')]).toEqual(['json', 'auto', String(audioContextFor(5000))]);
    expect(whisper.state).toBe('running');
    whisper.stop();
    expect(whisper.state).toBe('stopped');
  });
});

describe('LocalVoice', () => {
  it('downloads the server and a model verified, then deletes both with the last model', async () => {
    const dir = await temp();
    const zip = buildZip([{ path: 'Release/whisper-server.exe', data: bytes('exe'), deflate: true }, { path: 'Release/bench.exe', data: bytes('no'), deflate: false }]);
    const model = bytes('model-bytes');
    const runtime: RuntimeAsset = { url: 'https://x/zip', sha256: sha(zip), sizeBytes: zip.length, folder: 'whisper-test', keep: /^whisper-server\.exe$/ };
    const asset = (data: Uint8Array): ModelAsset => ({ url: 'https://x/model', sha256: sha(data), sizeBytes: data.length, file: 'ggml-test.bin' });
    const fetcher = vi.fn(async (url: string) => new Response(url.endsWith('zip') ? zip : model, { status: 200 }));
    const local = new LocalVoice({ dir, server: server(fetcher as never), fetch: fetcher as never, platform: 'win32', runtime,
      models: { base: asset(model), small: { ...asset(model), file: 'ggml-small-test.bin' }, turbo: { ...asset(model), file: 'ggml-turbo-test.bin' } } });
    expect(local.status()).toMatchObject({ supported: true, runtimeReady: false, readyModel: null });
    local.startDownload('base');
    await vi.waitFor(() => expect(local.status().download).toBeNull());
    expect(local.status()).toMatchObject({ runtimeReady: true, readyModel: 'base', error: null });
    expect((await readdir(join(dir, 'whisper-test'))).sort()).toEqual(['whisper-server.exe']);
    expect(await readFile(join(dir, 'ggml-test.bin'), 'utf8')).toBe('model-bytes');
    await local.deleteModel('base');
    expect(local.status()).toMatchObject({ runtimeReady: false, readyModel: null });
  });

  it('refuses a file that does not match its hash and explains it', async () => {
    const dir = await temp();
    const runtime: RuntimeAsset = { url: 'https://x/zip', sha256: '0'.repeat(64), sizeBytes: 3, folder: 'w', keep: /./ };
    const fetcher = vi.fn(async () => new Response(bytes('bad'), { status: 200 }));
    const local = new LocalVoice({ dir, server: server(fetcher as never), fetch: fetcher as never, platform: 'win32', runtime });
    local.startDownload('base');
    await vi.waitFor(() => expect(local.status().download).toBeNull());
    expect(local.status().error).toMatch(/SHA-256/);
    expect(await readdir(dir)).toEqual([]);
  });

  it('is not offered outside Windows', async () => {
    const local = new LocalVoice({ dir: await temp(), server: server(vi.fn() as never), platform: 'darwin' });
    expect(local.status().supported).toBe(false);
    expect(() => local.startDownload('base')).toThrow('Windows');
  });
});
