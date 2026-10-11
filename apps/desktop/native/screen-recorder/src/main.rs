// Adapted from Whispera, Copyright (c) 2026 SikJa and Whispera contributors.
// MIT; see ../LICENSE-Whispera.
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use serde::{Deserialize, Serialize};
use std::{fs::{self, File}, io::{BufRead, Write}, os::windows::process::CommandExt,
 path::{Path, PathBuf}, process::{Child, Command, Stdio}, sync::{mpsc, Arc, Mutex}, time::{Duration, Instant}};
mod snapshot;
#[derive(Clone, Copy, Serialize, Deserialize)]
pub struct Region { pub x: i32, pub y: i32, pub width: u32, pub height: u32 }
#[derive(Clone, Deserialize)]
struct Preferences { audio: String }
#[derive(Clone, Default, Serialize)]
struct Status { phase: String, seconds: f64, path: String, microphone: String, error: String }
#[derive(Clone, Copy, Debug, PartialEq)]
enum CaptureControl { Stop, Pause, Resume, Cancel }
#[derive(Deserialize)]
struct Config { region: Region, audio: String, ffmpeg: PathBuf, dir: PathBuf }
fn command(binary: &Path) -> Command {
 let mut cmd=Command::new(binary); cmd.creation_flags(0x08000000).stdout(Stdio::null()); cmd
}
struct ManagedChild(Child);
impl std::ops::Deref for ManagedChild { type Target=Child; fn deref(&self)->&Child { &self.0 } }
impl std::ops::DerefMut for ManagedChild { fn deref_mut(&mut self)->&mut Child { &mut self.0 } }
impl Drop for ManagedChild { fn drop(&mut self) { if self.0.try_wait().ok().flatten().is_none() { let _=self.0.kill(); let _=self.0.wait(); } } }
fn emit(value: &impl Serialize) { let out=std::io::stdout(); let mut lock=out.lock(); let _=serde_json::to_writer(&mut lock,value); let _=lock.write_all(b"\n"); let _=lock.flush(); }
fn main() {
 unsafe { let _=windows::Win32::UI::HiDpi::SetProcessDpiAwarenessContext(windows::Win32::UI::HiDpi::DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2); }
 if std::env::args().nth(1).as_deref()==Some("list") { match snapshot::sources() { Ok(v)=>emit(&v), Err(e)=>{emit(&serde_json::json!({"error":e}));std::process::exit(1);} } return; }
 let input=std::io::stdin(); let mut lines=input.lock().lines();
 let parsed=lines.next().ok_or("Falta configuracion").and_then(|v|v.map_err(|_|"Configuracion ilegible")).and_then(|v|serde_json::from_str::<Config>(&v).map_err(|_|"Configuracion invalida"));
 let config=match parsed { Ok(v)=>v,Err(e)=>{emit(&serde_json::json!({"phase":"error","error":e}));return;} };
 if config.region.width<16 || config.region.height<16 || config.region.width>8192 || config.region.height>8192 || !config.ffmpeg.is_file() || !config.dir.is_dir() || !["none","system","microphone","both"].contains(&config.audio.as_str()) { emit(&serde_json::json!({"phase":"error","error":"Parametros de captura invalidos"}));return; }
 drop(lines); let (tx,rx)=mpsc::channel();
 std::thread::spawn(move || { for line in std::io::stdin().lock().lines() { let action=match line.as_deref() { Ok("pause")=>CaptureControl::Pause,Ok("resume")=>CaptureControl::Resume,Ok("cancel")=>CaptureControl::Cancel,Ok("stop")=>CaptureControl::Stop,_=>continue }; if tx.send(action).is_err(){return;} } let _=tx.send(CaptureControl::Stop); });
 let state=Arc::new(Mutex::new(Status{phase:"starting".into(),..Default::default()}));
 let reporting=state.clone();
 let reporter=std::thread::spawn(move || { loop { let status=reporting.lock().unwrap().clone(); emit(&status); if ["complete","cancelled","error"].contains(&status.phase.as_str()){break;} std::thread::sleep(Duration::from_millis(200)); } });
 let (ready,_)=mpsc::channel();
 capture(config.region,Preferences{audio:config.audio},config.ffmpeg,config.dir,state,rx,ready,true);
 let _=reporter.join();
}
struct AudioTrack {
    _stream: cpal::Stream,
    rx: mpsc::Receiver<(Instant, Vec<i16>)>,
    file: File,
    path: PathBuf,
    rate: u32,
    channels: u16,
    written: u64,
    fault: Arc<Mutex<String>>,
    scratch: Vec<u8>,
}
fn samples<T: Copy>(
    data: &[T],
    convert: impl Fn(T) -> f32,
    tx: &mpsc::SyncSender<(Instant, Vec<i16>)>,
    fault: &Mutex<String>,
) {
    let values = data
        .iter()
        .map(|s| (convert(*s).clamp(-1., 1.) * 32767.).round() as i16)
        .collect();
    if tx.try_send((Instant::now(), values)).is_err() {
        if let Ok(mut err) = fault.lock() {
            *err = "El audio no pudo escribirse a tiempo".into();
        }
    }
}
impl AudioTrack {
    fn new(system: bool, dir: &Path) -> Result<Self, String> {
        let host = cpal::default_host();
        let device = if system {
            host.default_output_device()
        } else {
            host.default_input_device()
        }
        .ok_or(if system {
            "No hay salida de audio"
        } else {
            "No hay microfono"
        })?;
        let config = if system {
            device.default_output_config()
        } else {
            device.default_input_config()
        }
        .map_err(|e| e.to_string())?;
        let (tx, rx) = mpsc::sync_channel(256);
        let fault = Arc::new(Mutex::new(String::new()));
        let errors = fault.clone();
        let callback_fault = fault.clone();
        let on_error = move |e: cpal::StreamError| {
            if let Ok(mut err) = errors.lock() {
                *err = e.to_string();
            }
        };
        let cfg: cpal::StreamConfig = config.clone().into();
        // CPAL's WASAPI backend enables loopback when an output device is opened as input.
        let stream = match config.sample_format() {
            cpal::SampleFormat::F32 => device.build_input_stream(
                &cfg,
                move |d: &[f32], _| samples(d, |v| v, &tx, &callback_fault),
                on_error,
                None,
            ),
            cpal::SampleFormat::I16 => device.build_input_stream(
                &cfg,
                move |d: &[i16], _| samples(d, |v| v as f32 / 32768., &tx, &callback_fault),
                on_error,
                None,
            ),
            cpal::SampleFormat::U16 => device.build_input_stream(
                &cfg,
                move |d: &[u16], _| {
                    samples(d, |v| (v as f32 - 32768.) / 32768., &tx, &callback_fault)
                },
                on_error,
                None,
            ),
            other => return Err(format!("Formato de audio no soportado: {other:?}")),
        }
        .map_err(|e| format!("No se pudo iniciar el audio: {e}"))?;
        let path = dir.join(if system {
            "system.pcm"
        } else {
            "microphone.pcm"
        });
        let file = File::create(&path).map_err(|e| e.to_string())?;
        stream.play().map_err(|e| e.to_string())?;
        Ok(Self {
            _stream: stream,
            rx,
            file,
            path,
            rate: cfg.sample_rate.0,
            channels: cfg.channels,
            written: 0,
            fault,
            scratch: Vec::with_capacity(8192),
        })
    }
    fn silence(&mut self, samples: u64) -> Result<(), String> {
        let zeros = [0u8; 8192];
        let mut bytes = samples * 2;
        while bytes > 0 {
            let n = bytes.min(zeros.len() as u64) as usize;
            self.file
                .write_all(&zeros[..n])
                .map_err(|e| e.to_string())?;
            bytes -= n as u64;
        }
        self.written += samples;
        Ok(())
    }
    fn drain(&mut self, start: Instant) -> Result<(), String> {
        let error = self.fault.lock().map_err(|_| "Audio ocupado")?.clone();
        if !error.is_empty() {
            return Err(error);
        }
        while let Ok((time, values)) = self.rx.try_recv() {
            let end_frame =
                (time.saturating_duration_since(start).as_secs_f64() * self.rate as f64) as u64;
            let begin = end_frame.saturating_sub(values.len() as u64 / self.channels as u64)
                * self.channels as u64;
            if begin > self.written {
                self.silence(begin - self.written)?;
            }
            pcm_bytes(&values,&mut self.scratch);
            self.file.write_all(&self.scratch).map_err(|e| e.to_string())?;
            self.written += values.len() as u64;
        }
        Ok(())
    }
    fn finish(&mut self, start: Instant, seconds: f64) -> Result<(), String> {
        self._stream.pause().map_err(|e| e.to_string())?;
        self.drain(start)?;
        let target = (seconds * self.rate as f64).round() as u64 * self.channels as u64;
        if target > self.written {
            self.silence(target - self.written)?;
        }
        self.file.set_len(target * 2).map_err(|e| e.to_string())?;
        self.file.sync_all().map_err(|e| e.to_string())
    }
}
fn finish_process(child: &mut Child) -> Result<(), String> {
    if let Some(mut stdin) = child.stdin.take() {
        let _ = stdin.write_all(b"q\n");
    }
    let deadline = Instant::now() + Duration::from_secs(20);
    loop {
        if let Some(status) = child.try_wait().map_err(|e| e.to_string())? {
            return if status.success() {
                Ok(())
            } else {
                Err("El motor de video fallo; los archivos de recuperacion se conservaron".into())
            };
        }
        if Instant::now() > deadline {
            let _ = child.kill();
            let _ = child.wait();
            return Err(
                "El motor de video no respondio al detener; los originales se conservaron".into(),
            );
        }
        std::thread::sleep(Duration::from_millis(50));
    }
}
fn pcm_bytes(values:&[i16],bytes:&mut Vec<u8>) {
    bytes.clear();
    for value in values {bytes.extend_from_slice(&value.to_le_bytes());}
}
fn capture(
    region: Region,
    prefs: Preferences,
    binary: PathBuf,
    dir: PathBuf,
    state: Arc<Mutex<Status>>,
    stop: mpsc::Receiver<CaptureControl>,
    ready: mpsc::Sender<Result<(), String>>,
    transcribe_microphone: bool,
) {
    let result = (|| -> Result<Option<PathBuf>, String> {
        let mut segments = Vec::new();
        let mut elapsed = 0.;
        let mut cancelled = false;
        'capture: loop {
            let part = dir.join(format!("part-{:04}", segments.len()));
            fs::create_dir_all(&part).map_err(|e| e.to_string())?;
            let (path, action, seconds) = record(
                region,
                prefs.clone(),
                binary.clone(),
                &part,
                &state,
                &stop,
                &ready,
                elapsed,
                transcribe_microphone,
            )?;
            elapsed += seconds;
            if let Some(path) = path {
                segments.push(path);
            }
            match action {
                CaptureControl::Cancel => {
                    cancelled = true;
                    break;
                }
                CaptureControl::Pause => {
                    state.lock().map_err(|_| "Estado ocupado")?.phase = "paused".into();
                    loop {
                        match stop.recv().unwrap_or(CaptureControl::Stop) {
                            CaptureControl::Resume => break,
                            CaptureControl::Cancel => {
                                cancelled = true;
                                break 'capture;
                            }
                            CaptureControl::Stop => break 'capture,
                            CaptureControl::Pause => {}
                        }
                    }
                }
                _ => break,
            }
        }
        if cancelled {
            return Ok(None);
        }
        state.lock().map_err(|_| "Estado ocupado")?.phase = "saving".into();
        let output = dir.join("pantalla.mp4");
        if segments.len() == 1 {
            fs::rename(&segments[0], &output).map_err(|e| e.to_string())?;
        } else {
            let manifest = segments
                .iter()
                .map(|path| {
                    format!(
                        "file '{}'\n",
                        path.strip_prefix(&dir)
                            .unwrap()
                            .to_string_lossy()
                            .replace('\\', "/")
                    )
                })
                .collect::<String>();
            let list = dir.join("segments.txt");
            fs::write(&list, manifest).map_err(|e| e.to_string())?;
            let mut child = command(&binary)
                .args([
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-y",
                    "-f",
                    "concat",
                    "-safe",
                    "1",
                    "-i",
                ])
                .arg(&list)
                .args(["-c", "copy", "-movflags", "+faststart"])
                .arg(&output)
                .stdin(Stdio::null())
                .stderr(Stdio::from(
                    File::create(dir.join("join.log")).map_err(|e| e.to_string())?,
                ))
                .spawn()
                .map_err(|e| e.to_string())?;
            wait_encoder(&mut child)?;
            if fs::metadata(&output).map_err(|e| e.to_string())?.len() == 0 {
                return Err("El video quedo vacio".into());
            }
            for path in segments {
                let _ = fs::remove_file(path);
            }
        }
        let voices=(0..segments_count(&dir)).map(|i|dir.join(format!("part-{:04}/voz.wav",i))).filter(|p|p.is_file()).collect::<Vec<_>>();
        if !voices.is_empty() {
            let speech=dir.join("voz.wav");
            if voices.len()==1 { fs::rename(&voices[0],&speech).map_err(|e|e.to_string())?; }
            else {
                let manifest=voices.iter().map(|p|format!("file '{}'\n",p.strip_prefix(&dir).unwrap().to_string_lossy().replace('\\',"/"))).collect::<String>();
                let list=dir.join("voices.txt");fs::write(&list,manifest).map_err(|e|e.to_string())?;
                let mut encoder=command(&binary).args(["-hide_banner","-loglevel","error","-y","-f","concat","-safe","1","-i"]).arg(&list).args(["-c:a","pcm_s16le"]).arg(&speech).spawn().map_err(|e|e.to_string())?;
                wait_encoder(&mut encoder)?;for p in voices{let _=fs::remove_file(p);}
            }
        }
        state.lock().map_err(|_| "Estado ocupado")?.seconds = elapsed;
        Ok(Some(output))
    })();
    match result {
        Ok(Some(path)) => {
            if let Ok(mut status) = state.lock() {
                status.phase="complete".into(); status.path=path.to_string_lossy().into();
                let speech=dir.join("voz.wav"); if speech.is_file(){status.microphone=speech.to_string_lossy().into();}
            }
        }
        Ok(None) => {
            if let Ok(mut status) = state.lock() {
                *status = Status {
                    phase: "cancelled".into(),
                    ..Default::default()
                };
            }
        }
        Err(e) => {
            let _ = ready.send(Err(e.clone()));
            if let Ok(mut status) = state.lock() {
                status.phase = "error".into();
                status.error = format!("{e}. Recuperacion: {}", dir.display());
            }
        }
    }
}

fn wait_encoder(child: &mut Child) -> Result<(), String> {
    let deadline = Instant::now() + Duration::from_secs(120);
    loop {
        if let Some(exit) = child.try_wait().map_err(|e| e.to_string())? {
            return if exit.success() {
                Ok(())
            } else {
                Err("No se pudo preparar el MP4; los originales se conservaron".into())
            };
        }
        if Instant::now() > deadline {
            let _ = child.kill();
            let _ = child.wait();
            return Err("La preparacion del MP4 tardo demasiado; originales conservados".into());
        }
        std::thread::sleep(Duration::from_millis(50));
    }
}

fn record(
    region: Region,
    prefs: Preferences,
    binary: PathBuf,
    dir: &Path,
    state: &Arc<Mutex<Status>>,
    stop: &mpsc::Receiver<CaptureControl>,
    ready: &mpsc::Sender<Result<(), String>>,
    elapsed: f64,
    transcribe_microphone: bool,
) -> Result<(Option<PathBuf>, CaptureControl, f64), String> {
    let mut tracks = Vec::new();
    if ["system", "both"].contains(&prefs.audio.as_str()) {
        tracks.push(AudioTrack::new(true, &dir)?);
    }
    if ["microphone", "both"].contains(&prefs.audio.as_str()) {
        tracks.push(AudioTrack::new(false, &dir)?);
    }
    let video = dir.join("video.mkv");
    let log = File::create(dir.join("capture.log")).map_err(|e| e.to_string())?;
    let mut child = ManagedChild(command(&binary)
        .args([
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-f",
            "gdigrab",
            "-framerate",
            "30",
            "-probesize",
            "32",
            "-analyzeduration",
            "0",
            "-draw_mouse",
            "1",
            "-offset_x",
            &region.x.to_string(),
            "-offset_y",
            &region.y.to_string(),
            "-video_size",
            &format!("{}x{}", region.width, region.height),
            "-i",
            "desktop",
            "-an",
            "-vf",
            "pad=ceil(iw/2)*2:ceil(ih/2)*2",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-tune",
            "zerolatency",
            "-crf",
            "18",
            "-pix_fmt",
            "yuv420p",
            "-flush_packets",
            "1",
        ])
        .arg(&video)
        .stdin(Stdio::piped())
        .stderr(Stdio::from(log))
        .spawn()
        .map_err(|e| e.to_string())?);
    let started = Instant::now();
    // Wait for FFmpeg to actually create output, rather than reporting a successful spawn.
    let startup = (|| -> Result<(), String> {
        loop {
            if child.try_wait().map_err(|e| e.to_string())?.is_some() {
                return Err(format!(
                    "No se pudo capturar la pantalla. Revisa {}",
                    dir.join("capture.log").display()
                ));
            }
            if fs::metadata(&video).map(|m| m.len() > 0).unwrap_or(false) {
                return Ok(());
            }
            for track in &mut tracks {
                track.drain(started)?;
            }
            if started.elapsed() > Duration::from_secs(10) {
                return Err("La captura de pantalla no inicio a tiempo".into());
            }
            std::thread::sleep(Duration::from_millis(30));
        }
    })();
    if let Err(e) = startup {
        let _ = child.kill();
        let _ = child.wait();
        return Err(e);
    }
    *state.lock().map_err(|_| "Estado ocupado")? = Status {
        phase: "recording".into(),
        seconds: elapsed,
        ..Default::default()
    };
    let _ = ready.send(Ok(()));
    let mut error = None;
    let mut reason = CaptureControl::Stop;
    let mut last_status=Instant::now();
    loop {
        match stop.recv_timeout(Duration::from_millis(25)) {
            Ok(CaptureControl::Resume) => continue,
            Ok(action) => {
                reason = action;
                break;
            }
            Err(mpsc::RecvTimeoutError::Disconnected) => break,
            Err(mpsc::RecvTimeoutError::Timeout) => {}
        }
        if elapsed + started.elapsed().as_secs_f64() >= 600. { break; }
        if child.try_wait().map_err(|e| e.to_string())?.is_some() {
            error = Some("La captura se interrumpio. Se conservaron los originales.".to_string());
            break;
        }
        for track in &mut tracks {
            if let Err(e) = track.drain(started) {
                error = Some(e);
                break;
            }
        }
        if error.is_some() {
            break;
        }
        if last_status.elapsed() >= Duration::from_millis(250) {
            state.lock().map_err(|_| "Estado ocupado")?.seconds = elapsed + started.elapsed().as_secs_f64();
            last_status=Instant::now();
        }
    }
    let seconds = started.elapsed().as_secs_f64();
    {
        let mut status = state.lock().map_err(|_| "Estado ocupado")?;
        status.seconds = elapsed + seconds;
        status.phase = if reason == CaptureControl::Pause {
            "pausing"
        } else {
            "saving"
        }
        .into();
    }
    if reason == CaptureControl::Cancel {
        let _ = child.kill();
        let _ = child.wait();
        drop(tracks);
        return Ok((None, reason, seconds));
    }
    let finalized = finish_process(&mut child);
    for track in &mut tracks {
        track.finish(started, seconds)?;
    }
    finalized?;
    if let Some(e) = error {
        return Err(e);
    }
    let output = dir.join("pantalla.mp4");
    let mut mux = command(&binary);
    mux.args(["-hide_banner", "-loglevel", "error", "-y", "-i"])
        .arg(&video);
    for track in &tracks {
        mux.args([
            "-f",
            "s16le",
            "-ar",
            &track.rate.to_string(),
            "-ac",
            &track.channels.to_string(),
            "-i",
        ])
        .arg(&track.path);
    }
    mux.args(["-map", "0:v:0", "-c:v", "copy"]);
    if tracks.len() == 2 {
        mux.args([
            "-filter_complex",
            "[1:a][2:a]amix=inputs=2:duration=longest:normalize=0,alimiter=limit=0.95[a]",
            "-map",
            "[a]",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
        ]);
    } else if tracks.len() == 1 {
        mux.args(["-map", "1:a:0", "-c:a", "aac", "-b:a", "192k"]);
    }
    // Resume can reopen a different Windows default device. Keep the encoded
    // audio format stable so all segments concatenate without resampling video.
    if !tracks.is_empty() {
        mux.args(["-ar", "48000", "-ac", "2"]);
    }
    mux.args(["-movflags", "+faststart"])
        .arg(&output)
        .stdin(Stdio::null())
        .stderr(Stdio::from(
            File::create(dir.join("encode.log")).map_err(|e| e.to_string())?,
        ));
    let mut mux_child = mux.spawn().map_err(|e| e.to_string())?;
    let deadline = Instant::now() + Duration::from_secs(120);
    loop {
        if let Some(exit) = mux_child.try_wait().map_err(|e| e.to_string())? {
            if !exit.success() {
                return Err(format!(
                    "No se pudo preparar el MP4. Originales en {}",
                    dir.display()
                ));
            }
            break;
        }
        if Instant::now() > deadline {
            let _ = mux_child.kill();
            let _ = mux_child.wait();
            return Err("La preparacion del MP4 tardo demasiado; originales conservados".into());
        }
        std::thread::sleep(Duration::from_millis(50));
    }
    if transcribe_microphone {
        if let Some(track)=tracks.iter().find(|t|t.path.file_name().is_some_and(|n|n=="microphone.pcm")) {
            let mut speech=command(&binary).args(["-hide_banner","-loglevel","error","-y","-f","s16le","-ar",&track.rate.to_string(),"-ac",&track.channels.to_string(),"-i"]).arg(&track.path).args(["-ar","16000","-ac","1","-c:a","pcm_s16le"]).arg(dir.join("voz.wav")).spawn().map_err(|e|e.to_string())?;
            wait_encoder(&mut speech)?;
        }
    }
    drop(tracks);
    // Only remove intermediate files after a complete, nonempty MP4 exists.
    if fs::metadata(&output).map_err(|e| e.to_string())?.len() == 0 {
        return Err("El video quedo vacio".into());
    }
    for file in ["video.mkv", "system.pcm", "microphone.pcm"] {
        let _ = fs::remove_file(dir.join(file));
    }
    Ok((Some(output), reason, seconds))
}

fn segments_count(dir:&Path)->usize { fs::read_dir(dir).map(|items|items.flatten().filter(|i|i.file_name().to_string_lossy().starts_with("part-")).count()).unwrap_or(0) }
#[cfg(test)]
mod tests { use super::*;
 #[test] fn pcm_keeps_signed_samples() {let mut v=Vec::new();pcm_bytes(&[i16::MIN,-1,0,1,i16::MAX],&mut v);assert_eq!(v,[i16::MIN,-1,0,1,i16::MAX].iter().flat_map(|s|s.to_le_bytes()).collect::<Vec<_>>());}
}
