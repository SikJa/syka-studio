# Slice-band glyph assembly

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ty-slice-band-assembly
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: typography_motion; energy: medium; role: accent; formats: launch, sting, feature

## Mechanism
Each letter builds up from thin horizontal slices that slide in from slightly different offsets at slightly different moments, faint and pale at first, until the word locks solid.

## Use when
A product or feature name that should feel assembled or digital. A name set beside a modular or pixel mark, including the one end-lockup build when the film bookends with it. A short title after a quiet beat.

## Avoid when
Lines over about 3 words, or type under 48 px (bands thinner than 3 px alias into noise). Prose. Delay spreads wide enough that the half-built word reads as broken for more than about 30 f. A film that already has a scramble decode.

## Original recipe (adapt to Syka native time and nodes)
Measure the word with measureTracked. Give each glyph an inline-grid cell holding N = 5 stacked copies of itself (6 copies for type above 160 px), with all copies in grid-area 1/1. Clip copy b to its band with clip-path: inset(calc(b * 100% / N - 0.5px) -0.1em calc((N - 1 - b) * 100% / N - 0.5px) -0.1em), on a line box padded 0.12 em on top and 0.26 em below, so neighbouring bands overlap by 1 px and no descender or overhang gets shaved. Band (i, b) starts at s + d, with d = fd(12 x rand(`${i}:${b}`)) (add 1 f per glyph for a left-to-right bias), and runs on p = prog(f, s + d, s + d + 20, E.out): translateX (1 - p) x sx x 0.12 em, where sx = rand(`x${i}:${b}`) > 0.5 ? 1 : -1; translateY (1 - arrive(p)) x 0.04 em; opacity over its first 8 f on E.linear; and color mixColor(C.mute, C.ink, p) on paper (stage tint to C.white on ink). On the frame the last band lands, swap the band stacks for one intact text layer, decided with fd, so no seam survives antialiasing, then tighten the tracking 0.03 em -> the token over 44 f on E.out. Beside a mark that slides aside, start the build at the slide's peak-velocity frame, so the letters seem to be pulled out by its motion.

## Original timing
Each band takes 20 f on E.out, with opacity over 8 f on E.linear and colour over the same 20 f. Band delays are 0-12 f from rand (plus 1 f per glyph if biased). The whole word is built in about 32 f (about 40 f with the bias). Offsets are 0.12 em sideways and 0.04 em vertical: about 4 px/f on frame 1 at 120 px type, so no blur. The swap to intact text takes 1 f, then the tracking tightens over 44 f on E.out. Hold at least 60 f with a drift of 0.3 px/f.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
