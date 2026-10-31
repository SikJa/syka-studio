# Staggered word roll

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ty-staggered-word-roll
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: typography_motion; energy: medium; role: workhorse; formats: any

## Mechanism
The words of a phrase roll up and away one after another while their replacements rise in from below, so one sentence mutates instead of cutting.

## Use when
Swapping one claim for the next in place; a URL replacing a tagline; a category word turning into the product name; a closing bookend that rolls the opening phrase into the brand line.

## Avoid when
Swaps where nothing persists (a cut or ty-blur-swap-rescale reads cleaner); more than two rolls in a row without a different move between them.

## Original recipe (adapt to Syka native time and nodes)
For slot i, t_i = t0 + 10i. Out: q = prog(f, t_i, t_i + 12, E.in), translateY = -depart(q) x 0.2 em, opacity = 1 - prog(f, t_i, t_i + 12, E.smooth), blur = blurOut(q, 6). In, starting at t_i + 4 (a 4 f overlap): p = prog(f, t_i + 4, t_i + 28, E.out), translateY = (1 - arrive(p)) x 0.25 em, opacity 0 -> 1 over 10 f, blur = blurIn(p, 8). Keep any shared element (an icon pill, an unchanged word) perfectly still as the anchor, always roll in the same direction, and re-centre on SPR.firm when the new words change the width.

## Original timing
Out 12 f E.in, 0.2 em up; in 24 f E.out from +0.25 em (peak about 7 px/f at 120 px type), 4 f overlap; stagger 6-11 f per word; a phrase swap takes about 50 f; a whole-line conveyor variant leaves exactly 1 empty frame between the lines.

Upstream evidence count: 4; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
