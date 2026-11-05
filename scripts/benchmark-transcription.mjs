#!/usr/bin/env node
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Compares the transcription engines on the same audio: Parakeet v3 (syka-asr),
// Whisper Small and Large V3 Turbo (whisper.cpp) and, with GROQ_API_KEY, Groq.
// For each one: time, speed against real time, word timings and, with a
// reference text, the word error rate (WER).
//
//   node scripts/benchmark-transcription.mjs --audio video.mp4 [--reference ref.txt]
//        [--engines parakeet,small,turbo,groq] [--language es]
//
// Models download once (verified by SHA-256) into .runtime/transcription-bench.
// Groq only runs when GROQ_API_KEY is set, and that run uses its quota.

import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]?.startsWith('--') ? 'true' : all[index + 1] ?? 'true']] : pairs, []));
if (!args.audio) { console.error('Uso: --audio <archivo> [--reference <texto>] [--engines parakeet,small,turbo,groq] [--language es]'); process.exit(1); }
const engines = (args.engines ?? 'parakeet,small,turbo,groq').split(',');
const bench = join(repo, '.runtime', 'transcription-bench');
mkdirSync(bench, { recursive: true });

// The same pins as apps/desktop/src/local-voice/{assets,parakeet}.ts.
const HF = (repo, rev, file) => `https://huggingface.co/${repo}/resolve/${rev}/${file}`;
const WHISPER_REV = '5359861c739e955e79d9a303bcbc70fb988958b1';
const MODELS = {
  parakeet: { file: 'parakeet-tdt-0.6b-v3-Q8_0.gguf', url: HF('handy-computer/parakeet-tdt-0.6b-v3-gguf', '85ac09ea12fc4b1112fa76810059364bc6adc9de', 'parakeet-tdt-0.6b-v3-Q8_0.gguf'), sha256: '5859f77944efcd8eafa23a6350731960b2b55b2203df51f319665c807d802cc7', size: 739_508_576 },
  vad: { file: 'silero-vad-v6.2-F32.gguf', url: HF('handy-computer/silero-vad-v6.2-gguf', 'a9b2d61c20ae4ddf3644edb34969e8185a485448', 'silero-vad-v6.2-F32.gguf'), sha256: '0d871a800c420fdd5d1b17a3aea4296d1c39608f0ff4a9295eb76457eb1c88e6', size: 1_241_056 },
  small: { file: 'ggml-small.bin', url: HF('ggerganov/whisper.cpp', WHISPER_REV, 'ggml-small.bin'), sha256: '1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b', size: 487_601_967 },
  turbo: { file: 'ggml-large-v3-turbo-q5_0.bin', url: HF('ggerganov/whisper.cpp', WHISPER_REV, 'ggml-large-v3-turbo-q5_0.bin'), sha256: '394221709cd5ad1f40c46e6031ca61bce88931e6e088c188294c6d5a55ffa7e2', size: 574_041_195 },
};

async function ensure(name) {
  const asset = MODELS[name];
  const path = join(bench, asset.file);
  if (existsSync(path) && statSync(path).size === asset.size) return path;
  process.stdout.write(`Descargando ${asset.file} (${Math.round(asset.size / 1e6)} MB)… `);
  const response = await fetch(asset.url, { redirect: 'follow' });
  if (!response.ok || !response.body) throw new Error(`${asset.file}: HTTP ${response.status}`);
  const hash = createHash('sha256');
  const part = `${path}.part`;
  await pipeline(Readable.fromWeb(response.body), async function* (chunks) { for await (const chunk of chunks) { hash.update(chunk); yield chunk; } }, createWriteStream(part));
  if (statSync(part).size !== asset.size || hash.digest('hex') !== asset.sha256) { rmSync(part, { force: true }); throw new Error(`${asset.file}: no coincide su SHA-256`); }
  renameSync(part, path);
  console.log('verificado.');
  return path;
}

function ffmpeg() {
  const candidates = [process.env.SYKA_FFMPEG, 'B:/Herramientas de compilacion/FFmpeg/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe', 'ffmpeg'].filter(Boolean);
  for (const candidate of candidates) { try { execFileSync(candidate, ['-version'], { stdio: 'ignore' }); return candidate; } catch { /* Next. */ } }
  throw new Error('Falta FFmpeg (o SYKA_FFMPEG).');
}

const freePort = () => new Promise((ok, fail) => { const server = createServer(); server.listen(0, '127.0.0.1', () => { const { port } = server.address(); server.close(() => ok(port)); }); server.once('error', fail); });

/** Parakeet in syka-asr: load (with the warm-up), then the timed run. */
async function parakeet(wav) {
  const exe = join(repo, '.runtime', 'syka-asr-target', 'release', process.platform === 'win32' ? 'syka-asr.exe' : 'syka-asr');
  if (!existsSync(exe)) throw new Error('Compilá syka-asr primero (node apps/desktop/scripts/stage-asr.mjs).');
  const [model, vad] = [await ensure('parakeet'), await ensure('vad')];
  const child = spawn(exe, [], { stdio: ['pipe', 'pipe', 'inherit'] });
  const lines = createInterface({ input: child.stdout });
  const waiting = new Map();
  lines.on('line', line => { const message = JSON.parse(line); waiting.get(message.id)?.(message); });
  const call = (id, body) => new Promise(ok => { waiting.set(id, ok); child.stdin.write(`${JSON.stringify({ id, ...body })}\n`); });
  // --cpu simulates a computer without a usable graphics card.
  const loaded = await call(1, { cmd: 'load', model, vad, cpu: args.cpu === 'true' });
  if (!loaded.ok) throw new Error(loaded.error);
  const first = await call(2, { cmd: 'transcribe', wav, language: null });
  // The first real pass still compiles GPU shaders; the second is what every later video costs.
  const result = first.ok ? await call(4, { cmd: 'transcribe', wav, language: null }) : first;
  result.firstMs = first.ms;
  child.stdin.write('{"id":3,"cmd":"quit"}\n');
  if (!result.ok) throw new Error(result.error);
  return { ms: result.ms, firstMs: result.firstMs, text: result.text, words: result.words.map(word => ({ text: word.text, start: word.start_ms / 1000, end: word.end_ms / 1000 })), device: `${loaded.device} (${loaded.backend})`, loadMs: loaded.loadMs + loaded.warmupMs };
}

/** whisper.cpp's server with one model; the run asks for one word per segment, as Syka does for captions. */
async function whisper(name, wav) {
  const server = [join(bench, 'whisper-b5130'), join(repo, '.runtime', 'update-demo', 'profile', 'voice', 'whisper-b5130')].map(dir => join(dir, 'whisper-server.exe')).find(existsSync);
  if (!server) throw new Error('Falta whisper-server: descargá un modelo de Whisper desde Syka una vez.');
  const model = await ensure(name);
  const port = await freePort();
  const threads = Math.max(2, Math.min(8, cpus().length - 1));
  const started = Date.now();
  const child = spawn(server, ['-m', model, '--host', '127.0.0.1', '--port', String(port), '-t', String(threads)], { cwd: dirname(server), stdio: 'ignore', windowsHide: true });
  try {
    while (true) {
      try { if ((await fetch(`http://127.0.0.1:${port}/health`)).status !== 503) break; } catch { /* Not yet. */ }
      if (Date.now() - started > 120_000) throw new Error('whisper-server no arrancó');
      await new Promise(ok => setTimeout(ok, 300));
    }
    const loadMs = Date.now() - started;
    const form = new FormData();
    form.append('file', new Blob([readFileSync(wav)], { type: 'audio/wav' }), 'audio.wav');
    for (const [key, value] of Object.entries({ language: args.language ?? 'auto', temperature: '0.0', response_format: 'verbose_json', max_len: '1', split_on_word: 'true', suppress_non_speech: 'true' })) form.append(key, value);
    const t0 = Date.now();
    const body = await (await fetch(`http://127.0.0.1:${port}/inference`, { method: 'POST', body: form })).json();
    const ms = Date.now() - t0;
    const words = (body.segments ?? []).map(segment => ({ text: String(segment.text).trim(), start: segment.start, end: segment.end })).filter(word => word.text && !/^[[(].*[\])]$/.test(word.text));
    return { ms, text: words.map(word => word.text).join(' '), words, device: `CPU, ${threads} hilos`, loadMs };
  } finally { child.kill(); }
}

async function groq(wav) {
  if (!process.env.GROQ_API_KEY) throw new Error('sin GROQ_API_KEY: no se corrió (usaría tu cuota)');
  const form = new FormData();
  form.append('file', new Blob([readFileSync(wav)], { type: 'audio/wav' }), 'audio.wav');
  for (const [key, value] of Object.entries({ model: 'whisper-large-v3-turbo', response_format: 'verbose_json', temperature: '0' })) form.append(key, value);
  form.append('timestamp_granularities[]', 'word');
  if (args.language) form.append('language', args.language);
  const t0 = Date.now();
  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` }, body: form });
  if (!response.ok) throw new Error(`Groq HTTP ${response.status}`);
  const body = await response.json();
  return { ms: Date.now() - t0, text: body.text.trim(), words: (body.words ?? []).map(word => ({ text: word.word.trim(), start: word.start, end: word.end })), device: 'nube (incluye la subida)', loadMs: 0 };
}

const normalize = text => text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/\[[^\]]*\]/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
function wer(reference, hypothesis) {
  const ref = normalize(reference), hyp = normalize(hypothesis);
  let row = Array.from({ length: hyp.length + 1 }, (_, index) => index);
  for (let i = 1; i <= ref.length; i++) {
    const next = [i];
    for (let j = 1; j <= hyp.length; j++) next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (ref[i - 1] === hyp[j - 1] ? 0 : 1));
    row = next;
  }
  return ref.length ? row[hyp.length] / ref.length : null;
}

const source = resolve(args.audio);
const wav = join(bench, 'input.wav');
execFileSync(ffmpeg(), ['-hide_banner', '-loglevel', 'error', '-y', '-i', source, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', wav]);
const audioSeconds = (statSync(wav).size - 44) / 32000;
const reference = args.reference ? readFileSync(resolve(args.reference), 'utf8').replace(/^\[[^\]]*\]\s*/gm, '') : null;
console.log(`Audio: ${source} · ${audioSeconds.toFixed(1)} s${reference ? ' · con texto de referencia' : ''}\n`);

const run = { parakeet: () => parakeet(wav), small: () => whisper('small', wav), turbo: () => whisper('turbo', wav), groq: () => groq(wav) };
const label = { parakeet: 'Parakeet v3', small: 'Whisper Small', turbo: 'Whisper Large V3 Turbo', groq: 'Groq (Whisper Large V3 Turbo)' };
const results = [];
for (const engine of engines) {
  try {
    const result = await run[engine]();
    const entry = { engine: label[engine], ...result, speed: audioSeconds / (result.ms / 1000), wer: reference ? wer(reference, result.text) : null };
    results.push(entry);
    console.log(`${entry.engine}: ${(result.ms / 1000).toFixed(2)} s (${entry.speed.toFixed(1)}× tiempo real) · ${result.words.length} palabras con tiempo${entry.wer === null ? '' : ` · WER ${(entry.wer * 100).toFixed(1)}%`} · ${result.device}`);
  } catch (error) {
    results.push({ engine: label[engine], error: error.message });
    console.log(`${label[engine]}: ${error.message}`);
  }
}
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const report = join(bench, `report-${stamp}.json`);
writeFileSync(report, JSON.stringify({ source, audioSeconds, reference: args.reference ?? null, results }, null, 2));
console.log(`\nInforme: ${report}`);
