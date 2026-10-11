# Syka provider and service map

Verified against the local Diffusion fork through 2026-10-01. This document describes enabled code, not proof of every end-to-end media result. A real transcription of the user's 11-second recording succeeded using the configured Groq key: 26 timed words in 3 segments. Codex subscription was also tested with real edit/undo/check/capture on a synthetic project.

| Capability | Upstream service/endpoint | Syka implementation |
| --- | --- | --- |
| Desktop editor, assets, composition source, timeline, preview, local encoding/export | Local SolidJS/Electron/runtime/encoder | Preserved; no Diffusion account required. |
| Agent reasoning/code edits | Agent host for Claude Code or Codex | Codex user's subscription verified with real edit/undo/check/capture. Local source tools are bounded to the open project; no shared Diffusion credits. |
| Frame inspection and filmstrip | Local Mediabunny/canvas | Preserved. Codex can receive images via MCP supported content, not a complete video stream. |
| Waveform/silence measurement | Local decoded audio amplitude | Preserved. Measures levels, does not identify sounds or emotional tone. |
| Source transcription and scene captions | TRPC transcribe + signed GCS upload | Replaced by main-process Groq endpoint, user's separate key, whisper-large-v3-turbo. |
| Personal glossary and transcription spelling | Local Syka settings; optional Groq recognition hints | Local preferred terms/aliases, revision-checked saves and exact timed correction. No Diffusion account or provider call to edit the glossary. |
| Multimodal audio questions | TRPC analyze + getUploadUrl resumable GCS upload | Disabled with explicit unsupported error. Transcript/waveform are useful substitutes for some tasks, not equivalent hearing. |
| Image generation | TRPC generateImage | Diffusion generation endpoint remains disabled. Native Codex subscription image generation was verified with a real generated PNG, durable project save, library import/rename, rendered capture and MP4 export. It uses the subscription limits; no paid API fallback. |
| Video generation | TRPC generateVideo | Disabled. Catalog previously advertised Kling 3/O3/2.5 Turbo, Seedance 2.0, Veo 3.1/Fast, Wan 2.6, Hailuo 2.3. |
| Voice synthesis | TRPC textToSpeech | Disabled. Previously ElevenLabs v3 voices. |
| Music and sound effects | TRPC generateSound | Disabled. Previously ElevenLabs Music and SFX. |
| Hosted background removal | TRPC removeBackground | Disabled. Local object tracking is a separate tool. |
| Local human background removal / layer separation | HyperFrames 0.8.140 + u2net_human_seg / ONNX Runtime 1.21.1 | Implemented 2026-10-07 through inspector IPC and syka_remove_background. Real portrait/video apply, undo/redo, reopen and native export verified on Windows. Native video uses transparent PNG sequences plus one original audio layer; maximum 30 seconds per job. Background separation leaves a transparent hole, not inpainting. See guides/background-removal.md. |
| Hosted image/video upscaling | TRPC upscaleImage, upscaleVideo | Disabled. |
| Hosted adding generated audio to video | TRPC addAudioToVideo | Disabled. |
| Signed reference uploads/cloud storage | TRPC getUploadUrl + GCS signed/resumable requests | Disabled by the non-network TRPC link. Local Groq preparation does not upload to this bucket. |
| Accounts/auth/avatar/email settings | Supabase + hosted account methods | Removed from the local workflow; Supabase client disabled. |
| Subscription/topup/portal/invoices/billing | TRPC createSubscription/createTopup/createBillingPortal/getBillingInfo/listInvoices/getSubscriptionSummary | Disabled; corresponding UI removed. |
| Product and install telemetry | Renderer Umami and desktop Umami POST | No-op in both renderer and desktop, including packaged builds. |
| Crash reporting | Hardcoded Sentry client | Disabled in app initialization. |
| Object segmentation/tracking | Local SAM2 ONNX/WebGPU; weights hosted on public HuggingFace | Preserved. First download is a public artifact dependency, not Diffusion billing. Weight/model licensing and bundled attribution remain separate from MPL source. |
| Fonts | Runtime font fixtures originally include Google/S3 URLs | Separately audited by the desktop owner; do not describe unbundled fonts as offline or assume all fonts share MPL. |

## Groq credential boundary

- The renderer can submit a new key to the trusted main process but never reads it back. Provider status contains only configured/secureStorage/model.
- Electron safeStorage stores the encrypted key under the configured userData/providers directory. Windows uses OS secure storage. No plaintext fallback.
- Querying status or saving/removing the key does not contact Groq.
- Only an explicit transcription sends audio to https://api.groq.com/openai/v1/audio/transcriptions, with redirects disallowed and no Diffusion fallback.
- Renderer preparation uses the primary audio track, OGG Opus mono at 16 kHz, in chunks of at most 600 seconds. Main bounds uploads to 24 MiB, responses to 8 MiB, and request time to 180 seconds.
- Genuine word timestamps are validated. Segment text is never expanded into invented word timing.
- Successful raw chunks are cached by audio content/model/duration/recognition-prompt under userData/providers/groq-transcripts and can survive restart. OGG stream serials and their dependent CRCs are excluded from the fingerprint because the muxer randomizes them; timing, page order, packet boundaries and payload remain included. Source offsets are reapplied before applying glossary corrections once to the assembled transcript. Updating correction aliases alone reuses raw timing; changing the preferred hint text can require a new provider request on the next explicit transcription.
- Cancellation is checked between preparation/requests; the in-flight request has its own timeout. Immediate user-driven abort of a running Groq fetch is not yet exposed.
- Preserving word times through later editing still requires the composition's source-to-scene time mapping; the provider itself does not solve arbitrary cuts or speed changes.
- Earlier provider checks used mocked fetch and secure storage. On 2026-09-30 a real Groq transcription succeeded, with word intervals from 1.20 to 11.14 seconds. Credentials stayed inside Electron main. Automated tests still verify rejection/no-network boundaries, cache resume and real timing requirements.

Groq documents supported OGG uploads, 16 kHz mono preprocessing, verbose_json word timestamps and the tier-dependent upload limit at https://console.groq.com/docs/speech-to-text. Provider pricing/quota are not guaranteed by this application.

## Local glossary

- Configuración → Glosario stores `settings/glossary.json` inside the configured `userData` profile. The current project configuration places that profile on F; it is separate from project assets and the encrypted Groq credential. The schema is `{version:1,revision,entries:[{id,term,variants,enabled}]}`.
- `syka-glossary:get` reads it. `syka-glossary:save` requires `{expectedRevision,entries}`, serializes saves in Electron main, rejects stale revisions and replaces the JSON atomically. Missing files start empty; corrupt/unsupported files are rejected rather than silently reset. No network calls are made by either operation.
- Limits are 200 entries, 12 variants per entry, 80 Unicode characters per term/variant and 256 KiB persisted JSON. IDs must be unique UUIDs. Labels normalize NFC and whitespace, preserve diacritics, and reject hidden/control characters. Canonical names and aliases must not conflict, including disabled entries.
- Enabled preferred names also normalize their own capitalization. Corrections match whole words/phrases case-insensitively; accents remain significant. Longer phrases take precedence. This is an exact glossary, not fuzzy matching or semantic rewriting; corrected output is not recursively corrected again.
- Enabled preferred terms feed a conservative 200-byte UTF-8 Groq prompt in saved order; terms that do not fit are omitted from that prompt, while their local correction rules still work. Groq documents a 224-token prompt limit; Syka's smaller byte budget is a conservative application bound, not an exact tokenizer count.
- `syka-glossary:apply-transcript` applies the current glossary locally after real chunk times have been offset/merged. It accepts at most 50,000 segments, 300,000 timed units, 8 MiB of word text, and valid finite timestamps within 24 hours. The normal renderer requests raw Groq chunks and applies the glossary once after merging, including phrases crossing caption groups or chunk boundaries.
- If preferred and recognized phrases have the same number of words, every original word interval is retained. A contraction/expansion becomes one caption unit, using the first original start and last original end; no estimated per-word timing is fabricated. Surrounding punctuation is preserved.
- The glossary applies to **new explicit transcriptions/captions**. Saving settings does not modify existing caption assets, regenerate media on remount, upload audio or consume Groq requests. Applying it to an existing saved transcript without another transcription is a separate, unimplemented action.
- Backend persistence/CAS/correction tests and mocked Groq/merge tests passed; UI CRUD, stale-save rejection, reload and isolated Electron restart were verified separately. No real Groq audio request or account key was used.

## Local does not mean every model is offline

The editor, project files, assets and export engine run locally. Opting into Codex/Groq sends task context/media as required to those providers under the user's own account. Removing Diffusion subscriptions does not make Codex or Groq offline or unmetered.

## Distribution boundary

Upstream MPL notices remain in reused source. Branding assets excluded by upstream are replaced. Public model/font assets and third-party dependencies require their own notices and review before a distributable installer is declared fully audited.

## Current embedded chat tool boundary

Codex has source read/edit/undo/redo tools, local MCP inspection tools (context/check/capture/fonts/probe/grab/filmstrip/waveform) and `media_transcribe`. The latter uses the user's separately configured Groq key when transcription or spoken-content editing is requested; it is not direct audio hearing through Codex. New sessions include instructions to call the tool and save a fresh transcript JSON under the open project's `03 Assets reutilizables/Transcripciones`.

`syka_read_transcript` reads paginated timed words from that project folder, including real start/end times and a next-page offset. It rejects other folders, outside files, junction escapes, malformed timing, files over 8 MiB and pages above 500 words. It cannot edit media or transcripts; source editing retains its existing boundary. Transcript creation refuses to overwrite an existing file. Export is also available directly to the embedded agent through the exposed MCP export tool. The stream clipping pipeline remains future work.

Manual source batches and embedded source-tool edits share a persistent project journal with CAS, exact snapshots and chronological undo/redo. This supports an existing authoring source file up to 16 MiB per batch; it is not universal undo for assets, exports, filesystem moves or multi-file transactions. An external source edit blocks shared undo/redo instead of being overwritten; the preview can still compile that current source without adopting/resetting its history.

## Expanded bridge (2026-10-01)

The embedded Codex MCP allowlist now derives from the full DAPI catalog (19 tools), including new assets operations. Workspace tools support creating components/files, paginated text reads, and discovery/read of project, personal and editor skills. Native shell/apply_patch and network access are enabled in trusted local execution mode, as explicitly requested. Scoped project file tools still reject path escapes and accidental overwrites; this does not restrict native shell capabilities. External MCP/apps/plugins from the desktop profile are not automatically inherited; this is an embedded local app-server, not a copy of the desktop chat.

Native session persistence and thread/resume replace the previous ephemeral-only reconstruction; the bounded recent conversation remains a fallback for older unavailable sessions. The report tool now writes a diagnostic Markdown file locally and never opens an upstream GitHub issue.

Images, library operations, capture/export, skills creation/read and native session recovery have real QA evidence under output/playwright/bridge-expanded. SAM2 tracking remains exposed but not validated with model downloads in this run. Semantic audio listening, generated voice/music/video, AI upscaling/removal and generated-audio addition still have no replacement provider configured. Local audio mixing and ordinary scaling remain available.
