# The one long hold

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ps-one-long-hold
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: pacing_structure; energy: any; role: accent; formats: launch, feature, vertical

## Mechanism
In a film that otherwise never stops, a single key claim sits nearly still for over a second, which tells the viewer it is the line to remember.

## Use when
The single claim or number the film exists to say, in a launch film or short spot that is relentless everywhere else.

## Avoid when
Films already built on long holds, where it stops reading as special, or when two lines compete for the slot.

## Original recipe (adapt to Syka native time and nodes)
Reserve exactly one statement per film for this. After it settles (words on SPR.word or src/fx/Words.tsx), hold it 60-90 f with the type effectively still: breath(t, 0.015-0.02) from src/lib/camera.ts on its container (under 0.3 px/f at the edges) and a background breathing ±3% opacity, with no new element entering. Every other shot keeps a breath envelope or a camera move, so this hold is at least twice as long as any other near-still stretch. Leave on an E.in scale creep of +6% over the last 18 f, cutting on the creep's fastest frame.

## Original timing
Settle 20-36 f; hold 60-90 f at under 0.3 px/f; exit creep +6% over 18 f E.in. Every other near-still run stays at or under 30 f.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
