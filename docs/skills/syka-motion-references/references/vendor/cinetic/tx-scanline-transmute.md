# Scanline transmutation

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · tx-scanline-transmute
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: texture_and_finish; energy: medium; role: signature; formats: launch, feature, sting

## Mechanism
A bright bar sweeps down a hero object: above the bar the object has already become its digital form, a dot-matrix disc with a crisp rim, while below it the original solid object remains.

## Use when
One hero transformation per film: an object becoming its private, digital, encrypted or connected form; the moment the concept turns.

## Avoid when
More than once per film; ordinary UI state changes; objects under ~25% of frame height, where the dot pitch cannot read.

## Original recipe (adapt to Syka native time and nodes)
Stack two copies of the object in one container: the solid version and a dot-matrix version (an SVG <pattern> of 5 px-radius circles on a 16 px pitch, clipped to the object's outline, plus a 2 px rim stroke). Drive one value y (percent of the object's height) and clip the dot layer with `clipPath: inset(0 0 ${100 - y}% 0)` and the solid layer with `inset(${y}% 0 0 0)`; draw the bar as a hard-edged rect centred on y, 3-4% of the frame height thick, clipped to the object's column so it enters already moving from 8% above the object. Chain three segments: -8% to 45% over f0-11 on E.linear, 45% to 50% over f11-17 on E.linear (a near-hold that catches on the object's symbol), 50% to 100% over f17-34 on E.glide; the fast segments run 20-40 px/f and get the blur pass. Put a whoosh apex on the third segment's velocity peak and a snap on f34.

## Original timing
34 f in all: 11 f fast (20-30 px/f at 1080p), a 6 f near-hold at ~4-6 px/f on the symbol, 17 f on E.glide to rest; bar 36-40 px; the transformed object then holds 24-40 f with a drift under 1 px/f.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
