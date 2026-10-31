# Giant word punch-out

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · tr-giant-word-punch-out
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: transition; energy: high; role: signature; formats: launch, sting, vertical, feature

## Mechanism
A hard cut lands on an extreme close-up of an oversized word sliding fast and braking, its letters resolving one by one. A second cut jumps out to the whole word at reading size, arriving with wide tracking that slams together.

## Use when
A one-word claim or product name that deserves two beats: read it, then see it whole. Vertical cut-downs where one huge word fills the frame.

## Avoid when
Lines of more than two words, or words over about 10 letters (the close-up loses the word); or when the next shot needs the word small within a second.

## Original recipe (adapt to Syka native time and nodes)
Close-up act: set the word at 2-2.5x its final size, cropped by the frame, with x = x_end + (x_start − x_end)·0.92^f, starting at no more than 70 px/f. Each letter animates blur 12 → 0 px and colour C.mute → C.ink over 12 f on a 2 f stagger starting at frame 4, so the first letter lands sharp at frame 16, when the pan is down to about 18 px/f. Cut on the act boundary while the word still moves at 13-20 px/f. Wide act: show the whole word, with p = prog(f, 0, 30, E.out) driving scale lmix(1.38, 1, p) and letter-spacing from 0.8 em to its resting track. Add a horizontal-only blur (SVG feGaussianBlur stdDeviation '18 0') set by blurIn(p, 18), opacity 0.5 → 1 over the first 8 f, and colour mixColor(C.accent, C.ink, t) with t going 0.6 → 1 over 17 f. Hold 30-60 f, then exit on E.in over 6-12 f.

## Original timing
Close-up 18-22 f: starts at ≤ 70 px/f and slows ×0.92 per frame (about 18 px/f by frame 16); letters resolve over 12 f with a 2 f stagger from frame 4. Cut at 13-20 px/f residual speed. Wide entry 30 f on E.out: scale 1.38 → 1, tracking 0.8 em → rest, horizontal blur of 18 px gone by 60% of the move, outer letters ≤ 60 px/f. Colour settles in 17 f. Hold 30-60 f. Exit 6-12 f on E.in.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
