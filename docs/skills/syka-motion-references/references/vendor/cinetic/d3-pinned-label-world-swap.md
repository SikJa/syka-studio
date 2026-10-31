# Pinned label over a swapping world

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · d3-pinned-label-world-swap
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: depth_and_3d; energy: medium; role: accent; formats: launch, feature, walkthrough

## Mechanism
A pin pops on a 3D-rendered place and a short data tag on a leader line tracks that point as the camera orbits. On a cut, the world underneath switches between 3D and flat while the tag holds its screen position.

## Use when
Location or geography matters ('this happens in a real place'), or a flat diagram should be revealed as a real object, and back.

## Avoid when
There is no real 3D plate or scene to anchor to; a tag floating over a flat screenshot gains nothing from projection.

## Original recipe (adapt to Syka native time and nodes)
Keep two layers: the world (a pre-rendered 3D plate played with OffthreadVideo, or a CSS 3D stage whose container uses transformOrigin 0 0) and a screen-space overlay. Every frame, project the pin's world point with the same matrix the world uses: new DOMMatrix(cameraTransformString).transformPoint(new DOMPoint(x, y, z)), then divide x and y by w (or do the rotateX, rotateY and perspective divide by hand as references/camera.md describes). Place the overlay with one translate() and add skewY of about 0.15x the camera yaw so the tag leans with the ground. The pin scales 0 to 1 on E.out over 8 f with a ring of hitPulse(t, 2, 6), the leader line draws by stroke-dashoffset over 8 f from +4 f, the mono tag (a value or status, not a decorative kicker) types on with TypeOn, and the place name slides 25 px on E.out over 12 f from +12 f. For the swap, cut only the world layer on the velocity peak of a pull-back and continue the zoom with zoomHandoff (in the flat map the same point sits about 1.8x larger and keeps shrinking, decelerating) while the overlay keeps animating untouched; the flat-to-3D version cuts a shrinking flat mark to its 3D twin at the same screen position, starting 8x large and pulling back on E.out.

## Original timing
Pin 8 f E.out; leader 8 f from +4 f; name 25 px over 12 f E.out from +12 f; orbit yaw 0.1-0.2 deg/f E.linear. 3D segment about 90 f, flat segment about 70 f; cut on the zoom's velocity peak, zoomHandoff settle 30 f. Flat-to-3D: 8x to 1x over 18 f E.out (fastest per-frame ratio about 0.65 at frame 2), settled by f22.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
