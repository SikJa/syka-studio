# Detail first, then pull back

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · cam-detail-first-pullback
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: camera; energy: medium; role: workhorse; formats: launch, feature, walkthrough

## Mechanism
A shot opens tight on the one thing that matters (giant prompt words, a chart counting up, a status pill) with no chrome, then the camera pulls back to show it sitting in the full window.

## Use when
Result reveals, analytics, prompts and input moments where the value should land before the load of the full UI; breaking up a repeated card formula; re-establishing the whole product after a run of close details.

## Avoid when
The product hasn't been seen yet and the tight frame stays unrecognisable for long (keep the tight hold under 52 f), or the wider frame adds nothing new.

## Original recipe (adapt to Syka native time and nodes)
Anchor on the hero element (ax, ay at its centre, or at the caret for typed words) and hold k = 1.6-1.7 while its value animates; for giant type, pan sx after the caret at 2-4 px/f. Then pull with cam = lc(TIGHT, CONTEXT, prog(f, a, a + 52, E.cam)), so the hero barely moves on screen while the frame widens around it, and fade out any partly cropped edge tiles over the 16 f before the pull so they don't pop at the frame edge. Bring the context in during the pull: window chrome and neighbouring panels fade 0 -> 1 over 30 f from 20% of the move, optionally behind <RackFocus t={1 - prog(f, a, a + 30, E.smooth)} blur={10}>. The hero card can tip pitch 0 -> 6 -> 0 deg and yaw 0 -> -4 -> 0 deg as it docks into its slot. For an end-of-film re-establish, open the tight frame soft (RackFocus t = 1, blur 6) and resolve it over the pull.

## Original timing
Tight hold 24-52 f while the value animates. Pull k 1.6-1.7 -> 1.0 over 52 f on E.cam (peak about 4%/f at 27%), or a settle back over 56-80 f on E.out (half done by f10-12). Edge tiles out over 16 f before the pull, context in over 30 f, 3D tip peaking mid-move. Re-establish k 2.2 -> 1.0 with focus over 60 f on E.cam (peak about 5.6%/f).

Upstream evidence count: 5; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
