# Radial dash burst around a word

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · mi-radial-dash-burst
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: micro_interaction; energy: high; role: accent; formats: launch, sting, vertical

## Mechanism
Short dashes burst outward around a hero word on the beat, drift almost imperceptibly while it is read, then fly outward faster as the frame pushes into the cut.

## Use when
A single hero word on a beat needs a physical punch.

## Avoid when
The text is body copy, the shot is UI, or the burst has already been used once in the film.

## Original recipe (adapt to Syka native time and nodes)
Place 22 rounded rects (4x20 px) around the word at angles from rand(`dash${i}`), oriented radially, in C.ink at 60-80% opacity. Their radius is r = 187 + 87 * prog(f, b, b + 16, E.out) + 0.5 * max(0, f - b - 16), plus 176 * prog(f, cut - 20, cut, E.in) in the last 20 f while the camera pushes in. The motion-blur pass smears the burst and the exit. Start it on the beat the word lands.

## Original timing
Burst +87 px in 16 f E.out; drift 0.5 px/f for about 50 f; exit +176 px over the last 20 f E.in into the cut.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
