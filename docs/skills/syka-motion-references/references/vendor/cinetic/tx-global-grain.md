# Global frame-keyed grain

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · tx-global-grain
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: texture_and_finish; energy: any; role: workhorse; formats: any

## Mechanism
A fine, even grain sits over the whole film at one strength, breaking banding in soft ramps and blurred plates and giving flat colour fields a tactile surface.

## Use when
Films with large flat or saturated colour fields, soft lighting ramps, blurred photo plates, or a tactile, filmic brand.

## Avoid when
Crisp, clinical UI films where any texture reads as dirt; when the strength would have to change between scenes; as a fix for banding that dithered PNGs should solve.

## Original recipe (adapt to Syka native time and nodes)
Bake 8 seeded noise tiles offline (512x512 PNG, numpy gaussian noise with sigma about 90 levels, centred on the stage's own luma so the stage is not lifted); never Math.random or an animated feTurbulence. Add one full-frame top layer: a div with the tile as backgroundImage, normal blend at opacity 0.015-0.02, tile index Math.floor(fd(frame) / 2) % 8, and backgroundPosition offset by Math.floor(rand(index) x 512) px in x and y so the repeat never shows. Keep the same strength from the first frame to the last (never per scene), verify on a flat mid-grey crop (sigma about 1.5-2 code levels) and confirm forensics.py reports no smear. Grain does not replace baked dither: soft gradients still ship as dithered PNGs from scripts/dither-gradient.py.

## Original timing
New tile every 2 f; constant strength (sigma ~1-2.3 code levels) for the whole film; no fades and no per-scene changes.

Upstream evidence count: 3; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
