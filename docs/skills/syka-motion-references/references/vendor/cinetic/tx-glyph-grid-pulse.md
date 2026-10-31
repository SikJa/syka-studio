# Glyph-grid shock pulse

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · tx-glyph-grid-pulse
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: texture_and_finish; energy: high; role: accent; formats: launch, sting

## Mechanism
On the film's biggest hit, the dark background flashes a grid of tiny monoline marks that bend outward from the impact like a shockwave, then settles back to a quiet grained field.

## Use when
A digital or developer brand's payoff hit or lockup landing that needs a shockwave without colour or glow.

## Avoid when
Calm films; more than once per film; light stages; behind type that is still arriving.

## Original recipe (adapt to Syka native time and nodes)
One SVG or canvas layer over the stage holds a grid of 36 px cells at 1080p, each with a 10 px monoline mark picked by rand(cellIndex) from plus, L, T and slash, stroked 1.5 px in white. With t = f - hit and pulse = hitPulse(t, 4, 3), each mark at distance d from the impact point gets opacity 0.6 x (1 - d / R) x pulse and a radial offset of 30 x pulse x (1 - d / R) px outward (R about 900 px), so the grid bulges like a tunnel and dies away. Play it once, on the payoff or the lockup's landing, with the hit sound on the hit frame.

## Original timing
About 12-14 f visible, peaking 4 f after the hit (hitPulse(t, 4, 3)); 30 px radial push at peak; once per film.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
