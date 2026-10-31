# Scramble decode

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ty-scramble-decode
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: typography_motion; energy: medium; role: accent; formats: feature, walkthrough, sting, loop

## Mechanism
A string of random glyphs locks into the real text from left to right, or real letters roll through the alphabet into gibberish and back.

## Use when
Keys, codes, private or encrypted values, numbers resolving, a short technical name in a feature beat.

## Avoid when
Prose statements (it delays reading); the brand name in the end lockup; glints or sparkles on the glyphs.

## Original recipe (adapt to Syka native time and nodes)
Character i shows target[i] once fd(f) >= lock_i = s + 5i, otherwise a glyph from a fixed pool chosen by rand(`${i}:${Math.floor(fd(f) / 2)}`), which changes on twos and repeats exactly on every render; use tabular or mono figures, or pin each slot to the target glyph's measured advance, so the width never jitters. Unlocked glyphs sit at 50% opacity (or C.mute) and locked glyphs at ink, optionally with a 12 f accent decay on lock. Code-roll variant: each letter steps one character code per frame from an offset toward its target, or away from it as an exit while a container takes its place.

## Original timing
One lock every 5 f (about 48 f for a 10-character string); unlocked glyphs change every 2 f; accent decay 12 f E.out; code roll 1 step per frame, 4-8 steps per letter.

Upstream evidence count: 3; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
