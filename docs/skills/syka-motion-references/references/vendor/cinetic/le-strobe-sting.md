# Stop-motion brand strobe

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · le-strobe-sting
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: logo_and_end_card; energy: high; role: accent; formats: sting, launch, loop, vertical

## Mechanism
A burst of hard-cut brand states (the poster, the lockup tiled in ever denser grids, one flood, the boxed wordmark, the glyph) flickers past in under a second as a punchy sign-off.

## Use when
Social stings and launch films with a poster-driven or stop-motion identity. A re-energising coda after a quiet end card. Autoplay loops that need a clean reset point.

## Avoid when
Calm or premium brands. Any film where you cannot keep large light-dark flips under 3 per second (photosensitivity). Any case where it would cut the lockup's hold below 1.5 s.

## Original recipe (adapt to Syka native time and nodes)
After the lockup's hold, cut through an array of full-frame states with no interpolation: const seq = [[poster,7],[grid3,5],[grid4,5],[gridA,2],[gridB,2],[flood,5],[ink,5],[boxedName,5],[glyph,7]], accumulated into Sequences or chosen with fd(frame). The grids are a CSS grid of the lockup with n = 3, 4, 5, 5 columns and a half-tile offset on alternate states, so the cuts read as a stepped pull-back. Keep every state on the same dark stage, with the accent flood as the only bright state, so there are no more than 3 large light-dark flips per second. End on the glyph alone for at most 30 f, and export the poster from the lockup frame, not the last frame. A quiet version keeps only the last two states (boxed name 5 f, glyph 7 f) as a loop point.

## Original timing
Holds 7, 5, 5, 2, 2, 5, 5, 5, 7 f (43 f, ~0.72 s). Glyph ~2% of H, centred, for at most 30 f. A tick cluster under it that matches the opening's sound.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
