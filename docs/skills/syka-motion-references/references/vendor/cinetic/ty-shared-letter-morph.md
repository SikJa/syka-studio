# Shared-letter morph

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ty-shared-letter-morph
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: typography_motion; energy: medium; role: accent; formats: launch, feature, sting

## Mechanism
One word turns into another: the letters both words share stay and slide into place while the new letters tumble in and click upright.

## Use when
Two words that share letters and whose relationship is the point (before and after, problem and product); one memorable word turn per film.

## Avoid when
Fewer than 2 shared letters; words longer than about 8 letters; fast films where 60 f of letter flight is too slow.

## Original recipe (adapt to Syka native time and nodes)
Split both words into glyph spans at measured, kerned positions; map shared characters (same letter, nearest index) so they keep their element and slide to the new x on prog(f, s, s + 24, E.out), while unshared old glyphs fade out over 6 f and the word spaces collapse over 8 f. Each new glyph starts at an offset of +-150 px in x and +-120 px in y from rand(`g${i}`) with a rotation of 90-180 degrees and animates to rest on E.out over 24 f, opacity 0 -> 1 over the first 12 f so it stays faint while faster than 20 px/f, with start times spread over 56 f and the last glyph dropping from above. Check every frame on a contact sheet so no in-between state spells another word.

## Original timing
Space collapse 8 f; old glyph fade 6 f; each new glyph 24 f E.out (about 45 px/f on frame 1), opacity 12 f; starts spread over 56 f; hold at least 36 f after the last glyph settles.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
