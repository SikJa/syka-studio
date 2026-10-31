# Speed-gated motion blur

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · tx-speed-gated-motion-blur
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: texture_and_finish; energy: any; role: workhorse; formats: any

## Mechanism
Fast whips, flings and flicked scrolls streak like a real shutter while holds and slow drifts stay pin-sharp, so the eye rests on the readable frames.

## Use when
Any film with whips, flings, drops or flicked scrolls; walkthroughs that travel fast between setups and need every hold razor-sharp.

## Avoid when
Moves that would need more than 80 px/f (redesign as a cut on the beat, a match cut or a mask wipe); readable text moving above 20 px/f; a deliberately stepped on-twos section.

## Original recipe (adapt to Syka native time and nodes)
Never fake speed blur per layer in the browser (CameraMotionBlur and an animated filter: blur() quantise to 8 bits and step); design the moves and let the master's render pass make the blur: `bash scripts/render.sh Film out/film.mp4 --blur` renders a 240-degree shutter centred on each frame, takes samples from measured speed (1 under 2 px/f, 4 up to 18 px/f, 14 at 60, 18 at 80) and averages them in float. Shape every fast move so its peak sits between 12 and 70 px/f (E.whip or E.inOut, or inertia() for a flicked scroll) and both ends fall under 2 px/f, so the streak exists only mid-move. Put every hard cut on an act boundary so samples never smear across it, and drive typed text, counters, carets and grain from fd(frame) so all sub-samples of a frame agree. Where optical flow cannot see the speed (a flat band wiping the whole frame) pass `--floor A-B:px` or analytic speed; in HyperFrames render at 4x fps and run `accumulate.py --uniform 4`, which is clean only to about 12-18 px/f.

## Original timing
Whip 12-20 f on E.whip with a 40-70 px/f peak, the shots either side at 0.3-1.5 px/f; streak length is about 2/3 of the per-frame travel (a 60 px/f card smears ~40 px); a flick is inertia(f, start, 50-70, 0.89), coasting ~8.6 x v0 px and under 0.5 px/f after its `settle` frames; nothing above 80 px/f.

Upstream evidence count: 6; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
