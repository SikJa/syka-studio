# Guide cursor: arrive, hover, press

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · mi-guide-cursor-hover-press
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: micro_interaction; energy: any; role: workhorse; formats: walkthrough, feature, launch, vertical

## Mechanism
A cursor travels a bowed path to the element about to act, the target shows its hover state a few frames after the cursor arrives, and a short press triggers the response on the same frame.

## Use when
A person is driving the product, and dense UI needs a point of view that shows the viewer where to look next.

## Avoid when
The product acts on its own, clicks would come faster than one per 30 f, or the shot already has a pointer such as a focus ring.

## Original recipe (adapt to Syka native time and nodes)
Use src/fx/Cursor.tsx in screen space: position = cursorArc(from, to, prog(f, m0, m1, E.smooth), 0.2), with the target from toScreen(shot, point), and press = pressAt(f, CLICK). The target's response (a press envelope or a state flip) starts on CLICK. Calm mode: travel at 5-15 px/f along the path and arrive 6-12 f before the press. The target's hover fill (C.mist, or a 6% ink tint) fades in over 4 f, starting 4 f after arrival, and any highlight that follows the cursor trails it by 4 f. Snappy mode, for vertical or phone-size frames: scale the cursor to about 11% of frame height (Cursor scale about 2.8 at 1080p). Move about 300 px in 24 f with E.out (about 72 px/f on the first frame, velocity x0.78 per frame), then dwell about 60 f while the UI reacts. Once the product acts on its own, fade the cursor out over 10 f after its last click.

## Original timing
Calm: arcs at 5-15 px/f on E.smooth, bow 0.15-0.25, arriving 6-12 f early; hover starts 4 f after arrival and takes 4 f. Press: 4 f down, 8 f recoil (pressAt). Snappy: 300 px in 24 f E.out, dwell about 60 f. At most one click per 30 f, at uneven gaps; exit fade 10 f.

Upstream evidence count: 4; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
