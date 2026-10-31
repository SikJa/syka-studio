# Empty ground after a cut

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ps-empty-ground-after-cut
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: pacing_structure; energy: medium; role: accent; formats: launch, feature, vertical

## Mechanism
Right after some hard cuts the new stage shows for two empty frames before its type appears, a tiny palate cleanser that makes the cut read crisply without any flash.

## Use when
Type-led films on white or flat stages with many statement cuts.

## Avoid when
Velocity-matched cuts, where the gap kills the momentum, and frame 0.

## Original recipe (adapt to Syka native time and nodes)
On selected statement-to-statement hard cuts, not every cut, delay the incoming card's first element by 2 f: the new background is on screen at the cut frame, and the card's Sequence starts at cut + 2, its first element arriving on its normal E.out entrance. Use it where the outgoing card has already left by its own exit (an E.in move, or a fade over its last 8 f) and both stages are flat, so the two empty frames read as a breath and not as a dropped frame. Never use it on the film's first frame, where the hook has to open composed and moving.

## Original timing
2 empty frames at 60 fps; the incoming card starts at cut + 2 on its usual entrance; on at most a third of the cuts.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
