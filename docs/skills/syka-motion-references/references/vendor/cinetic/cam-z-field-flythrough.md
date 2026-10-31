# Fly-through of a depth field

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · cam-z-field-flythrough
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: camera; energy: high; role: signature; formats: launch, sting, feature

## Mechanism
Dozens of flat screens or tokens float at different depths and the camera travels forward through them: near ones swell and slide off the frame edges, far ones barely drift, until the move lands square on one hero screen.

## Use when
Proving breadth (a whole platform, hundreds of templates, every integration) in 3-4 s without explaining any single screen; opening into a layered world; arriving on the one screen the next act is about.

## Avoid when
Items must be read in flight, there are fewer than about 15 of them (the field looks sparse), the film is flat with no depth language, or lc-swarm-cluster-burst already spends the film's breadth crescendo.

## Original recipe (adapt to Syka native time and nodes)
Seed 24-36 items with rand(i): x within +-2200 px, y within +-1300 px, z from 800 to 6000 px ahead of the start, keeping a 420 x 260 px corridor around the camera's path empty so nothing hits the lens head-on, and place the hero at (0, 0, Zh), sized in world px at the size it should read. Project each item yourself rather than through preserve-3d: with F = 1200 and d = z - camZ(f), draw it as a flat layer at translate(W/2 + (x - camX) x F/d, H/2 + (y - camY) x F/d) scale(F/d), z-ordered far to near, and unmount it once d < 300. Multiply each item's opacity by a far fade-in (0 -> 1 as d falls from 6000 to 4800) and by a speed gate, clamp((70 - v) / 20), where v is its screen travel since f - 1 (project it again with camZ(f - 1)), so whatever rushes past the lens dissolves instead of breaking the speed cap; sink distant items into the stage with an overlay of the stage colour at 0.5 x clamp((d - 1200) / 4000) instead of blurring 30 layers. For the dive, camZ = (Zh - F) x prog(f, a, a + N, E.cam) lands the hero at exactly scale 1, sharp and readable; for a breadth drift that ends in a cut, pull back 1200 px on E.out, cruise forward at 4 px/f with camY sinking 1.5 px/f, then ramp out over the last 18-24 f on E.contact and hard-cut on the fastest frame (tr-velocity-handoff-cut). Tokens may also turn slowly on rotateY (up to 10 deg/s each), and the whole move renders with --blur.

## Original timing
Dive: 150-180 f on E.cam through 4,000 px of depth (Zh = 5200, F = 1200), landing the hero at scale 1 on the long settle. Drift: pull-back 40 f on E.out, cruise 90-120 f, exit ramp 18-24 f. Speed gate between 50 and 70 px/f; far fade over 1,200 px of depth; about 12-16 items on screen at once. The hero's copy starts once it moves under 20 px/f.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
