# Top-to-bottom row refresh

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · dn-row-cascade-value-swap
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: data_and_numbers; energy: medium; role: accent; formats: walkthrough, feature

## Mechanism
When a filter changes, a thin scan line crosses each table row in turn from top to bottom, and the row's icon, label and values change behind it.

## Use when
Tables, activity feeds or leaderboards that refresh on a filter or a new period.

## Avoid when
Only one cell changes, so a Roll on it is enough; more than 8 rows, where the cascade reads as a queue.

## Original recipe (adapt to Syka native time and nodes)
Two frames after the filter chip lands, row i gets its own scan, x_i = rowW * prog(frame, at + 3i, at + 3i + 20, E.linear). Clip the old row content with inset(0 0 0 x_i px) and the new with inset(0 (rowW - x_i) px 0 0), so each cell changes as the line crosses it and nothing is crossfaded. A 1.5 px hairline in C.line rides x_i and fades over its last 6 f; only the row the story is about gets the accent. Figures that change by a small amount roll with Roll (12 f) from the frame the line reaches their cell, instead of wiping.

## Original timing
Starts 2 f after the chip lands. 3 f row stagger. 20 f per row, linear (at most 60 px/f across a 1,250 px row). Six rows finish within ~35 f. Hairline fades over 6 f.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
