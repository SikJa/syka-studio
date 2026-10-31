# One-hue light ramp

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · cl-one-hue-light-ramp
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: color_and_light; energy: calm; role: workhorse; formats: launch, sting, feature, loop

## Mechanism
Every lit thing (rims, rings, stage lifts, the end-card field) comes from adjacent lightness steps of one hue on a single near-black stage.

## Use when
Dark launch films with many light-built shapes (orbs, rings, rims) that need a recognisable look. It also makes a single bright card hit harder.

## Avoid when
Light-mode walkthroughs where the UI's own colours dominate, or films already using the monochrome-plus-accent system (pick one system).

## Original recipe (adapt to Syka native time and nodes)
Build five tokens of one hue with mixColor, running from the stage to a pale tint: C.ink, then mixColor(C.ink, C.accent, 0.2 / 0.45 / 0.75), then mixColor(C.accent, C.white, 0.5). Only ever draw a gradient between two adjacent steps, so the whole film's light comes from one decision. Rims, rings and orb lobes use the upper steps as crisp strokes or flat fills, never as soft halos or bloom, and the stage holds 63-99% of pixels on dark frames. For an end-card field behind a wordmark, use linear-gradient(to top, step0, step2 45%, step4) plus a repeating-linear-gradient(90deg) of flat, hard-edged 60-120 px bands at ±6% lightness (no blur, so they never read as fluted glass); the band layer drifts 0.3 px/f so the hold never freezes. Against banding, bake the field as a dithered PNG with scripts/dither-gradient.py and let the film's global 1.5-2% grain sit over it.

## Original timing
The palette stays the same. The end-card field holds 90-120 f with the bands drifting 0.3 px/f on E.linear.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
