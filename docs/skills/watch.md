# Watch footage in Syka

Inspect only the evidence needed for the user's question. Syka's media analysis tools work without a Diffusion account. The source of each conclusion must be explicit.

For an individual public Instagram, TikTok, X/Twitter or YouTube/Shorts link, use `syka_reference_video`. For a bare link or generic "analyze this video", first inspect a bounded visual excerpt with `initialInspection: true` (four frames, up to 20 seconds, no prepared audio or retained source), or reuse saved evidence. Then ALWAYS call `syka_ask_user`: briefly state what you observed, recommend a concrete direction grounded in it, and ask what the reference should contribute. Wait before deeper analysis or production; do not repeat a purpose already specified or delegated. Use the open `syka-video-references` workflow; no closed keyword intent filter. Read every returned image and state sampling limits. Downloaded source is disposable, completed evidence persists, and local originals remain intact. Retain the complete source only when needed for later editing. Preview music/footage and ask where to place it before inserting it.

1. Run `media_probe` first to learn the tracks, duration and format.
2. For structure, use `media_waveform` and `media_filmstrip`. A waveform measures amplitude and marks candidate silences; a gap in speech can still contain music or applause. Filmstrips sample frames and can miss events between samples.
3. For speech content, use `media_transcribe` if the user has configured Groq. This sends prepared audio chunks to Groq using the user's API account and returns a transcript file with real timestamps. The local glossary supplies bounded recognition hints and applies exact name/variant corrections once after merging chunks. Equal-length spelling corrections retain each word's interval; a contraction/expansion is one timed phrase using existing outer boundaries, with no invented per-word alignment. It is not an offline model and its quota belongs to Groq. If no key is configured, explain the missing provider; do not fabricate speech or switch providers.
4. Use `media_grab` at relevant timestamps to confirm what is visible. `auto` can help locate stable states, but an exact cut or readability decision needs the appropriate frames.
5. Search long transcript files for passages instead of loading every word into context.

## Limits

`media_listen` is disabled in this fork. Do not call it, advise buying Diffusion credits, or claim Codex directly heard the file. A transcript does not establish music, tone of voice or non-speech events. Waveforms are not semantic audio recognition.

The local tracking tool `media_segment` may download public SAM2 model weights on first use. It does not require a Diffusion account, but is not guaranteed to work without that download or adequate hardware.

Download page-hosted footage only through an available authorized ingest tool; `media_*` expects a path or direct media URL. Never install unknown tools or put downloads in an unrelated system directory.

## Answers

Give timestamps as MM:SS or HH:MM:SS and distinguish source footage from edited-scene time. For a moment, give its range and identifying detail. For a summary, follow the footage's order. Ground each claim in a frame, a timestamped transcript or measured metadata; state uncertainty where the evidence is incomplete.

This skill reads footage. For changes, use `editor.md`. Read `../SERVICE_MAP_SYKA.md` for provider availability; it overrides upstream cloud examples.
