# Hero push with a 3D turn

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · cam-hero-push-yaw
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: camera; energy: high; role: signature; formats: launch, feature

## Mechanism
From a wide view of the whole app, one continuous move pushes 2.5x into a single panel while yawing, so the panel turns toward the viewer and an empty side of the frame opens for the caption.

## Use when
The film's energy peak: the one feature that needs both spatial orientation and close-up legibility, or a scene change inside a single-take film.

## Avoid when
More than once per film, or on a lone card with no surrounding app (the turn needs a world to orient against). Keep each act on its own rotation axis.

## Original recipe (adapt to Syka native time and nodes)
Build one scene on one world container with two Shots: WIDE (k = 1, flat) and HERO, with ax, ay on the panel centre, sx at 0.67 x width (0.33 for a panel on the left), k = 2.56, yaw 24-30 deg and pitch about 5 deg, rendered through camera(shot, 2400). Blend with lc(WIDE, HERO, prog(f, a, a + 60, E.smooth)); k already lerps in log space, so the push keeps an even perceived speed. Start the caption in the void at a + 45 (the last 25% of the move) so the word reveal and the camera settle read as one gesture, then keep the hold alive with breath(prog(f, a + 60, next, E.linear), 0.025) instead of a dead lock. Check that the panel's smallest meaningful text is at least 22 px on screen at k = 2.56, and render with --blur for the peak.

## Original timing
60 f on E.smooth, 10-90% of progress between 29% and 71% of the move, peak about 4.5%/f scale (around 47 px/f on screen) at 50%. Zoom 1 -> 2.56; yaw 0 -> 24-30 deg and pitch 0 -> 5 deg on the same curve. Caption starts at 75% of the move. Hold breath +2.5%.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
