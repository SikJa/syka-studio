# Single inversion card

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · cl-inversion-card
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: color_and_light; energy: medium; role: signature; formats: launch, feature

## Mechanism
In an otherwise dark film, one card cuts to a near-white field with dark type for one second, marking the key promise.

## Use when
A dark film's single most important promise needs to stop the viewer halfway through.

## Avoid when
Light-mode films, films that already alternate dark and light, or when the music has no gap to place it in.

## Original recipe (adapt to Syka native time and nodes)
At about 40% of runtime, inside a gap in the music, hard-cut to an AbsoluteFill of cream C.paper whose edges carry a soft ring of colour, fading from white at 55% of the radius through two accent hues to the frame edge. Set the line in C.ink and rise it out of a line mask: overflow hidden, translateY from 100% to 0 through arrive(), on E.out. Let the ring breathe, with its scale moving between 1.00 and 1.02 on sin(2π·frame/120). Frame mean luma jumps from about 9 to about 232, so this must be the film's only light frame; cut out hard on the next beat.

## Original timing
Hold for 60 f. The type rises over 18 f on E.out, starting on f4. The ring breathes with a period of 120 f, ±2%. Place it at about 40% of runtime.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
