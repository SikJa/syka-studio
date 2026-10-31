# Loop seam hidden at a motion peak

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ps-loop-seam-on-motion-peak
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: pacing_structure; energy: medium; role: workhorse; formats: loop

## Mechanism
A loop wraps around on the fastest frame of a whip or push, so the last frame flows into the first with no visible restart.

## Use when
Autoplay loops for social, landing pages and product pages.

## Avoid when
Pieces that end on a lockup (it appears once, at the end), and loops whose first frame must work as a readable poster.

## Original recipe (adapt to Syka native time and nodes)
Make the clip length L a whole number of bars (for example 4 bars = 480 f at 120 BPM). Design frame 0 as the second half of a move, opening already travelling on E.out from full speed, and the last 12-24 f as the first half of the same move, an E.in ramp to the same speed and direction. Make every state a pure function of frame % L. Verify the seam by rendering frames L-2, L-1, 0 and 1: per-frame position deltas should match within 10%, and every discrete fd() state at L should equal frame 0. Wrap motion-blur sub-frame times modulo L so the seam frame smears like its neighbours, and loop the music bed on the same bar line.

## Original timing
L = whole bars (240, 480 or 960 f); seam move at 20-40 px/f with true motion blur; entry E.out 30-50 f, exit E.in 12-24 f; seam on the downbeat.

Upstream evidence count: 0; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
