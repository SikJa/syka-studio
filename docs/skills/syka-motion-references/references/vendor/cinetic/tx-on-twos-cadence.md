# Stepped cadence on twos

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · tx-on-twos-cadence
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: texture_and_finish; energy: medium; role: accent; formats: sting, feature, walkthrough

## Mechanism
One designated layer or section updates only on every second frame, so its motion reads crisp, precise and slightly mechanical against an otherwise smooth 60 fps film.

## Use when
Mechanical, developer or precision brands; a UI section that should feel like a live screen; a short sting that wants a punchy graphic cadence.

## Avoid when
Slow drifts and camera pushes (they judder); moves that would exceed 24 px per step; a few isolated shots in a smooth film, where it reads as dropped frames.

## Original recipe (adapt to Syka native time and nodes)
Inside the chosen layer compute `const f2 = 2 * Math.floor(fd(frame) / 2)` and pass f2 instead of frame to every prog, tw, spr and hitPulse call it makes (or use interpolate(..., { posterize: 2 }) for a single value), so every motion-blur sub-sample of a frame agrees and each held pair renders sharp. Because a held frame cannot carry blur, keep every stepped element under 24 px per step (12 px/f average) and type under 20 px per step; leave the camera, backgrounds and grain on the native frame. Apply it to a whole act (a UI-precision section, a sting) or to the type layer only, never switching on and off inside a shot.

## Original timing
Steps every 2 f (30 Hz in a 60 fps file); moves of 60-150 px over 24-40 f on E.glide or SPR.firm evaluated at f2, peaking at or under 24 px per step; at least one full shot or act long.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
