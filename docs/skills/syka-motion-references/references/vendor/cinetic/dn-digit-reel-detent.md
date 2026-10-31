# Mechanical digit reel

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · dn-digit-reel-detent
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: data_and_numbers; energy: medium; role: workhorse; formats: any

## Mechanism
Each digit sits in its own masked column and rolls vertically like an odometer: the low columns spin while the high ones step once, landing column by column.

## Use when
Counters with a tactile, product-like feel: totals, balances, counters that step on visible events.

## Avoid when
The film already counts with plain in-place digits (keep one counting style per film); fewer than 3 changes, where one roll is enough.

## Original recipe (adapt to Syka native time and nodes)
Use Roll from src/fx/Roll.tsx in count mode (from, to, start, dur 60, ease E.out, roll 14, group ','). countSteps places a step on every whole frame where the integer changes, so the low columns spin a slot per frame while each high column rolls once on its own E.out, and the fixed column count keeps the width still. For an event counter, pass steps at the landing frames of their causes, with roll 6-8 f. For a single column that matters (a badge going 9 to 10, the leading digit of a total), build that strip by hand and drive its slot with spr(frame, step, SPR.detent), so it clicks home with the one small overshoot a detent is allowed. Ticks go on step frames, thinned to one per 2-3 f while they are dense, with each of the last three steps ticked.

## Original timing
Count 60 f on E.out. Column roll 14 f (6-8 f for event counters). Detent landing ~16 f. Ticks at least 2 f apart.

Upstream evidence count: 0; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
