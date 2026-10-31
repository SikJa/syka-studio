# Spinner resolves to a check

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · mi-spinner-to-check
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: micro_interaction; energy: calm; role: workhorse; formats: feature, walkthrough, launch, vertical

## Mechanism
A working indicator (a rotating dashed ring in a step list, or a small spinning disc pushed into the middle of a sentence) turns into a check with a short tag the moment the step is done.

## Use when
The product works through steps on its own (an agent, a sync, an import), and each completion should land as a small lock.

## Avoid when
There is a single long wait with nothing resolving (show progress instead), or all the checks would resolve on one frame.

## Original recipe (adapt to Syka native time and nodes)
Working: an SVG circle (r 10-12 px, 2.5 px stroke, dasharray '4 4' or a 270-degree arc) rotated (f - s) * 7.5 degrees, one turn per 48 f. Inline variant: open a slot between two words by tweening its width 0 to 1.4em over 6 f E.out (the words slide apart as flex siblings). In it, spin a 1.2em x 0.6em accent disc with a 3 px C.ink rim on rotateX, one turn per 24 f linear, in perspective 300px. Done: on the done frame (fd), replace the spinner with a check ring that draws strokeDashoffset 1 to 0 (pathLength 1) while scaling 0.6 to 1 over 8 f E.out. The tick path draws over 8 f from 3 f later, a small 'Done' tag rises 6 px and fades in over 8 f, and the step label mixes from C.mute to C.ink. Start the next step's spinner on that same frame, and put a pitched 'pop' on each check's 50% frame, climbing with each step.

## Original timing
Ring: one turn per 48 f, linear (disc: one per 24 f). Slot opens over 6 f E.out. Check ring 8 f E.out from 0.6; tick draws over 8 f from +3 f; tag 8 f. One step every 24-36 f.

Upstream evidence count: 3; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
