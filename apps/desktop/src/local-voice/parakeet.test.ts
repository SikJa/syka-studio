import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { asrExecutable, Parakeet, PARAKEET_MODEL, SILERO_VAD } from './parakeet';

const dirs: string[] = [];
afterEach(async () => { for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true }); });

/** A stand-in for syka-asr: the GPU load fails unless asked for the CPU, like a machine without a working driver. */
const FAKE_ENGINE = `
const rl = require('node:readline').createInterface({ input: process.stdin });
rl.on('line', line => {
  const request = JSON.parse(line);
  if (request.cmd === 'quit') process.exit(0);
  if (request.cmd === 'load') {
    if (!request.cpu && process.env.FAKE_GPU_BROKEN) { process.stderr.write('vulkan: device lost\\n'); process.exit(3); }
    console.log(JSON.stringify({ id: request.id, ok: true, device: request.cpu ? 'CPU' : 'Fake GPU', backend: request.cpu ? 'cpu' : 'vulkan', vocabulary: true }));
  } else if (request.cmd === 'transcribe') {
    console.log(JSON.stringify({ id: request.id, ok: true, text: 'hola Claude', words: [{ text: 'hola', start_ms: 0, end_ms: 400 }, { text: 'Claude', start_ms: 400, end_ms: 900 }], language: 'es', wordLevel: true, audioMs: 1000, ms: 5, vocabulary: request.vocabulary }));
  }
});`;

async function setup(env: Record<string, string> = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'syka-parakeet-'));
  dirs.push(dir);
  const script = join(dir, 'fake-engine.cjs');
  await writeFile(script, FAKE_ENGINE);
  // The model files only need their exact sizes to count as installed.
  await writeFile(join(dir, PARAKEET_MODEL.file), Buffer.alloc(0));
  await writeFile(join(dir, SILERO_VAD.file), Buffer.alloc(0));
  const parakeet = new Parakeet({
    dir, roots: () => [dir], idleMs: 60_000,
    spawn: () => spawn(process.execPath, [script], { env: { ...process.env, ...env }, stdio: ['pipe', 'pipe', 'pipe'] }),
  });
  Object.defineProperty(parakeet, 'executable', { get: () => script });
  Object.defineProperty(parakeet, 'installed', { get: () => true });
  return parakeet;
}

describe('asrExecutable', () => {
  it('finds the engine by platform name in the first root that has it', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'syka-asr-')); dirs.push(dir);
    await writeFile(join(dir, 'syka-asr.exe'), '');
    expect(asrExecutable(['C:/missing', dir], 'win32')).toBe(join(dir, 'syka-asr.exe'));
    expect(asrExecutable([dir], 'darwin')).toBeNull();
  });
});

describe('Parakeet', () => {
  it('loads once on the GPU and returns timed words with the glossary as vocabulary', async () => {
    const parakeet = await setup();
    const result = await parakeet.transcribe(new Uint8Array(64), { vocabulary: ['Claude'] });
    expect(result.words).toEqual([{ text: 'hola', start_ms: 0, end_ms: 400 }, { text: 'Claude', start_ms: 400, end_ms: 900 }]);
    expect((result as unknown as { vocabulary: string[] }).vocabulary).toEqual(['Claude']);
    expect(parakeet.status()).toMatchObject({ device: 'Fake GPU (vulkan)', cpuFallback: false, state: 'running', vocabulary: true });
    parakeet.stop();
  });

  it('falls back to the processor when the graphics card cannot run it', async () => {
    const parakeet = await setup({ FAKE_GPU_BROKEN: '1' });
    const result = await parakeet.transcribe(new Uint8Array(64));
    expect(result.text).toBe('hola Claude');
    expect(parakeet.status()).toMatchObject({ device: 'CPU (cpu)', cpuFallback: true });
    parakeet.stop();
  });
});
