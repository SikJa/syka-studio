# Cursor-led whip orbit

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · cam-cursor-whip-orbit
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: camera; energy: high; role: accent; formats: walkthrough, feature, launch

## Mechanism
Following a cursor that leads the way to the next panel, the camera swings fast across the product, yawing to show the slab's thick edge and rolling slightly.

## Use when
Moving between two distant panels of one product in a single-take or walkthrough film, where a cut would lose the spatial relationship.

## Avoid when
There is no cursor or other lead to motivate it (an unmotivated whip reads as a flourish), or the act already uses yaw for something else.

## Original recipe (adapt to Syka native time and nodes)
Keyframe A (the current pose) and B, with ax, ay on the destination panel, yaw about +24 deg, roll about -10 deg and k = 0.77 x A.k, and blend lc(A, B, prog(f, a, a + 74, E.whip)) through camera(shot, 2400). Move the cursor in screen space along cursorArc(start, dest, prog(f, a - 5, a + 69, E.whip), 0.2), so it leads the camera by about 5 f and seems to drag it, projecting its destination with the same transform maths. Give the world container a 24-40 px side face (a darker tone of the surface, hinged on the right edge with rotateY(90deg)) so the yaw reveals the product's thickness. Render with --blur, since the peak is near 47 px/f.

## Original timing
74 f on E.whip, peak about 47 px/f at around 40% of the move. Yaw 0 -> 24 deg, roll 0 -> -10 deg, zoom x0.77. The cursor leads by 4-6 f.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
