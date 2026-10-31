# Oversize line flies through, restarts small

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · oh-oversize-fly-then-small
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: opening_hook; energy: high; role: signature; formats: launch, feature, vertical

## Mechanism
A huge fragment of the headline, about a quarter of frame height, brakes in from the right with its letters fading on as it slows, then dissolves; three frames later the same line restarts small and centred so it can be read.

## Use when
The headline has a thesis word worth previewing big, in a dark, energetic launch.

## Avoid when
Light stages where 65% white loses contrast, or headlines longer than about 5 words whose big fragment will not read. Also avoid it when the big fragment would sit still and cropped at both edges at any point: viewers read an oversized, cropped line that vanishes and then restarts small as a false start, not a preview. It has to travel every frame it is on screen.

## Original recipe (adapt to Syka native time and nodes)
Start the big line's clock 6 f before the film's first frame (t = f + 6), so frame 0 already shows its first letters fading on as it brakes. Layer 1: the line at about 270 px, weight 500, colour rgba(255,255,255,0.65) on C.ink (or over a single-hue wash), with x = startX + inertia(t, 0, -70, 0.89).x (601 px of travel from 70 px/f). Per-character opacity is 0.65 * prog(t, 6 + 1.5i, 12 + 1.5i, E.smooth), so letters only resolve once the speed drops below about 20 px/f, and the whole layer fades 1 -> 0 over its last 7 f on E.smooth while it is still sliding. Start layer 2 on the next frame, with no empty frames between: a dissolve to an empty frame and a fresh start reads as the film restarting. Layer 2: the same line at reading size with its final centred layout precomputed, per-character opacity prog(t, 1.3i, 1.3i + 5, E.smooth), and container x = inertia(t, 0, -10.8, 0.88).x: an 84 px drift that lands exactly centred and never passes 12 px/f. Keep the opening type translucent and make the end card solid white, so the film reads as a question becoming an answer.

## Original timing
Big line visible from f0 (its clock t = f + 6) to f35: slide 39 f, about 35 px/f at t = 6 and 17 px/f at t = 12; letters 6 f each, 1.5 f stagger; fade over the last 7 f. No gap; small line from f36, 13 characters in 17 f, drift settled in about 40 f.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
