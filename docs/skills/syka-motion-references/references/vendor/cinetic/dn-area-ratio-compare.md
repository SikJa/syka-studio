# Area-true ratio comparison

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · dn-area-ratio-compare
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: data_and_numbers; energy: calm; role: accent; formats: launch, feature, vertical, loop

## Mechanism
A multiplier claim ('10x smaller') plays as a block that shrinks in log space to the area the ratio implies, leaving an outline of its old size behind.

## Use when
Multiplier and reduction claims about size, cost, time or footprint.

## Avoid when
Ratios above ~25x, where the block shrinks to a dot (show the number alone); claims that aren't really proportional.

## Original recipe (adapt to Syka native time and nodes)
Draw block A at side s in C.mute, anchored bottom-left on a baseline. At the cue, scale it from that corner with lmix(1, 1/sqrt(ratio), prog(frame, at, at + 48, E.smooth)), so its area ends at 1/ratio and the shrink keeps an even ratio per frame. Its fill mixes to C.accent over the last 12 f, and a 1.5 px C.line outline stays at the original size as the reference. The ratio figure counts beside it on E.type over 36 f and lands on the same frame as the block. For speed or time claims, compare bar lengths (a linear ratio) instead of areas.

## Original timing
Shrink 48 f on E.smooth via lmix. Fill mixes to the accent over the last 12 f. Ratio count 36 f on E.type, landing with the block. Hold at least 36 f under a 2% breath.

Upstream evidence count: 0; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
