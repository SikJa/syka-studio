# Stipple only in lit ramps

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · tx-ramp-masked-stipple
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: texture_and_finish; energy: calm; role: accent; formats: launch, feature, loop

## Mechanism
A visible dithered stipple lives only inside lit edges and light falloffs, while the flat stage around them stays perfectly clean.

## Use when
Dark films with lit edges, light pools or soft falloffs that risk banding, where a global grain would dirty a deliberately clean stage.

## Avoid when
Films already running global grain (double texture); light stages; hard-edged flat design with no ramps.

## Original recipe (adapt to Syka native time and nodes)
Bake each lit ramp (a lit edge on a shape, a light pool, a floor falloff) as an RGBA PNG with scripts/dither-gradient.py, then give the element that carries it a child layer of a static seeded noise tile (sigma about 64 levels around mid-grey) masked by that same PNG (`maskImage: url(fx/rim.png)`, `maskSize: '100% 100%'`), blend overlay at opacity 0.08-0.12. The noise sits inside the ramp's own transform so it travels with the light instead of swimming through it, and wherever the ramp's alpha is 0 the stage gets no texture at all. Check it with the x12 stretch from `dither-gradient.py --preview`: stipple inside the ramp, none on the stage.

## Original timing
Static texture that moves rigidly with its ramp; high-pass sigma about 1.9 code levels in the brightest ramps, 0.5-0.9 in faint falloffs, 0.0 on the flat stage.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
