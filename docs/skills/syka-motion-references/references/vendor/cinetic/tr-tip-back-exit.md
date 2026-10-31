# Tip-back exit

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · tr-tip-back-exit
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: transition; energy: medium; role: workhorse; formats: launch, feature, walkthrough

## Mechanism
The outgoing scene tips away from camera like a sheet laid onto a table, or flips up into a line, speeding up and fading into the next stage colour, and the next element lands on the clean field.

## Use when
Ending a UI section to hand over to a statement or an alert, when the next beat needs an empty stage for big type.

## Avoid when
The next act opens on the same pose (use a relay instead), or the dim would go to black and back up (a dip) instead of into the next stage colour.

## Original recipe (adapt to Syka native time and nodes)
Wrap the outgoing scene in a 3D container (transform-origin 50% 100%, perspective 1200 px) and tip it: rotateX 0 → 40 deg and translateY 0 → +10% over 30 f on E.smooth. Lay a floor of the stage colour over it, opaque across the bottom 25% and transparent from 55% up, so the scene sinks into the stage, and dim it toward the next act's stage colour (overlay 0 → 0.9) over the last 12 f. Fast version: rotateX 0 → 88 deg with translateY 0 → −400 px over 20 f on E.contact (last frame about 70 px/f), so the scene flattens into a line at the top edge and uncovers what sits beneath. Flat version: a clip-path inset from the bottom grows on E.contact over 24 f, and the cut lands on its fastest frame. The next element starts on the frame the exit clears, or 1 f before.

## Original timing
Tip-back: 30 f on E.smooth (rotateX 40 deg). Flip to a line: 20 f on E.contact. Crop collapse: 24 f on E.contact. Dim overlay 0 → 0.9 over the last 12 f. The next element starts 0-1 f after the exit clears.

Upstream evidence count: 4; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
