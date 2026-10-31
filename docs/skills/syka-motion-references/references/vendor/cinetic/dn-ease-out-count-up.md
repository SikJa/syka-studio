# Ease-out count-up from a near-final value

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · dn-ease-out-count-up
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: data_and_numbers; energy: medium; role: workhorse; formats: any

## Mechanism
A proof figure counts up in place from a credible value just below its target and decelerates, so the last units tick in one at a time and it reads in about half a second.

## Use when
A single proof figure (countries, users, a price) must register in under a second, or a number inside a UI shot should feel live.

## Avoid when
The number is the film's hero reveal and deserves a reel or a snap-out; nothing on screen causes the count to start.

## Original recipe (adapt to Syka native time and nodes)
Compute the shown value on whole frames: v = Math.round(mix(a, b, prog(fd(frame), at, at + 28, E.type))), with a at 85-90% of b (173 to 195, 734 to 799), so early frames jump 2-3 units and the last ones step by 1. Use E.out only for ranges over ~500 units, where its long tail still has digits to tick. Render the value as plain text through typeStyle (tabular-nums), with a fixed digit count and Intl.NumberFormat separators so the box never changes width, and let the digits replace in place each frame: no roll, no crossfade. Start the count on the frame its cause lands and put ticks on countSteps(a, b, at, 28, E.type) frames, thinned to at most one every 2 f. After it lands, keep the block alive with breath() on the camera (2-3%) until the next element covers it.

## Original timing
Hero count 28 f on E.type (quad-out: 2x the mean rate at the start, so the last unit lands in the final ~6 f). Prices and recounts 36-46 f; ambient UI KPIs 36-104 f. Start at 85-90% of the target. Hold the landed figure at least 36 f (plus 6 f per word of any label) under a 2-3% breath before anything covers it.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
