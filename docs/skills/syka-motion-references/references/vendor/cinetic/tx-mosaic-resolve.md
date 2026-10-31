# Stepped mosaic resolve

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · tx-mosaic-resolve
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: texture_and_finish; energy: medium; role: accent; formats: feature, launch, sting

## Mechanism
An image or screen arrives as coarse grey blocks that halve in size every two frames until the real picture snaps in, sharp and in full colour.

## Use when
Revealing an image, avatar, map or screen in a digital or tech brand; the resolve after a locked state; a beat-synced reveal.

## Avoid when
Text-heavy screens (half-resolved text looks broken); calm, quiet brands; more than twice per film.

## Original recipe (adapt to Syka native time and nodes)
Render the target's final look as a still (`npx remotion still` for a live component, or the image itself) and pre-bake downsampled copies at 48, 24, 12, 6 and 3 px blocks (PIL resize with BOX), shown upscaled with `imageRendering: 'pixelated'`. From cue c, pick the copy by Math.floor((fd(frame) - c) / 2) so each size holds 2 f, and hand over to the live component on the frame the block would reach 1 px; run `filter: saturate()` from 0 to 1 and brightness from 0.7 to 1 across the same 12 f on E.smooth. The stepping is discrete state read from fd, so it stays crisp under the blur pass.

## Original timing
48, 24, 12, 6, 3, then 1 px over 10-12 f (2 f per size); saturation and brightness over 12 f on E.smooth; an optional 4-6 f hold at 48 px so the resolve starts on a beat.

Upstream evidence count: 0; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
