# Two-beat confirm cascade

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · mi-two-beat-confirm-cascade
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: micro_interaction; energy: calm; role: workhorse; formats: feature, walkthrough, vertical

## Mechanism
A row of buttons or toggles confirms one by one: the label or knob changes first, the fill follows a beat later, and the rows go at uneven, human gaps.

## Use when
Several integrations, permissions or capabilities switch on, and each confirmation must stay legible at video speed.

## Avoid when
There is only one control (use the press envelope), or every row would start at the same interval.

## Original recipe (adapt to Syka native time and nodes)
Give the rows irregular start frames, never a metronome: for example [0, 4, 19, 37] for four toggles, or [0, 10] for two buttons. Button: swap the label at t0, with a 4 f crossfade or a 6 f roll (the old label rises 8 px and leaves, the new one enters from 8 px below through arrive()). Then mix the background from C.ink2 to C.accent over 8 f E.out, starting at t0 + 12. Toggle: slide the knob 0 to 20 px over 8 f E.out with no overshoot, and mix the track from C.line to C.accent over 10 f E.smooth from the same frame. Put a light 'tick' (weight 0.25-0.35, panned by x) on each state change.

## Original timing
Label 4-6 f; fill 8 f E.out at +12 f. Knob 8 f E.out; track 10 f E.smooth. Row gaps such as 4, 15 and 18 f.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
