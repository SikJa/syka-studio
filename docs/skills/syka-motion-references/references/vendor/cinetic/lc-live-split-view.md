# Live cause-and-effect split

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · lc-live-split-view
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: layout_and_composition; energy: calm; role: workhorse; formats: walkthrough, feature

## Mechanism
Two panels share the frame side by side, the cause on one side (a chat, a list, an input) and the effect on the other (a generated page, a photo, a result), both live, while the camera creeps in.

## Use when
Showing that an input produces an output (prompt to page, list to detail, setting to preview), where seeing both at once is the point.

## Avoid when
Phone-first or vertical films (stack the two instead), or when either side's text would drop under 24 px at 1080p.

## Original recipe (adapt to Syka native time and nodes)
Lay out two panels inside SAFE at 40/60 (the cause narrower), separated by a 3% W gutter, both the full height of the safe box and aligned on the same top edge; render the composition at 2x so a slow push stays sharp. Keep both sides moving: the cause streams text or steps (a typed reply, a marker hopping down a list) and the effect updates on the frame each cause completes (sections drawing in, or an image swapping on the marker's frame with a small kick of rotateY = 12 deg * hitPulse(f - s, 1, 2.5)). Push the world container linearly by about +0.017%/f, then leave on an accelerating pan (E.in over the last 40 f) and cut on its fastest frame, at most 60 px/f.

## Original timing
Hold 180-240 f. Creep about +0.017%/f (+4% over 4 s) on E.linear. Swaps every 54 f with a 6 f settle. Exit pan 40 f on E.in, cut at the peak (at most 60 px/f).

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
