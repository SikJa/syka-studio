# Accelerando into the climax

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ps-accelerando-to-climax
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: pacing_structure; energy: high; role: accent; formats: launch, sting, feature

## Mechanism
Shot lengths shrink step by step toward the climax, then one designed freeze on silence resets the clock just before the payoff lands.

## Use when
The run-up to a reveal, a collage burst or the lockup in launch films and stings.

## Avoid when
Walkthroughs where each shot carries UI that must be read, and films already cutting under 60 f per shot throughout.

## Original recipe (adapt to Syka native time and nodes)
Plan the last 5-7 shots before the climax on the beat grid, each about 0.7x the length of the one before: for example 4, 3, 2, 1.5, 1 and 1 beats at 120 BPM (120, 90, 60, 45, 30 and 30 f). Text only goes on shots long enough for the copy rule, and shots without text can go down to 24 f. Each shot ends on the accelerate-into-cut ramp, scaled to its last 40% on E.in, while the score section steps from groove to build beneath it. The run ends on a 12-15 f freeze sitting exactly on a score.json silences entry, and the climax move starts at full speed on the next downbeat.

## Original timing
Shots 120, 90, 60, 45, 30, 30 f (about x0.7 each, minimum 24 f without text); exit ramps on the last 40% of each shot, E.in; freeze 12-15 f on true silence; climax on the next downbeat.

Upstream evidence count: 0; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
