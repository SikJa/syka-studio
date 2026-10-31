# Horizon rise

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · tr-horizon-rise
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: transition; energy: medium; role: accent; formats: launch, sting

## Mechanism
A huge disc rises from the bottom edge like a planet horizon, its rim washing over the frame, until its dark core swallows the screen and becomes the stage for the next line.

## Use when
A single colour event that divides the film into acts (UI section to brand moment), or a calm lift from a statement into the next card.

## Avoid when
More than once per film, or on a light film where the dark core would be the only dark frame.

## Original recipe (adapt to Syka native time and nodes)
One full-frame layer holds a circle of radius R = 1.1 × frame width (2112 px at 1080p), centred horizontally: a dark core in the next act's stage colour out to 55% of R, then bands of rim colour out to 85%, softened by a 30 px blur. In the full look the rim is several hues with a bloom. Bake the disc as a dithered PNG with scripts/dither-gradient.py so the soft falloff does not band. Move its centre from y = H + R (the disc's top just touching the bottom edge) to y = 0.58 H over 56 f on E.dolly, with the previous scene disappearing behind it; at rest the core covers all four corners. Start the next text at about frame 46, inside the core. Lighter version: a rim band 40% of the frame height rises from the bottom edge over 16 f on E.in, and the cut lands mid-rise on the beat.

## Original timing
Rise: 56 f on E.dolly, about 2570 px of centre travel at 1080p (the rim's leading edge peaks near 70 px/f mid-move). Next text from about frame 46. Band version: 16 f on E.in. The core fills the frame on a downbeat.

Upstream evidence count: 3; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
