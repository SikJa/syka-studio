# Companion glyph swaps mid-count

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · dn-count-glyph-swap
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: data_and_numbers; energy: medium; role: accent; formats: launch, feature, loop

## Mechanism
A small icon riding a counting number (a flag, an avatar, a status glyph) swaps to its destination state when the count crosses a threshold, then drops from superscript to the baseline.

## Use when
The count carries a from-to story (origin to destination, free to paid, pending to done) that one icon can tell.

## Avoid when
The glyph would only be decoration; counts shorter than 20 f, where the swap gets lost.

## Original recipe (adapt to Syka native time and nodes)
Set a 0.45 em glyph at the number's top-right as a superscript (translateY -0.35 em). Swap its source on the first whole frame where the shown value reaches the threshold (an fd-based v >= T compare, about 60% of the way through the count), cutting between the two images with no crossfade. On that frame start the drop: translateY from -0.35 em to 0 over 8 f with arrive(prog(frame, swap - 1, swap + 7, E.out)), so the new glyph seats on the baseline while the count is still finishing. Put a soft tick on the swap frame, separate from the count ticks.

## Original timing
Swap at ~60% of the count (frame 17 of a 28 f count). Drop 8-12 px at 1080p over 8 f on E.out through arrive. The count lands 10-11 f after the swap.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
