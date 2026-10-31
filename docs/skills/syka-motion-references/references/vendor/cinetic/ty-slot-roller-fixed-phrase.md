# Slot roller beside a fixed phrase

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ty-slot-roller-fixed-phrase
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: typography_motion; energy: medium; role: signature; formats: launch, feature, loop, vertical

## Mechanism
A fixed phrase holds still while the word in its slot rolls through alternatives one line at a time, speeding up until the last one lands.

## Use when
One sentence frame that fits many subjects or capabilities; listing use-cases without spending screen time; a feature loop that cycles items.

## Avoid when
Items of very different widths in a centred layout (the fixed phrase would have to move); more than about 7 items; any mask loose enough that the neighbours read as a list.

## Original recipe (adapt to Syka native time and nodes)
The fixed phrase sits in its own layer and never moves; the slot is a column of alternatives aligned to the junction, line pitch 1.5x the font size, translated by -index x pitch and cut by a feathered mask-image (transparent beyond +-1.2 pitch, opaque within +-0.5 pitch) so neighbours show only as slivers. Each step rolls on E.whip over 20 f (peak about 0.18 x pitch per frame, 12 px/f at a 68 px pitch); above a 110 px pitch, stretch the step to 0.18 x pitch frames so the rolling word stays at or under 20 px/f; the row on the junction baseline is ink and every other row is C.mute at no more than 1.3:1 contrast, flipped binary when |rowY - baselineY| < pitch/2 (no colour tween). For a run of 5 or more items, accelerate: intervals 26, 14, 12, 8, 8, 4, 4 f, where intervals under 12 f are whole-frame swaps chosen by fd(f) with no tween, the final item rolls home on SPR.detent, and every step gets a tick. For a loop, make the last item equal the first and wrap the index modulo the list.

## Original timing
Step 20 f E.whip (0.18 x pitch frames above a 110 px pitch) every 29-34 f (0.48-0.57 s), 3 steps, then a 28 f hold before the cut. Accelerating run: 26/14/12/8/8/4/4 f (7 items in 76 f), last item on SPR.detent (home in about 9 f), held at least 54 f under a 0.3 px/f line drift. Pitch 1.5x the font size; ticks at least 3 f apart.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
