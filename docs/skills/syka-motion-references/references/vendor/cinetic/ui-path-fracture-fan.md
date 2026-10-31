# Path fractures into a fan, then re-converges

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ui-path-fracture-fan
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: ui_choreography; energy: medium; role: accent; formats: launch, feature

## Mechanism
A solid line draws out, breaks into dashes, splits into a fan of curves that end on obstacle pills, and later the curves funnel back into one point that becomes the next diagram.

## Use when
Explaining the friction of an old way (one simple path turning into many obstacles) before the turn to one clean path.

## Avoid when
The viewer needs real product UI on screen; this is diagram language, and a diagram act longer than about 4 s loses the thread.

## Original recipe (adapt to Syka native time and nodes)
Draw the trunk from the source node as an SVG path with pathLength 1, strokeDashoffset 1 to 0 on E.linear over 12 f; at +12 f let it degrade by tweening strokeDasharray from 'L 0' to '24 12' over 8 f (dash = mix(L, 24, p), gap = mix(0, 12, p)). At +26 f split it into 6 cubic beziers from one shared point with their ends spread +-200 px in y, each revealed by its own dashoffset on E.glide over 24 f at a 2 f stagger so the drawing head stays under about 70 px/f, and pop a labelled obstacle pill at each end as its curve arrives (opacity step plus scale 0.9 to 1 over 8 f on E.out). Hard-cut to a 2.5x punch-in on the pills about 10 f after the fan completes. To resolve, give each pill a trailing bezier ending on one point, the next diagram's first node, draw them over 24 f on E.smooth while the camera travels the same way with no cut, and finish the camera's travel with an E.out landing of about 210 px over 60 f (22 px/f at its start) through lib/camera.ts.

## Original timing
Trunk 12 f (E.linear); dashes at +12 f over 8 f to '24 12'; fan at +26 f: 6 curves x 24 f (E.glide), 2 f stagger, complete at +60 f; punch-in cut at ~+70 f (2.5x). Converge 24 f (E.smooth); camera landing 210 px over 60 f (E.out), 22 px/f at its start.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
