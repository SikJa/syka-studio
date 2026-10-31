# Seed build with stroke draw-on

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · le-seed-stroke-build
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: logo_and_end_card; energy: medium; role: workhorse; formats: launch, sting, feature, loop, vertical

## Mechanism
The mark grows from a small seed while its strokes, stripes or arcs draw on in a quick stagger, so it assembles itself in about half a second and the label rises in beside it.

## Use when
Geometric marks made of a body plus lines, stripes or orbits. A fresh logo reveal after a hard cut to a clean stage. Stings that must show the mark within 0.5 s.

## Avoid when
Solid single-shape marks (there is nothing to draw). Marks with more than ~5 parts (it turns into a slow queue). The mark already exists on screen as the story device.

## Original recipe (adapt to Syka native time and nodes)
Build the mark from named parts (Mark pieces with per-piece transforms). Grow the body from a seed with scale lmix(0.2, 1, prog(f, a, a+54, E.out)) about its centre. Draw each line part on with stroke-dasharray = its length L and stroke-dashoffset = L * (1 - p). Reveal each filled stripe through a mask rect whose scaleX goes 0 -> 1 from one end. Part i starts at a + 6 + 6i and runs 10 f on E.out. When the last part lands, raise the label letter by letter from behind its baseline: each glyph sits in an overflow-hidden line box and moves translateY 100% -> 0 through arrive (or use MaskRise for whole words). Then push the whole group gently through the hold.

## Original timing
Seed growth: 54 f on E.out (about 0.2x -> 1; first-frame edge speed ~4 px/f). Parts: 10 f each, 6 f apart (3 parts inside ~28 f). Label glyphs: 2 f apart, 12 f each on E.out. The whole mark reads within ~0.5 s. Then a 90-120 f hold that pushes from 1.0 to 1.10-1.15 on E.dolly (le-living-hold).

Upstream evidence count: 3; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
