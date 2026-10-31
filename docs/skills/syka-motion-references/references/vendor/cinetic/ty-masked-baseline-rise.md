# Masked baseline rise

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ty-masked-baseline-rise
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: typography_motion; energy: medium; role: workhorse; formats: any

## Mechanism
Each word rises out of an invisible line at its own baseline, tops of the glyphs first, as if cut out of the layout.

## Use when
Editorial headlines and in-UI headings that must land fast (a 3-word line in under 0.5 s) without stealing focus; titles that build while the plane or camera is still moving.

## Avoid when
Tight leading where the mask would clip the line above; a calm voice-paced read (use ty-blur-focus-word-rise); per-letter runs on anything but one short hero word.

## Original recipe (adapt to Syka native time and nodes)
Wrap each word in an inline-block with overflow:hidden and padding-bottom 0.15 em (room for descenders); the inner span goes translateY 110% -> 0 on arrive(p), p = prog(f, s_i, s_i + 12, E.out), s_i = start + 6i, with opacity 0 -> 1 linear over the first 3 f, because frame 1 moves about 57 px/f and must be streaked by the blurred master (render.sh --blur). Optional ink resolve: color = mixColor(C.mute, C.ink, prog(f, s_i, s_i + 10, E.linear)). For one short hero word, run it per letter with a 3 f stagger, or drop the letters unmasked from -0.25 em over 8 f, 4 f apart, so a small word falls into place. Exit back into the same mask (translateY 0 -> -110% on depart(q), q on E.in over 10 f) or with ty-reading-order-exit.

## Original timing
Per word 12 f E.out (10-14 f), travel 110% of the line box (about 132 px at 120 px type): 57, 34, 18 px/f on frames 1-3; opacity 3 f; stagger 6 f (4-10); per letter 3 f stagger; letter drop 0.25 em over 8 f, 4 f apart; mask exit 10 f E.in.

Upstream evidence count: 4; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
