# Hero bar in close-up, then pull back

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · dn-hero-bar-pullback
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: data_and_numbers; energy: medium; role: signature; formats: launch, feature

## Mechanism
The winning bar (or the hero chart) grows across a tight frame, then the camera eases back to show the whole chart, with the grey comparison bars and their values.

## Use when
Benchmarks and comparisons the product wins; any chart whose hero value should be felt before it is compared.

## Avoid when
Narrow wins, which the close-up would oversell; more than ~6 bars, whose labels go unreadable after the pull-back.

## Original recipe (adapt to Syka native time and nodes)
Lay the whole chart out in world space with the anchor camera (src/lib/camera.ts): the hero bar in C.accent, the comparison bars in C.mute, values at the bar ends. Shot A frames the hero bar at k of about 1.33-1.5. Grow its width over 50 f on E.smooth while the camera pushes 4% and tracks the tip at about 60% of frame width; keep the tip at or under 70 px/f on screen (on-screen length x 2.86 / frames). On the landing frame, pull back with lc(A, B, prog(frame, land, land + 80, E.cam)) to the full chart at k = 1. The grey bars are already at value, the labels type in with TypeOn, and the percentages count on E.type over 28 f, 4 f apart top to bottom, starting 12 f into the pull-back.

## Original timing
Bar fill 50 f on E.smooth (no overshoot) with a 4% push. Pull-back 52-80 f on E.cam to 0.65-0.75 of the close scale. Values count over 28 f on E.type at a 4 f stagger. Hold the full chart at least 36 f under a breath.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
