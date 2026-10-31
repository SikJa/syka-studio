# Long-tailed beat lengths

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ps-long-tail-beat-lengths
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: pacing_structure; energy: any; role: workhorse; formats: launch, walkthrough, feature

## Mechanism
Beat lengths follow a long tail instead of an even grid: most beats sit near one median length, a few connective beats snap past at a third of it, and one or two hero beats run about three times as long, so the film never settles into a slideshow rhythm.

## Use when
Launch films and walkthroughs of 15 s or more with eight or more beats, any cut list that came out evenly spaced, and deciding where the hero feature gets its time.

## Avoid when
Polyrhythm loops and fixed-length ask cycles, where equal length is the point; stings under about 8 s, which have too few beats for a distribution; accelerando runs, which set their own length ratios.

## Original recipe (adapt to Syka native time and nodes)
Before animating anything, write the cut list in src/timeline.ts as a BEATS array of cut-to-cut lengths in 8ths, and derive the ACT and CUE start frames from its running sum with b() so every boundary sits on the grid. Pick a median M of 60-72 f (2-2.4 beats at 120 BPM, inside the house shot median of 60-90 f) and fill the list from four bins. Core beats run 0.75-1.33x M (about 60%: features, claims, answers). Connective beats run 0.25-0.5x M and never under 24 f (about 20%: a punch-in insert, a whip, a one-word card, an isolate hold). Long beats run 1.5-2x M (10-15%: a walkthrough setup, a two-step interaction). One or two hero beats run 2.5-3x M, capped at 180 f, the house shot maximum (the hero result or the key feature), placed in the back half before the sign-off. Put one or two connective beats directly before each hero beat so the hero lands as a release, and never let three neighbouring beats sit within 10% of each other in length. Beats under 42 f carry no readable text (the copy rule is 36 f + 6 f per word). A hero beat is filled with continuous action, either a camera journey or a UI event at least every 40 f, never a long hold. Beside grid-check, add a node check asserting that max/M is 2.5-3.0, min/M is 0.16-0.5, no beat exceeds 180 f and the coefficient of variation is 0.4-0.8. An evenly spaced cut list scores about 0.1 and reads as a slideshow.

## Original timing
M = 60-72 f. Connective beats 24-36 f (never under 24 f); core 0.75-1.33x M; long 1.5-2x M; hero 2.5-3x M, at most 180 f and at most 2 per film; coefficient of variation 0.4-0.8. Example 28.75 s cut at 120 BPM: 75, 60, 30, 75, 120, 45, 60, 75, 30, 75, 60, 45, 105, 60, 30, 180, 75, 45, 30, 180, 90 and 60 f, then a 120 f lockup (M 60, max/M 3.0, CV 0.56).

Upstream evidence count: 3; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
