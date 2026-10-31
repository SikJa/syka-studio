# Multi-direction slam assembly

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ty-multi-direction-assemble
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: typography_motion; energy: high; role: accent; formats: launch, sting, vertical

## Mechanism
Each word of a short sentence flies in from a different side, oversized and streaked, and the sentence assembles on one baseline almost at once.

## Use when
Re-spiking energy after a calm, read-paced card; a payoff line that needs a burst; 3-5 short words.

## Avoid when
Long words that would cross each other in flight; straight after another high-energy type move; calm films.

## Original recipe (adapt to Syka native time and nodes)
Lay out the final line and give each word a start offset from a different side (+-220 px in x, or +200 px in y) and a start scale of 1.4. Per word: p = prog(f, s + d_i, s + d_i + 20, E.out) with delays d = [0, 4, 10, 12, 16]; translate = offset x (1 - p) (vertical offsets through arrive), scale = lmix(1.4, 1, p), opacity 0 -> 1 over 5 f, so each word stays faint while it moves faster than 20 px/f and the blurred master streaks it along its own direction. One quiet piece may simply fade in over 8 f while the others fly; once the line is complete it drifts from scale 1 to 0.99 over 60 f.

## Original timing
Per word 20 f E.out, 220 px travel (62, 47, 33, 23, 16 px/f on frames 1-5), scale 1.4 -> 1, opacity 5 f; delays 0/4/10/12/16 f; each word readable from about frame 5, the whole line resolved in about 36 f; then 1 -> 0.99 over 60 f.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
