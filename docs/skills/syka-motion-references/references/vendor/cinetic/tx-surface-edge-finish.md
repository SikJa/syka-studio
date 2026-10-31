# Hairline edge and key shadow

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · tx-surface-edge-finish
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: texture_and_finish; energy: any; role: workhorse; formats: any

## Mechanism
Every floating surface gets a 1 px edge plus one soft key shadow on paper, or a top inner highlight on ink, so flat UI reads as a physical object in a lit space.

## Use when
Any floating card, panel, modal or window, in every format.

## Avoid when
Flush full-bleed UI or gutterless grids whose cells should merge into one canvas; anything tempting a glass panel or a coloured halo instead.

## Original recipe (adapt to Syka native time and nodes)
On paper: `boxShadow: '0 30px 60px rgba(0,0,0,.12)'` with a 1 px C.line border, optionally over a tight `0 1px 2px rgba(0,0,0,.06)` contact shadow. On ink: no shadow, a C.ink2 fill (a luminance step from C.ink), a 1 px border at C.ink plus about OKLCH 0.06 lightness, and `inset 0 1px 0 rgba(255,255,255,.08)` as the top highlight. Tie the finish to motion: when a card lifts (z 0 to 120 px) grow its shadow with the lift formulas (offset 0.1z, 0.22z; blur 3 + 0.06z; alpha 0.2 - 0.1 x min(1, z / 200)), and when a panel tilts toward camera raise the inset highlight from 0.08 to 0.12 with |tilt| / 15 degrees, so the edge catches light as it moves.

## Original timing
Static finish; shadow and highlight follow the element's z and tilt every frame (lift 14 f on E.out, drop 10 f on E.in); highlight alpha changes by at most 0.04 over a tilt.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
