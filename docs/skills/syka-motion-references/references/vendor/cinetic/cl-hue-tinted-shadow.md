# Shadows tinted by the stage

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · cl-hue-tinted-shadow
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: color_and_light; energy: calm; role: accent; formats: feature, walkthrough, launch

## Mechanism
On a tinted light stage, lifted cards and solid pills cast soft shadows in a dark step of the stage's own hue instead of grey, so depth reads as part of the world's colour rather than dirt on it.

## Use when
Light-mode acts on pale tinted stages, pastel product worlds, and black pills or tiles floating on a tinted field where a grey shadow looks muddy.

## Avoid when
Dark stages, where a coloured shadow becomes a glow. Keep shadows neutral in neutral C.paper films, and skip the tint wherever it would echo the accent and spend its meaning.

## Original recipe (adapt to Syka native time and nodes)
Derive one shadow colour from the stage, never from the accent: SH = mixColor(stageHue, C.ink, 0.6), where stageHue is the act's tint (for example, the pale-tint act of cl-context-palette-shift). Give each lifted card two shadows: a contact shadow, 0 2px 6px of C.ink at 0.10, and an ambient shadow, 0 24px 56px -16px of SH at 0.22 (convert mixColor's rgb() output to rgba). Under a solid black pill or icon tile, use a single tinted ellipse instead. Make it 80% of the element's width and 30% of its height, offset downward by 40% of its height, filled with radial-gradient(SH at 0.35, transparent 70%) and blur(32px), on multiply, below the element. Tie the shadow to lift: with lift = scale - 1 (or translateZ / 200), multiply offset and blur by 1 + 3 x lift and alpha by 1 / (1 + 3 x lift), so a rising card's shadow spreads and fades. Because SH reads from the act's tokens, a palette switch retints every shadow on the same frame. In its richer form, the look puts blurred blobs of two pastel hues beside a black pill and coloured halos on three sides of cards floating on black.

## Original timing
Static while parked. On a lift (scale 1 to 1.04 over 20-26 f on E.out), the ambient blur goes from about 56 to 63 px and the alpha from 0.22 to 0.20 on the same curve. On seating, it returns on the seat move's own easing. A palette switch retints the shadows in 0 f, on the cut.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
