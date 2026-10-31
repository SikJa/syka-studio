# Type solidity arc

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · cl-type-solidity-arc
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: color_and_light; energy: calm; role: accent; formats: launch, feature

## Mechanism
The type gains body across the film. Early statements are translucent white that lets the coloured stage show through, and the closing line and lockup are solid, so the payoff reads as more certain than the promise.

## Use when
Brand films and launches on a coloured or living stage, built as question to answer or promise to proof, where the closing line should feel firmer than the opening.

## Avoid when
Neutral black or grey stages, where translucent white just reads as dim grey. Also avoid it for small UI text, in films under about 10 s, and on light stages, where translucent ink loses contrast.

## Original recipe (adapt to Syka native time and nodes)
Add a typeAlpha value to each act in timeline.ts, for example [0.65, 0.85, 1.0] for opening, middle and end, and read it through one helper so every caption in an act shares it. Apply it as the opacity of the C.white line container, not as per-glyph rgba, which darkens where glyphs overlap, so the stage colour shows through the letters. Keep weight, size and tracking identical across acts so that only confidence changes. Step the value only on cuts or act changes, never inside a line or a shot. cl-ink-resolve still handles each arrival; the arc only sets where that resolve ends. Keep translucent acts to display type (at least 64 px at 1080p) over stage areas darker than about luma 110, and check contrast on rendered stills (Stills.tsx). The end-card line and lockup are always solid C.white.

## Original timing
Act values are 0.65, 0.85 and 1.0 (opening, middle, end), stepped in 0 f on cuts or act changes. Each arrival's ink resolve (12-16 f on E.out) lands at the act's value. The end-card line and lockup stay at 1.0 for their whole 90-120 f hold.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
