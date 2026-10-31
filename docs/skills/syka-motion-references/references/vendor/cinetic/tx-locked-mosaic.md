# Locked-state mosaic

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · tx-locked-mosaic
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: texture_and_finish; energy: medium; role: signature; formats: launch, feature

## Mechanism
Withheld content shows as pixelated, desaturated, darkened art with a lock glyph and thin light lines sliding across it, until an unlock snaps it to clean full-tone art.

## Use when
Premium, gated or upcoming features; a reveal sequence where concealment builds desire; access or unlock stories.

## Avoid when
Products with nothing gated; text content (pixelated text reads as broken); more than one reveal device in the same act.

## Original recipe (adapt to Syka native time and nodes)
Pre-render each card's art at 1/40 of its width (blocks about 2.5% of the card width), show it upscaled with `imageRendering: 'pixelated'` and `filter: saturate(0) brightness(0.3)`, and over it 2-3 slightly curved strokes (1.5-2 px, white at 30%) translating linearly along the card at 2-4 px/f, clipped to the card, with a 32-40 px line lock glyph at centre and no caption. Unlock: the strokes brighten to 60% over the 12 f before it, then the art dips from brightness 0.3 to 0.18 over 4 f on E.smooth while the shackle rotates open on SPR.firm; on the next frame swap to the full-resolution art at brightness 1.12 easing to 1.0 over 10 f on E.out, and fade glyph and strokes over 10 f on E.smooth. In a run of cards make each later unlock about 25% faster.

## Original timing
Locked state 54-108 f (the strokes keep moving, so nothing is static); unlock = 12 f brighten, 4 f dip, swap, 10 f settle; repeated unlocks 30-45 f apart, each ~25% quicker.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
