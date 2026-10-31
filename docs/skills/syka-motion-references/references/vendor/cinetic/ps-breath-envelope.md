# Breath envelope per card

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ps-breath-envelope
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: pacing_structure; energy: medium; role: workhorse; formats: launch, feature, vertical

## Mechanism
Every card arrives fast and decelerates, keeps moving gently through its hold, then accelerates away and is cut on its fastest frame.

## Use when
Statement cards, kinetic type and feature cards in a fast-cut film where nothing should ever look frozen.

## Avoid when
Dense UI that needs a dead-still read (lock the camera instead), and the final lockup hold.

## Original recipe (adapt to Syka native time and nodes)
Drive each card's container with one summed transform of three terms. Arrival: tw(f, 0, 36, 90, 0, E.out) px of translate (or scale lmix(1.08, 1, prog(f, 0, 36))), with arrive() on vertical text moves and blurIn only while the card travels faster than 12 px/f. Hold: a linear drift of 0.4-1 px/f, or breath() from src/lib/camera.ts at about +0.06%/f, optionally with letter-spacing tightening 2-3% over 40 f on E.outSoft from the landing frame. Exit: tw(f, T-16, T, 0, 100, E.in) px (or +6% scale) with blurOut, and the hard cut on frame T, which is the exit's fastest frame. Because the terms add, speed follows a U (fast, slow, fast) and never touches zero mid-card; the hold length follows the copy rule (36 f + 6 f per word).

## Original timing
Arrival 20-50 f E.out (default 36, peak about 15 px/f). Hold = 36 f + 6 f per word at 0.4-1 px/f or +0.06%/f scale; the drift rate is never 0 for more than 6 f. Exit 14-20 f E.in, reaching 19-39 px/f on the cut frame. Example U: 14 then 3 then 39 px/f across 56 f. No near-still run over about 22 f before the end card.

Upstream evidence count: 7; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
