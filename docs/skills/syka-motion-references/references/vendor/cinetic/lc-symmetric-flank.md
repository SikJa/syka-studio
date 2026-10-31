# Centre object with mirrored flanks

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · lc-symmetric-flank
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: layout_and_composition; energy: medium; role: accent; formats: launch, feature, walkthrough

## Mechanism
A narrow centre object (a phone-width window, a pill, a big number) holds the middle while matching elements sit on both sides: the two halves of a caption, or two mirrored columns of items.

## Use when
A narrow device or pill leaves empty sides; a stat that needs visible volume on either side; inputs and outputs around one product; the tagline that frames a logo pill before the end.

## Avoid when
Wide centre subjects (each flank gets squeezed under 20% of the frame), or vertical formats (stack above and below instead).

## Original recipe (adapt to Syka native time and nodes)
Build a three-column row centred on (W/2, H/2): [left flank, right-aligned] [centre object] [right flank, left-aligned], with a 3% W gutter (58 px at 1080p) between each flank and the object. Caption version: split the sentence so the object stands in for a word, and reveal the halves with Words (blur to focus), the right half 20-42 f after the left. Column version: two columns of 80 px items, rows offset alternately by half a row, the right column built as the mirror of the left. Rows appear top to bottom in sync on both sides, 6 f per row (opacity plus a 10 px rise, 12 f on E.out); then both columns drift outward with a U-shaped speed while the centre statement rises 50 px over 38 f on E.outSoft.

## Original timing
Caption halves 20-42 f apart; hold about 60 f. Column rows 6 f apart (five rows in about 30 f); outward drift 3.8, then 0.7, then 1.8 px/f over about 120 f. Centre numeral rises 50 px over 38 f.

Upstream evidence count: 4; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
