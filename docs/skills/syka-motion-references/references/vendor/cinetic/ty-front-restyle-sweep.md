# Travelling front restyles a word

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ty-front-restyle-sweep
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: typography_motion; energy: medium; role: accent; formats: launch, feature, sting

## Mechanism
A front sweeps left to right across a settled word and restyles each glyph as it passes, in colour or weight, sometimes with a cursor riding under it.

## Use when
Turning a static big word into a moment of discovery; emphasising one or two promise words without a highlight shape; a change of voice mid-sentence.

## Avoid when
Text still moving; sweeps whose half-restyled frames read as another word; colour and weight sweeps in the same film.

## Original recipe (adapt to Syka native time and nodes)
After the word has landed, move a front x_F = mix(xL - band, xR + band, prog(f, s, s + 32, E.dolly)) across it, with band about 0.6 em. For glyph i at measured x_i, u_i = clamp((x_F - x_i) / band): its colour runs C.mute -> C.accent at u = 0.5 -> C.ink at u = 1 through mixColor (one hue only), or its variable-font weight runs fontVariationSettings 'wght' 400 -> 700, with each glyph's advance interpolated between measureTracked at both weights so the line re-flows smoothly and stays centred. If the beat is the user switching something on, ride src/fx/Cursor.tsx at the base of the front. For two promise words in a tagline, step the glyphs 2 f apart instead of using a continuous band.

## Original timing
Sweep 32 f E.dolly (front peaks about 29 px/f across a 600 px word; stretch to 40 f for wider words); band 0.6 em; per-glyph weight morph about 4 f; a second word starts about 20 f after the first; begin at least 10 f after the word lands.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
