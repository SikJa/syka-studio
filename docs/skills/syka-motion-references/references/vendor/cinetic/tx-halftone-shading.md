# Halftone shading

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · tx-halftone-shading
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: texture_and_finish; energy: calm; role: accent; formats: launch, sting, feature

## Mechanism
A flat hero shape gains volume from a single-colour halftone dot field whose dots swell in the shadow side and shrink toward a slowly moving light.

## Use when
Flat marks, icons or objects that need volume without 3D; technical or print-minded brands; alongside other dot-matrix devices.

## Avoid when
Shapes under ~200 px, where the dots turn to mush; photographic or 3D scenes; busy UI behind the shape.

## Original recipe (adapt to Syka native time and nodes)
Over the shape, lay an SVG grid of circles on a 12 px pitch, clipped to the shape (clipPath), in C.ink on paper or C.white on ink. Each dot's radius is 5.5 x E.smooth(clamp(dist(L, dot) / R)) px, with L a light point and R about 0.8 x the shape's diagonal; drop dots under 0.8 px radius so nothing aliases. Move L along a slow arc at under 0.5 px/f so the shading breathes, and reveal the field as a diagonal wave in which each dot grows from 0 to its radius over 12 f on E.out, offset by stagger(i, n, 24) with i ordered by x + y.

## Original timing
Reveal 36 f (a 24 f diagonal stagger plus 12 f per dot on E.out); light point drift under 0.5 px/f; holds as long as the shape stays the hero.

Upstream evidence count: 0; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
