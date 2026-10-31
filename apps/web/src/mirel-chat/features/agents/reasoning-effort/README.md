# Reasoning Effort — AICSS / Syka

Original component: https://www.aicss.dev/components/reasoning-effort

Original registry: https://www.aicss.dev/r/reasoning-effort.json

Retrieved 2026-10-28. MIT license, Copyright (c) 2026 AICSS. The complete upstream license is in `LICENSE`; `source.json` records original file hashes. The unmodified registry snapshot is in `local-reference/catalogo-ui/2026-10-28/web/UI-011-registry.json` at the repository root.

This is the upstream React/SVG implementation, adapted to Syka's existing `EffortSlider` and `ModelReasoningPicker`. No new dependency is required.

Preserved: shell geometry functions, thumb, graduated ticks, shoulder/label motion, easing and timing. The wrapper retains Syka's localized heading, reset button and quota hint. The initial 224 × 52 blue prototype is superseded by the approved integration below.

Integration changes:

- Controlled value and change callback replace the demonstration's internal choice. Levels and their labels come from the actual model, including models with more or fewer than four levels.
- The actual model label replaces the hardcoded `4.7`; long labels are contained.
- Reset uses the current model option's declared default. Legacy cache fallback checks routing and refuses conflicting defaults; no invented default is introduced.
- Keyboard changes, pointer capture/cancellation, disabled state and model changes preserve controlled state. Slider arrow keys do not navigate the surrounding menu.
- Theme follows Syka's resolved `.dark` class and reacts to changes. Reduced motion follows the app override and OS preference.

## Requested motion adjustment

Sikora subsequently requested **stretch 100 only**, retaining the original speed. AICSS has no native `stretch` parameter; this adaptation defines `0` as its original deformation and `100` as 100% additional deformation: resting thumb 27.2 px, fully stretched thumb 40 px (upstream: 33.6 px). The upstream 220 ms shell movement, 90 ms shoulder adjustment and label timings are unchanged.

Pointer tracking uses a short, time-based interpolation scheduled with `requestAnimationFrame`. It stops when the thumb settles, on release/cancellation/disable, and on unmount. Selection callbacks remain immediate and discrete; only the visual position is smoothed. Reduced motion applies the value directly. This is a presentation adjustment, not an inference-speed setting.

This folder does not discover models, write account credentials or persist thread settings. Those responsibilities remain in the existing picker and callers. BoardUI integration and other catalogue components are outside this change.

## Approved selector integration — 2026-10-28

- Shared track length **184 px** in both orientations. Vertical rotates the same control and maps pointer Y from bottom to top; text stays inside the rotating SVG tab.
- Fill, active tick, focus ring and particle palette follow `--syka-accent` with `--primary` fallback. Changes in appearance, including wallpaper-derived accents, update live.
- Max/Ultra display continuous particles; the real advertised Fast service tier uses a different accent-derived gradient and faster particles. This does not alter model capabilities or enable unsupported tiers.
- `EffortPixels` mounts the original Pixel Card locally inside the fill. It stops while the document is hidden; reduced motion uses a static pattern. No document-wide canvas portal.
- `pixel-card/` preserves original code, hashes and the **MIT + Commons Clause** license. Source: https://github.com/DavidHDev/react-bits/tree/main/src/ts-default/Components/PixelCard — retrieved 2026-10-28. The application wrapper is separate from the vendor files.
