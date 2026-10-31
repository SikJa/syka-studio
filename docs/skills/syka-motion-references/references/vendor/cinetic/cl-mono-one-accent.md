# Monochrome world, one accent

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · cl-mono-one-accent
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: color_and_light; energy: any; role: workhorse; formats: any

## Mechanism
Everything is black, white and grey, and one saturated accent marks the single element in each shot that carries the meaning.

## Use when
Films that mix photos, 3D, maps and UI, multi-cell layouts, or any shot where several things compete and the eye needs exactly one target.

## Avoid when
The product's own colourful UI is the subject of every shot and greying it would misrepresent it, or the story needs two semantic colours on screen at once.

## Original recipe (adapt to Syka native time and nodes)
Declare neutrals plus one accent in brand/tokens.ts: C.ink for the stage, C.ink2 for surfaces, C.mute for labels, C.line for strokes, C.white for type, C.accent, and a press step of mixColor(C.accent, C.ink, 0.08). Grade every photo, map, clay render or backdrop screenshot with filter: grayscale(1) so mixed media reads as one world. Paint the accent on exactly one thing per shot (the payoff word, the pin, the pressed button, the focus ring) and keep one meaning for it all film. Focus devices use three steps of it: the full accent for strokes, mixColor(C.accent, C.ink, 0.65) for fills and a mid step for decaying outlines. Colour arrives on a cut or an impact frame (fd(frame) >= cue), never through a slow fade, and when you audit rendered stills the accent should average 0.05-6% of frame pixels (peak about 12.5%) with the stage at 85-90%.

## Original timing
The palette stays the same for the whole film. The accent swaps on the cue frame (a step, 0 f). Focus outlines land 6-10 px wide with their container (26 f, E.out), thin to 1 px over 12 f on E.in, then decay to 30% opacity over 24 f on E.linear.

Upstream evidence count: 5; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
