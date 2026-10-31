# Seamless loop drift

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · cam-seamless-loop-orbit
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: camera; energy: calm; role: workhorse; formats: loop, vertical

## Mechanism
In a looping clip the camera drifts along a slow, closed figure-eight (a little sideways, a little up, breathing in and out) and returns exactly to its first frame, so the loop has no seam.

## Use when
Feature loops, background clips and vertical loops that replay endlessly.

## Avoid when
Linear films with cuts (use a living hold instead), or loops shorter than about 4 s, where the drift turns into a visible wobble.

## Original recipe (adapt to Syka native time and nodes)
With L the loop length in frames and u = 2 * Math.PI * f / L, set sx = sx0 + 32 * Math.sin(u), sy = sy0 + 12 * Math.sin(2 * u) and k = k0 * Math.exp(0.03 * Math.sin(u + 1.2)) on the anchor camera, plus yaw = 3 * Math.sin(u) deg for a 3D product. Every term completes a whole number of cycles in L, so frame L equals frame 0 exactly and the motion never stops (the speed peaks around 0.6 px/f at L = 360). Time the content's own loop to L or a divisor of it.

## Original timing
Loop L = 240-480 f. Amplitudes 24-40 px sideways and 10-16 px vertically (at twice the frequency), zoom +-3%, yaw +-3 deg. Peak speed about 0.5-0.8 px/f.

Upstream evidence count: 0; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
