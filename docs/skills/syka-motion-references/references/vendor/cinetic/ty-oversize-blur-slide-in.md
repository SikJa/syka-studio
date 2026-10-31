# Oversize word slide-in

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ty-oversize-blur-slide-in
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: typography_motion; energy: high; role: signature; formats: launch, sting, feature

## Mechanism
A huge word arrives streaked from beside the frame and brakes on a long tail, and a trailing word follows from further out and closes the gap so the phrase locks together.

## Use when
The energy peak of a type act; a two-word claim; a cold open whose first frame already moves.

## Avoid when
Long phrases; when screen direction must run the other way across the cut; small type.

## Original recipe (adapt to Syka native time and nodes)
Type height 21-25% of the frame. Word 1: x = x_f + 0.4W x (1 - prog(f, s, s + 90, E.out)) - 0.5 x (f - s), a long braking tail on top of a slow drift that never stops, with opacity 0.2 -> 1 over the 16 f it takes to fall below 20 px/f, so it travels faded. Word 2 starts 16 f later with a larger offset (0.6W) on the same curve, so the gap between the words shrinks from about 1.7x to 1x over about 80 f, and its opacity rises 0.2 -> 1 over 68 f; letters may fade on left to right 2 f apart as each word slows. Frame 1 runs about 52 px/f (78 for word 2), so render the blurred master; blurIn(p, 10) stands in for the sharp preview.

## Original timing
Brake 90 f E.out (feels like a 33 f time constant); word 1 offset 0.4W (768 px), word 2 0.6W from +16 f; drift 0.5 px/f; opacity from 0.2, readable below 20 px/f from frame 16 (word 2 from frame 21); gap 1.7x -> 1x over 80 f.

Upstream evidence count: 3; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
