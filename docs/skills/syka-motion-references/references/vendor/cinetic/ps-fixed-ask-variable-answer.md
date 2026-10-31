# Fixed-length ask, variable answer

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ps-fixed-ask-variable-answer
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: pacing_structure; energy: medium; role: workhorse; formats: feature, walkthrough, launch

## Mechanism
A demo repeats a fixed-length ask beat followed by a result whose length varies with its importance, so the rhythm teaches itself and the variations prevent fatigue.

## Use when
Prompt-to-result products, feature tours with one repeated action, and walkthroughs of 3-6 capabilities.

## Avoid when
Fewer than 3 instances (there is no pattern to learn), and stings.

## Original recipe (adapt to Syka native time and nodes)
Write the ask beat as one component with a fixed internal script, 6 beats long (180 f at 120 BPM). Typing takes 68 f however long the prompt is: visibleChars = fd(len * prog(f, 0, 68, E.linear)), with the first word pre-filled. Then an icon drop of 28 f, a chip morph of 16-20 f, cursor travel of 14 f on E.glide, a press of 32-40 f, and a plus-to-x rotation of 8-12 f as the cut cue. Results last 4-8 beats, and one hero result runs 2-3x the others. From the third cycle on, split the ask beat into a big-type or 3-4x close-up insert plus the card: the template stays and the framing changes.

## Original timing
Ask beat 180-188 f (6 beats); results 138-234 f, the hero result about 490 f; 4-5 cycles; close-up insert from cycle 3.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
