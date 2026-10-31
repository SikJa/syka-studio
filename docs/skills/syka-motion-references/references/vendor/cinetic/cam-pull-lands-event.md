# Pull-back that lands an event

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · cam-pull-lands-event
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: camera; energy: calm; role: workhorse; formats: walkthrough, feature, launch

## Mechanism
A long, gentle pull-back runs from a close-up to the full view, and as it decelerates the next UI event (a modal, labels, a caption) starts, so it lands together with the camera's settle.

## Use when
Walkthroughs and single-take films that move pose to pose, and any long move whose ending would otherwise be a dead beat.

## Avoid when
Short or fast moves under 50 f, where an event in the tail just competes with the motion, and the finale, where the lockup needs a clean frame.

## Original recipe (adapt to Syka native time and nodes)
Pull with lc(CLOSE, WIDE, prog(f, a, a + 108, E.smooth)), where WIDE.k is about 0.56 x CLOSE.k. Start the event at a + round(0.72 x 108) = a + 78. A modal arrives on SPR.firm from 0.92 to 1 scale, opacity up over 8 f, landing within 4 f of a + 108. Captions start no earlier than a + 81 (the last 25% of the move) and no later than a + 114, while labels and values can type in through the whole pull. After the settle, hand over to a breath creep instead of a dead lock.

## Original timing
108 f on E.smooth, zoom x0.56, peak about 1.5%/f (about 24 px/f) mid-move. Event starts at 72% of the move; the SPR.firm modal settles within 4 f of the camera. Captions start in the last 25% of the move or up to 6 f after it.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
