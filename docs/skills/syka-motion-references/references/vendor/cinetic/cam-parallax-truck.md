# Layered parallax truck

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · cam-parallax-truck
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: camera; energy: calm; role: workhorse; formats: launch, feature, walkthrough

## Mechanism
The camera trucks sideways across a scene split into two or three depth planes: the background barely moves, the subject moves with the camera and a near element slides past faster, so a flat layout reads as space.

## Use when
Hero product shots and feature cards that need depth without 3D, and slow establishing moves.

## Avoid when
Dense UI walkthroughs where the eye has to track one control, or any scene with more than three planes (it starts to look like a parallax demo).

## Original recipe (adapt to Syka native time and nodes)
Split the world into at most three layers in one AbsoluteFill (background, subject and an optional foreground), each with its own transform, and drive a single camera translation x = D * prog(f, a, a + N, E.cam), or a constant 1-3 px/f drift for a hold. Apply it at 0.3x to the background, 1.0x to the subject and 1.6x to the foreground, and scale the background to 1.08 so its slower travel never reveals an edge. Keep the subject's readable text under 20 px/f and let the text-free foreground carry the fast motion, which the blur pass smears above 12 px/f.

## Original timing
Truck 200-400 px over 90-120 f on E.cam (subject peak about 12 px/f for 300 px over 105 f), or a 1-3 px/f drift. Plane factors 0.3 / 1.0 / 1.6. Background overscan 5-8%.

Upstream evidence count: 0; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
