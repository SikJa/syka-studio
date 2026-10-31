# Card shrinks to a pill, words close in

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · le-card-to-pill-flank
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: logo_and_end_card; energy: medium; role: accent; formats: launch, feature, walkthrough

## Mechanism
The last content card empties and shrinks into a small pill while the tagline words slide in from beyond the frame edges, blurred to sharp, to sit on either side of it; then the logo appears inside the pill.

## Use when
Films that opened with a gap or pill inside a headline (the reverse closes the bookend). Products whose output is a card, post, message or result. A tagline that brackets the brand: [wordL] [mark] [wordR].

## Avoid when
There is no card on screen to collapse. Words too long to fit beside the pill inside the safe width. Light-on-light stages where the pill loses its edge.

## Original recipe (adapt to Syka native time and nodes)
Build a flex row [wordL][slot][wordR] and animate the slot's width from the card's width to the pill's width. Use Morph for the slot's box: radius to h/2, fill from the card surface to a solid tonal step of the stage. The words are then carried in from off-frame by the layout alone. Fade the card's content out over the first 6 f, before the slot moves fast, and shrink on E.whip. The words get blurIn(p, 8) and opacity prog(..., E.smooth), so they fly faded and resolve sharp on landing. When the pill lands, fade the Mark in inside it over 14 f on E.smooth. The row stays centred on the frame throughout.

## Original timing
Content fade: 6 f. Shrink: 30 f on E.whip (card ~1240 -> ~310 px; each word travels ~470 px at a peak of ~58 px/f with the motion-blur pass on, faded until it lands). Logo fade: 14 f, starting 8 f after the pill lands. Then hold 90-120 f under a 10-15% push (le-living-hold).

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
