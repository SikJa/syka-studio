# Depth orbit ring that collapses into the mark

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · d3-orbit-ring-collapse
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: depth_and_3d; energy: medium; role: accent; formats: launch, feature, sting

## Mechanism
Small icons orbit the central mark on a tilted ellipse: they grow and pass in front as they come near and shrink behind it as they go far. Then the ring speeds up and contracts into the mark.

## Use when
Showing an ecosystem of integrations or inputs around one core in about 1.5 s, without words.

## Avoid when
The icons must be read or named, or the film already used an orbit; more than 8 icons turns into noise.

## Original recipe (adapt to Syka native time and nodes)
For each of 6-8 icons: theta = theta0 + i*360/n + omega*f, x = cx + 0.35W*cos(theta), y = cy + 0.2H*sin(theta). Depth d = sin(theta) (near at the bottom of the ellipse) drives scale mix(0.7, 1.3, (d+1)/2), brightness mix(0.6, 1, (d+1)/2) and paint order. Rebuild the list sorted by d every frame with the mark inserted at d = 0, so far icons draw behind it and near ones in front; near icons go soft through RackFocus with t = clamp((d - 0.4)/0.6) and blur 6 px, never an animated filter. To contract, multiply rx, ry and icon scale by lmix(1, 0.3, E.in(p)) over 34 f while omega doubles. Fade each icon over the last 8 f as it passes behind the mark, and scale the mark by 1 + 0.03*hitPulse(t, 2, 6) on the frame the ring closes.

## Original timing
Orbit omega = 0.67 deg/f (40 deg/s) E.linear for about 50 f; contraction 34 f on E.in (ring x0.3, omega x2); icon fade over the last 8 f; mark punch hitPulse(t, 2, 6) x 0.03.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
