# Dolly surge with a foreground pass

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · cam-dolly-surge-foreground
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: camera; energy: high; role: signature; formats: launch, sting

## Mechanism
The camera surges from a wide shot into a 3x medium close-up, with most of the travel in half a second, and at the fastest moment a near object rushes past the lens before a long, slow creep.

## Use when
Opening a launch film into a 3D or layered world, or a sting that dives from an overview into the hero object.

## Avoid when
Flat UI with no depth layers (nothing to pass the lens), or calm walkthroughs.

## Original recipe (adapt to Syka native time and nodes)
Animate k = lmix(1, 3.1, prog(f, a, a + 67, E.smooth)) around the subject (or translateZ of a preserve-3d stage under perspective 2400px), multiplied by lmix(1, 1.04, prog(f, a + 47, a + 107, E.linear)) so the +4% creep starts 20 f before the push ends and the motion never stalls. Put one foreground object on its own layer above the world, 300-400 px off the anchor, and project it with a stronger scale, kFg = k ** 1.6 (screen position = sx + (p - ax) * kFg), so it grows and slides out past the frame edge around the push's peak frame (about a + 33); keep its crossing at 60-80 px/f or less. The motion-blur pass (--blur) streaks it, so never fake the streak with a CSS blur. Optional mid and far layers at 1.0x and 0.3x of the camera's translation add parallax.

## Original timing
Push 67 f on E.smooth, zoom 1 -> 3.1, 10-90% of the travel in about 28 f, peak about 4.8%/f near a + 33. Creep +4% over 60 f on E.linear from a + 47. Foreground exits on the peak at 60-80 px/f or less, smeared by the blur pass.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
