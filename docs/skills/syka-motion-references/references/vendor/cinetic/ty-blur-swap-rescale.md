# Blur-swap rescale

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ty-blur-swap-rescale
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: typography_motion; energy: medium; role: workhorse; formats: launch, feature, sting, vertical

## Mechanism
A big word blurs out and instantly re-forms smaller as the start of the full line, so the type changes scale without a rubbery size tween.

## Use when
Going from one or two giant words to the full readable sentence; right after tr-giant-word-punch-out; any big-to-small type handoff inside one continuous take.

## Avoid when
As a default between unrelated lines (it is not a crossfade substitute); small-to-small swaps; overlaps longer than 10 f, which read as a dissolve.

## Original recipe (adapt to Syka native time and nodes)
Use two layers and never animate font-size. Old layer: q = prog(f, s, s + 6, E.in), blur = blurOut(q, 12), scale x lmix(1, 0.85, q), opacity to 0 on E.smooth over the same 6 f, still moving in its current direction. New layer from s + 2: p = prog(f, s + 2, s + 16, E.out), scale = lmix(1.25, 1, p), blur = blurIn(p, 12), opacity 0 -> 1 over 6 f; carry any ongoing drift so both layers travel at the same px/f. Optional tracking collapse on the new line: letter-spacing +0.25 em -> the token's tracking over 16 f on E.out, so the small word arrives spread wide and slams together.

## Original timing
Old out 6 f (E.in, blurOut 12 px); new in 14 f from +2 f (E.out, blurIn 12 px, scale 1.25 -> 1, edges of a 1000 px line about 51 px/f on frame 1); 4 f overlap; typical cap-height change -35%; tracking collapse 16 f E.out.

Upstream evidence count: 3; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
