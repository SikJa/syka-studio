# Edit footage in Syka

Default to one main composition: add all footage, captions, audio and motion graphics inside the existing active scene. Do not create a second scene or activate a demo just to fulfill an editing request. Additional independent compositions require an explicit user request. The editor shows a single composition by default and provides an optional overview.

Use the existing project unless the user asks for a new one. Syka keeps Diffusion's local JSX authoring and rendering engine. The source file is the document shared by manual editing and the agent: writing and saving recompiles the preview.

Read `watch.md` to inspect footage and `../SERVICE_MAP_SYKA.md` before choosing a provider. Diffusion's hosted AI, credits and login are disabled.

## Editing loop

1. Read `context` and the project source. Confirm the open project, relevant scene, selection, source asset paths and original timings.
2. Inspect the source with `media_probe`, `media_waveform`, `media_filmstrip` and targeted `media_grab` frames. When speech is needed, `media_transcribe` uses the user's configured Groq account.
3. Preserve original media. For existing authoring source, configuration, stylesheet and skill files up to 16 MiB, source read/edit/undo/redo tools and single-file manual batches share the persistent project journal. Read the current hash before editing; undo must target the latest mixed revision, not a stale chat edit beneath a newer manual one. Multi-file batches fail before writing, and external changes block history rather than being overwritten. Assets, generated files, moves and exports are outside that journal: preserve separate recovery copies for those operations.
4. Assemble the primary footage first, preserving meaning, intentional pauses, examples and the user's style. Explain ambiguous repeated takes rather than deleting them blindly.
5. Add local B-roll, graphics, images, audio and editable text layers to the same composition. Prefer paths in the asset library. Do not use Diffusion cloud `generate.*` or `transform.*` declarations.
6. Add automatic scene captions after the audio placement is final; these transcribe the scene's audible mix through Groq. They fail clearly without a configured key. The local glossary applies to this new transcript after merge; saving glossary terms does not rewrite existing captions or automatically upload/transcribe again. Source-word times and edited-scene times are different domains; account for cuts and speed.
7. Check and capture meaningful moments, then export when the user's requested task includes export. Do not publish to external platforms automatically.

For nontrivial work, maintain a short editing brief inside the project so changes can be checked against it. Do not force an approval before each reversible change when the user has already authorized editing.

## Files, skills and library

- All 19 editor MCP tools are exposed, including assets, open, export and diagnostics. Provider-dependent tools can still report unavailable capabilities.
- Use assets list/import/folder/rename for the library; use the returned library path in JSX. Imported originals stay intact.
- Use syka_files to list/read/create project components, scripts and workflows; use syka_skills to discover/read project, personal and bundled editor workflows. Relative skill paths resolve against the project.
- Native shell/apply_patch are enabled for trusted local work, including multi-file changes and dependencies. Keep outputs in the configured project folders. Such changes are outside the single-file shared undo journal.

## Compositing and control

- Use the built-in audio, video, image, shape and caption elements supported by this engine; read the versioned JSX reference rather than assuming Remotion syntax.
- Use sequences where they keep related layers organized, with explicit clip starts.
- Expose useful title, color, font, sizing and placement constants with `@inspect` so the inspector can edit the same source.
- Use the user's branding. Do not reuse the upstream Diffusion brand kit, marks or excluded graphics as Syka branding.
- For HTML motion graphics, the local `<html>` surface and a paused anime.js timeline can be used; read `../guides/motion/easings.md` before selecting easing.
- Preview a segmentation prompt before tracking with `media_segment`; public SAM2 weights may need a first download. Wait for an asynchronous mask to finish before binding it.
- Keep added media deliberate: support the point, emphasis or pacing. Do not add a decorative layer merely because a template permits it.

## Verification

`check` finds structural issues; it does not judge editorial quality or guarantee every rendered frame looks right. `capture` inspects the edited scene; `media_grab` inspects original footage. Compare captures at important boundaries and text appearances with the brief. Use `screenshot` and `logs` for debugging.

Exporting the full video is not necessary for each preview. Preserve the user's selected output root. Report separately what was changed, previewed and actually exported.

## Capability limits

- No Diffusion accounts, billing, credits, cloud uploads or hosted transformations.
- `media_listen` is disabled. Codex can reason from images/transcripts; direct semantic listening requires a separate supported provider.
- `models` and `voices` are empty cloud generation catalogs. Native Codex subscription image generation is connected and verified. Use the native image tool, then syka_generated_images and assets import; the empty catalogs only describe disabled Diffusion cloud providers.
- No external publication unless explicitly requested.

## References

- `../reference/jsx/README.md`: elements, timing and parameters.
- `../reference/tools/README.md`: schemas and CLI spellings.
- `../examples/README.md`: local composition examples.
- `../SERVICE_MAP_SYKA.md`: authoritative availability in this fork.

Some upstream guides describe paid or hosted generation. Treat those passages as unavailable here. The retained `diffusion`/`dapi` CLI names are compatibility aliases; the application is Syka.

## Local audio enhancement and agent management

Use syka_audio_enhance with an absolute local source path and gentle/speech profile when the user asks to clean existing audio. It uses FFmpeg and writes a new WAV under 03 Assets reutilizables/Audio mejorado, never overwriting the source. Import the result through assets and match clip trim, placement and playback rate when replacing the audible track. Capture cannot assess audio quality: compare listening and levels before reporting an improvement.

Configuration > Agent settings manages explicit HTTP/stdio MCP entries and local skills. MCP changes apply to new agent sessions. Skills can be created/imported/read/edited locally on F; edits preserve backups and reject stale revisions. No upstream billing or paid provider fallback is involved.
