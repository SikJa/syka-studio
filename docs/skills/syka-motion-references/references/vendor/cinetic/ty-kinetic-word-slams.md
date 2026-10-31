# One-word slam sequence

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ty-kinetic-word-slams
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: typography_motion; energy: high; role: signature; formats: launch, sting, vertical

## Mechanism
A line is read one huge word at a time: each word hits oversized and blurred, settles, then is sucked away as the next word cuts in.

## Use when
A punchy 3-5 word line on a strong beat; a problem statement or rhythmic claim; vertical formats where one word fills the screen.

## Avoid when
More than one sequence per film; lines over 5 words; calm films; a card for a lone connector word (fold it into the next word).

## Original recipe (adapt to Syka native time and nodes)
Each word is its own card, fitted to about 77% of the frame width with fitSize. Entry: scale = lmix(1.35, 1, p), p = prog(f, cue - 1, cue + 21, E.outSoft), opacity 0 -> 1 over 3 f, blur = blurIn(p, 12), then a 6 f drift (scale x 1.01). Never start above 1.35x: a larger start leaves the outer letters of a frame-wide word moving faster than 20 px/f after the blur has cleared. Exit: scale x lmix(1, 0.6, q), q = prog(f, end - 14, end, E.in), opacity to 0 on E.smooth over the same window, then a hard cut to the next word on its slam's first frame, with every cut on an act boundary so the blurred master never smears two words together. Optional echo: two copies behind the word use the entry progress at f - 2 and f - 4, at 0.35 and 0.18 opacity, tinted 50% toward the ground, so they converge into the word by +12 f.

## Original timing
Entry 22 f E.outSoft from 1.35x (the edges of a 1120 px word start at about 43 px/f, faded and blurred, and are near 22 px/f by frame 4 when the blur clears), blur 12 -> 0 by about frame 4, drift 6 f, exit 14 f E.in to 0.6x (last frame about 72 px/f, nearly transparent); 36-42 f per word (0.6-0.7 s), last word held at least 54 f under a 1-2% scale creep; every hit on a beat.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
