# Native screen recorder

Windows capture adapted from Whispera (`screen.rs` and `screen_capture.rs`),
Copyright (c) 2026 SikJa and Whispera contributors, MIT. The original license is
included in LICENSE-Whispera. This is a small standalone helper, not a dependency
on a user's Whispera installation.

FFmpeg gdigrab records physical desktop coordinates. CPAL/WASAPI records the
default output endpoint in loopback and the default microphone independently.
Pause closes a segment; resume opens another. Segments use a stable audio format,
then concatenate without reencoding video. The mixed MP4 and isolated mono WAV
stay inside the originating project. No media is uploaded by this executable.

`list` returns monitor bounds and GDI thumbnails as JSON. `record` reads one JSON
configuration from stdin, followed by pause/resume/stop/cancel lines. JSON status
lines are written to stdout. EOF stops and preserves the recording. The host
allocates the session directory and performs any cancellation cleanup.

Build with `node apps/desktop/scripts/build-screen-recorder.mjs`. The helper is
copied into dist; packaging stages the helper, license and FFmpeg (including its
DLLs) under runtime. End users do not need Rust or Whispera.
