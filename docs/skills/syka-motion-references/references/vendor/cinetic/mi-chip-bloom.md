# Chip bloom around content

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · mi-chip-bloom
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: micro_interaction; energy: medium; role: workhorse; formats: feature, walkthrough, launch, vertical

## Mechanism
A container grows out of its content: a dropped icon tile widens into a labelled chip that floods with the accent and wipes back to an outline, or a solid pill swells behind a name so the group becomes a button.

## Use when
An integration, tag or name should become a tangible, clickable object (attached, added, now a button), shown as cause and effect.

## Avoid when
The fill would need several hues to read, or the chip has nothing to do next (a bloom with no follow-up reads as decoration).

## Original recipe (adapt to Syka native time and nodes)
Tile to chip: on the drop, scale the tile 0.8 to 1 over 8 f E.out. Then tween the pill width from the tile width (equal to its height) to the label width plus padding over 12 f E.out. On the same progress, the icon slides to its left slot and the label reveals with a clip-path inset from the right. A flat C.accent fill clipped to the pill is erased by a mask-image linear-gradient with an 80 px feather, sliding left to right over 20 f E.outSoft and leaving a 1.5 px border. Bloom behind: an absolutely positioned pill behind the text (radius height/2, C.ink fill) tweens from the text bounds (measureTracked) to the bounds plus 48 px on each side over 10 f E.out. Meanwhile the text mixes from C.ink to C.white over 6 f, starting on the bloom's second frame. Hold the finished chip at least 18 f before it does anything else.

## Original timing
Tile pop 8 f E.out; widen 12 f E.out; fill wipe-off 20 f E.outSoft with an 80 px feather; bloom behind 10 f E.out with a 6 f text inversion; hold at least 18 f.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
