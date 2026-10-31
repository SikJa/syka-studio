# Tilted object on a spotlit ground

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · d3-spotlit-tilted-object
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: depth_and_3d; energy: calm; role: workhorse; formats: launch, feature, loop

## Mechanism
A real card or device lies in perspective on a dark surface under one soft pool of light. Most of the frame falls to black, and a slow drift slides the light across the object's face.

## Use when
A single notification, card or device should feel like an object in a room, not on a slide, especially in a dark, low-key film.

## Avoid when
The same act already tilts things on this axis, or the film is bright and flat; never on a bare screenshot without ground and shadow.

## Original recipe (adapt to Syka native time and nodes)
Stage on ink. Put a ground plane (a bezel slab, a tile or rib pattern, or a rect one step lighter than the stage) under the object at the same rotation, and transform both with perspective(2200px) rotateZ(4deg) rotateX(8deg) rotateY(-12deg), so the roll stays outside the tilt. The light is a dithered PNG of a single-hue radial falloff (white at 12% alpha down to 0 at 60% radius, centred at 60%/55% of the frame) over ground and object, plus a 35-40% edge vignette; the object casts a soft contact shadow (blur 36 px, alpha 0.35) offset away from the pool's centre. The pool stays fixed in screen space while the object drifts translateX -0.5 px/f and yaws +0.03 deg/f (or orbits at 0.1 deg/f for a device), so the highlight travels across its surface; start the drift from rest at a seam with the camera.md drift formula. Fill the card solid, never frosted, and let its content change state on E.ui while the plane drifts.

## Original timing
Shot 30-84 f. Drift 0.5 px/f E.linear (eased in from rest over about 60 f at a seam), plus yaw 0.03 deg/f or an orbit of 0.1 deg/f. Pool radius about 35-40% of the frame. Content state changes over 10-14 f on E.ui.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
