# Fog floor

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · tx-fog-floor
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: texture_and_finish; energy: calm; role: workhorse; formats: launch, feature, walkthrough

## Mechanism
The bottom fifth of the frame lightens toward the stage's brightest tone, as if the UI hovers above a softly lit floor that receding planes can sink into.

## Use when
Light or pastel stages with 3D tilt-backs, lifts and recedes; any film that wants a horizon without drawing a floor.

## Avoid when
Flat, front-on UI with no depth moves; dark stages that already have a light pool; vertical frames where captions sit in the bottom fifth.

## Original recipe (adapt to Syka native time and nodes)
Bake a full-frame RGBA PNG with scripts/dither-gradient.py: linear, angle 0 (bottom to top), stops [floor tone at 0, floor tone at alpha 0.6 at 0.12, transparent at 0.22], where the floor tone is a near-white just above the stage in the same hue (OKLCH L about 0.98). Layer it above the background and below the UI. When a panel tilts back into depth (perspective 2000-2400 px, transformOrigin at its bottom edge, rotateX 0 to 60 degrees over 30-40 f on E.in), render a second copy of the fog above that panel so it dissolves into the floor, and take the panel's opacity to 0 on E.in over the last 12 f. On an ink stage the floor tone is C.ink raised OKLCH 0.04.

## Original timing
The floor band is 22% of frame height and fixed to the stage; tilt-backs 30-40 f on E.in with the fade over their last 12 f.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
