# Gobo-lit studio backdrop

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · tx-gobo-studio-shadows
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: texture_and_finish; energy: calm; role: workhorse; formats: launch, feature, walkthrough

## Mechanism
The UI floats over an off-white studio backdrop crossed by huge, very soft diagonal shadows, like window light through leaves, so flat screens feel photographed.

## Use when
Light-stage product films and walkthroughs that need depth and physicality without glass, colour or a 3D set.

## Avoid when
Dark stages; dense UI that fills the frame edge to edge; strictly flat graphic brands.

## Original recipe (adapt to Syka native time and nodes)
Stage C.paper (a cool off-white around #F7F7F7). Bake 3-5 shadow bands as RGBA PNGs at 120% of frame size with scripts/dither-gradient.py: linear gradients at 30-40 degrees, each going transparent to rgba(0,0,0,0.05-0.08) to transparent across 10-18% of the gradient line (the look of grey shapes blurred 100-150 px at 8-15% opacity, without the banding). Layer them above the stage and below the cards, and drift each along its own axis by A x sin(2 pi f / P + phi) with A = 40-80 px and P = 600-900 f, which keeps them under 0.5 px/f. Cards get `0 30px 60px rgba(0,0,0,.12)` and a 1 px C.line border.

## Original timing
Band drift under 0.5 px/f on sines with 600-900 f periods and spread phases; present in every light shot of the act, unchanged between shots.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
