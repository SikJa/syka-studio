# Cube turn to a blank face

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · d3-cube-turn-face
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: depth_and_3d; energy: medium; role: accent; formats: sting, launch, feature

## Mechanism
Words converge and slide under an icon, then the icon turns 90 degrees like a cube to show a plain accent face that becomes the field for what comes next.

## Use when
Clearing a sentence into a single colour field or a seed for the logo with a clean geometric gesture.

## Avoid when
The tile carries fine detail (it shears during the turn), or the same element was already flipped.

## Original recipe (adapt to Syka native time and nodes)
Build the tile as a CSS box of width w: the front face (the icon) at translateZ(w/2) and the right face (plain accent, or the next state) at rotateY(90deg) translateZ(w/2), both with backface-visibility hidden, inside a preserve-3d node offset translateZ(-w/2) so it turns about its centre, with perspective about 4w. First the flanking words accelerate inward and slide under the tile on E.in over 22 f (lower z, motion blur from the master). Then turn rotateY 0 to -90 deg on E.smooth over 12 f, shading the departing face from brightness 1 to 0.55 and the arriving face from 0.85 to 1 by the cosine of each face's angle. Hold the new face for 6 f as a designed freeze on a silence; then it expands, punches or opens into the next element.

## Original timing
Converge 22 f E.in; cube turn 12 f E.smooth; blank-face freeze 6 f; then the next move.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
