# Product surface cover wipe

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · tr-cover-wipe
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: transition; energy: medium; role: workhorse; formats: launch, feature, walkthrough, vertical

## Mechanism
A product surface (a UI panel, a window, a device) moves in front of the old shot and either passes straight through it with the scene changed behind it, or lands and becomes the new shot.

## Use when
Promise to product: the UI pushes the headline off. Scene changes that should show the product itself rather than a graphic.

## Avoid when
The surface is a plain coloured slab (then it is a preset wipe), or the pass-through would need more than 80 px/f; shorten the distance with a cut instead.

## Original recipe (adapt to Syka native time and nodes)
Pass-through: a panel 1.15x the frame height, showing the product's real UI, moves at a constant 64-72 px/f (prog with E.linear) from fully above the frame to fully below. The scene beneath switches on the first frame the panel covers the frame completely, decided with fd(frame); the motion-blur pass streaks the panel. Land: the product window rises about 940 px from below the frame to its rest pose over 44 f on E.glide, above the title layer, while the title fades 1 → 0 over 36 f, starting 16 f before the window moves. Occluder variant: during a fast camera push, time one foreground object to cross the lens on the push's peak frame, covering at least 60% of the frame for 2-4 f, and change the world behind it then. In every version the surface sits above the old shot in z-order, and its own content does not need to be readable until it rests.

## Original timing
Pass-through: about 2600 px at 64-72 px/f, or 36-40 f; the scene switches on the full-cover frame. Land: 940 px over 44 f on E.glide (peak about 64 px/f at 31% of the move); the title fades over 36 f, starting 16 f before. Occluder: covers for 2-4 f at the push's peak.

Upstream evidence count: 3; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
