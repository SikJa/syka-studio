# Cut in mid-sentence, pull back to the line

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · oh-cropped-word-pull-back
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: opening_hook; energy: medium; role: accent; formats: launch, feature

## Mechanism
The film opens inside one giant word, its first letter cropped by the frame edge as if cutting into a thought mid-sentence; after a beat the camera pulls back to reveal the whole sentence at reading size.

## Use when
Copy-led launches built on one charged word, in calm-to-medium films.

## Avoid when
The key word is short or ordinary (the crop will not intrigue), or the film already opens on another zoom-out (icon card, macro number).

## Original recipe (adapt to Syka native time and nodes)
Lay out the whole sentence once at display size (TYPE.display, 120 px) as world content and frame shot A at k = 3.2 on the key word, offset so its first glyph is about 40% cropped by the left edge. Frame 0 is already settling: a vertical inertia(f, 0, 3, 0.8) of about 13 px, then a 0.3 px/f drift through a 36 f hold. Pull back with lc(A, B, prog(f, 36, 92, E.dolly)) to k = 1 with the sentence centred; the log-space zoom keeps the rate even, and glyphs 600 px from the anchor stay under about 20 px/f. The neighbouring words exist from the start with no fades and simply enter the frame as it widens.

## Original timing
Settle 12 f; hold 36 f; pull-back 56 f from 3.2x to 1x on E.dolly (peak about 0.032 ln k per frame).

Upstream evidence count: 0; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
