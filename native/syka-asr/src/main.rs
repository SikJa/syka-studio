// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

//! syka-asr: Syka Studio's local speech engine. One process per loaded model,
//! driven by Electron's main process over stdin/stdout, one JSON object per
//! line (requests and answers carry the same `id`). Diagnostics go to stderr.
//!
//! - `{"id":1,"cmd":"load","model":"…gguf","vad":"…gguf"|null,"cpu":false}`
//!   loads the model (and Silero VAD), warms it up and reports the device.
//! - `{"id":2,"cmd":"transcribe","wav":"…wav","language":null,"vocabulary":[]}`
//!   transcribes a 16 kHz mono 16-bit WAV and returns its timed words.
//!
//! The audio handling follows Whispera's notes (taken from Hex): Silero cuts
//! the speech out before the model, so noise never turns into invented text,
//! and long audio is transcribed in blocks that always end in a silence, with
//! every time shifted back by its block's start.

use std::io::{self, BufRead, Write};
use std::path::{Path, PathBuf};
use std::time::Instant;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use transcribe_cpp::{
    init_backends_with, Backend, BackendMask, Feature, Model, ModelOptions, RunOptions, Session, TimestampKind, VadOptions, VadSession,
};

const SAMPLE_RATE: usize = 16_000;
/// Blocks of speech handed to the model at once: long enough for context,
/// short enough for the GPU memory of a modest card.
const MAX_BLOCK_SAMPLES: usize = 45 * SAMPLE_RATE;
/// Speech kept around each VAD segment so words are not clipped.
const PAD_SAMPLES: usize = SAMPLE_RATE / 5;

#[derive(Deserialize)]
#[serde(tag = "cmd", rename_all = "lowercase")]
enum Command {
    Load { model: PathBuf, vad: Option<PathBuf>, #[serde(default)] cpu: bool },
    Transcribe { wav: PathBuf, language: Option<String>, #[serde(default)] vocabulary: Vec<String> },
    Quit,
}

#[derive(Deserialize)]
struct Request {
    id: Value,
    #[serde(flatten)]
    command: Command,
}

#[derive(Serialize)]
struct TimedWord {
    text: String,
    start_ms: i64,
    end_ms: i64,
}

struct Engine {
    // Sessions borrow nothing from their model in this binding, but keep the
    // model alive for as long as its sessions run.
    _model: Model,
    session: Session,
    vad: Option<(Model, VadSession)>,
    max_audio_samples: usize,
    word_timestamps: bool,
    vocabulary: bool,
}

fn main() {
    let stdin = io::stdin();
    let mut out = io::stdout().lock();
    let mut engine: Option<Engine> = None;
    let mut backends_ready = false;
    for line in stdin.lock().lines() {
        let Ok(line) = line else { break };
        if line.trim().is_empty() {
            continue;
        }
        let request: Request = match serde_json::from_str(&line) {
            Ok(request) => request,
            Err(error) => {
                reply(&mut out, json!({ "id": null, "ok": false, "error": format!("Pedido inválido: {error}") }));
                continue;
            }
        };
        let id = request.id;
        let answer = match request.command {
            Command::Quit => break,
            Command::Load { model, vad, cpu } => {
                if !backends_ready {
                    // Once per process, before any model: a CPU-only worker never lets a GPU driver load.
                    let mask = if cpu { BackendMask::for_backend(Backend::Cpu) } else { BackendMask::ALL };
                    if let Err(error) = init_backends_with(backend_dir().as_deref(), mask) {
                        reply(&mut out, json!({ "id": id, "ok": false, "error": format!("No se pudo preparar el motor: {error}") }));
                        continue;
                    }
                    backends_ready = true;
                }
                engine = None;
                load(&model, vad.as_deref(), cpu).map(|(loaded, info)| {
                    engine = Some(loaded);
                    info
                })
            }
            Command::Transcribe { wav, language, vocabulary } => match engine.as_mut() {
                None => Err("Todavía no se cargó un modelo.".to_string()),
                Some(engine) => transcribe(engine, &wav, language, vocabulary),
            },
        };
        match answer {
            Ok(mut value) => {
                value["id"] = id;
                value["ok"] = json!(true);
                reply(&mut out, value);
            }
            Err(error) => reply(&mut out, json!({ "id": id, "ok": false, "error": error })),
        }
    }
}

fn reply(out: &mut impl Write, value: Value) {
    let _ = writeln!(out, "{value}");
    let _ = out.flush();
}

/// The folder with the loadable backend modules: next to this executable.
fn backend_dir() -> Option<PathBuf> {
    if cfg!(target_os = "macos") {
        return None;
    }
    std::env::current_exe().ok().and_then(|exe| exe.parent().map(Path::to_path_buf))
}

fn load(path: &Path, vad: Option<&Path>, cpu: bool) -> Result<(Engine, Value), String> {
    let started = Instant::now();
    let options = ModelOptions { backend: if cpu { Backend::Cpu } else { Backend::Auto }, ..Default::default() };
    let model = Model::load_with(path, &options).map_err(|error| format!("No se pudo cargar el modelo: {error}"))?;
    let caps = model.capabilities().map_err(|error| error.to_string())?;
    let mut session = model.session().map_err(|error| error.to_string())?;
    let vad = match vad {
        Some(vad_path) => {
            let vad_model = Model::load_with(vad_path, &ModelOptions { backend: Backend::Cpu, ..Default::default() })
                .map_err(|error| format!("No se pudo cargar el detector de voz: {error}"))?;
            let vad_session = vad_model.vad_session().map_err(|error| error.to_string())?;
            Some((vad_model, vad_session))
        }
        None => None,
    };
    let device = model.device().map(|device| device.description).unwrap_or_default();
    let backend = model.backend();
    // A first pass compiles the GPU shaders, so the first real run does not pay for it.
    let warm = Instant::now();
    let _ = session.run(&vec![0.0f32; 3 * SAMPLE_RATE], &RunOptions::default());
    let word_timestamps = matches!(caps.max_timestamp_kind, TimestampKind::Word | TimestampKind::Token);
    let vocabulary = model.supports(Feature::Vocabulary);
    let info = json!({
        "arch": model.arch(),
        "backend": backend,
        "device": device,
        "wordTimestamps": word_timestamps,
        "vocabulary": vocabulary,
        "maxAudioMs": caps.max_audio_ms,
        "loadMs": warm.duration_since(started).as_millis() as u64,
        "warmupMs": warm.elapsed().as_millis() as u64,
    });
    let max_audio_samples = if caps.max_audio_ms > 0 { (caps.max_audio_ms as usize) * SAMPLE_RATE / 1000 } else { MAX_BLOCK_SAMPLES };
    Ok((Engine { _model: model, session, vad, max_audio_samples: max_audio_samples.min(MAX_BLOCK_SAMPLES), word_timestamps, vocabulary }, info))
}

fn read_wav(path: &Path) -> Result<Vec<f32>, String> {
    let mut reader = hound::WavReader::open(path).map_err(|error| format!("No se pudo leer el audio: {error}"))?;
    let spec = reader.spec();
    if spec.sample_rate as usize != SAMPLE_RATE || spec.channels != 1 || spec.bits_per_sample != 16 {
        return Err("El audio tiene que ser WAV de 16 kHz, mono y 16 bits.".to_string());
    }
    reader.samples::<i16>().map(|sample| sample.map(|value| value as f32 / 32768.0)).collect::<Result<_, _>>().map_err(|error| error.to_string())
}

/// The ranges to transcribe: speech found by Silero joined into blocks that
/// end in a silence, or fixed windows without a VAD.
fn blocks(engine: &mut Engine, pcm: &[f32]) -> Result<Vec<(usize, usize)>, String> {
    let limit = engine.max_audio_samples;
    let Some((_, vad)) = engine.vad.as_mut() else {
        return Ok((0..pcm.len()).step_by(limit).map(|start| (start, (start + limit).min(pcm.len()))).collect());
    };
    // Whispera's tuning: 0.4 still hears a whisper, 160 ms lets a short «Ok» through and drops clicks.
    let options = VadOptions { threshold: 0.4, min_speech_ms: 160, max_speech_ms: (limit * 1000 / SAMPLE_RATE) as i32 - 1000, ..Default::default() };
    let found = vad.run(pcm, &options).map_err(|error| format!("Falló el detector de voz: {error}"))?;
    let mut out: Vec<(usize, usize)> = Vec::new();
    for segment in found.segments {
        let start = (segment.start_sample.max(0) as usize).saturating_sub(PAD_SAMPLES);
        let end = ((segment.end_sample.max(0) as usize) + PAD_SAMPLES).min(pcm.len());
        if end <= start {
            continue;
        }
        match out.last_mut() {
            Some(last) if end - last.0 <= limit => last.1 = last.1.max(end),
            _ => out.push((start, end)),
        }
    }
    Ok(out)
}

fn transcribe(engine: &mut Engine, wav: &Path, language: Option<String>, vocabulary: Vec<String>) -> Result<Value, String> {
    let started = Instant::now();
    let pcm = read_wav(wav)?;
    let ranges = blocks(engine, &pcm)?;
    let options = RunOptions {
        timestamps: if engine.word_timestamps { TimestampKind::Word } else { TimestampKind::Segment },
        language: language.filter(|code| !code.is_empty()),
        vocabulary: if engine.vocabulary { vocabulary } else { Vec::new() },
        ..Default::default()
    };
    let mut words: Vec<TimedWord> = Vec::new();
    let mut texts: Vec<String> = Vec::new();
    let mut detected: Option<String> = None;
    for (start, end) in ranges {
        let offset_ms = (start * 1000 / SAMPLE_RATE) as i64;
        let result = engine.session.run(&pcm[start..end], &options).map_err(|error| format!("No se pudo transcribir: {error}"))?;
        if detected.is_none() {
            detected = result.language.clone();
        }
        let text = result.text.trim();
        if !text.is_empty() {
            texts.push(text.to_string());
        }
        if result.words.is_empty() {
            // Segment times only (a model without word alignment): one entry per segment.
            for segment in result.segments {
                if !segment.text.trim().is_empty() {
                    words.push(TimedWord { text: segment.text.trim().to_string(), start_ms: segment.t0_ms + offset_ms, end_ms: segment.t1_ms + offset_ms });
                }
            }
        } else {
            for word in result.words {
                if !word.text.trim().is_empty() {
                    words.push(TimedWord { text: word.text.trim().to_string(), start_ms: word.t0_ms + offset_ms, end_ms: word.t1_ms.max(word.t0_ms) + offset_ms });
                }
            }
        }
    }
    Ok(json!({
        "text": texts.join(" "),
        "words": words,
        "language": detected,
        "wordLevel": engine.word_timestamps,
        "audioMs": (pcm.len() * 1000 / SAMPLE_RATE) as u64,
        "ms": started.elapsed().as_millis() as u64,
    }))
}
