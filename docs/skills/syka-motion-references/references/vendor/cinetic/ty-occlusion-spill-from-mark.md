# Words spill out from behind a mark

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ty-occlusion-spill-from-mark
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: typography_motion; energy: medium; role: workhorse; formats: launch, feature, sting

## Mechanism
A glyph or icon slides aside and the words shoot out from behind it, clipped at its edge, as if the mark were delivering the message.

## Use when
An icon-led claim mid-film, or an opening line pushed out by the mark already in motion; a feature icon that introduces its own line; a mark or number that says the sentence.

## Avoid when
The end lockup (it appears once and belongs to the end card); marks smaller than the cap height (nothing to hide behind); spills longer than about 360 px.

## Original recipe (adapt to Syka native time and nodes)
Put the words in a container clipped at the mark's current edge (for a leftward spill, clip-path: inset(0 calc(100% - (markX - boxLeft)) 0 0)) and draw the mark above them. Mark: translateX 0 -> +260 px on prog(f, s, s + 20, E.out); words: translateX +320 -> 0 on p = prog(f, s + 1, s + 25, E.out) with blurIn(p, 8) and opacity 0 -> 1 over 6 f, hidden behind the mark at first and readable once they drop below 20 px/f around frame 6. Inline variant: an icon shrinks (lmix 3 -> 1, optionally tilting in 3D) into the bullet slot at the start of a sentence and the words slide out to its right from behind it the same way.

## Original timing
Mark 260 px over 20 f E.out (peak about 73 px/f, blurred master); words 320 px over 24 f E.out (76 px/f on frame 1, under 20 by frame 6), 1 f after the mark; opacity 6 f; hold at least 54 f with a drift.

Upstream evidence count: 3; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
