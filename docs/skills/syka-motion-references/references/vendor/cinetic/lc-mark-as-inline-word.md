# Mark set as a word

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · lc-mark-as-inline-word
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: layout_and_composition; energy: calm; role: accent; formats: launch, feature, sting

## Mechanism
A logo, partner mark or icon sits inside a sentence on the baseline at cap height, as if it were a word, appearing with its own delayed fade or swapping with a word in the same slot.

## Use when
Co-branding inside a claim, naming a platform or integration without a separate logo slate, or turning a generic noun into the product name in place.

## Avoid when
Marks with fine detail or wide aspect ratios that cannot read at cap height, or the film's own final lockup, which appears once, at the end, on its own.

## Original recipe (adapt to Syka native time and nodes)
Lay out the final centred line with the mark in its own inline slot: height equal to the cap height from inkBox, bottom on the baseline, margin-left one space width (measureTracked(' ')), so the slot is reserved and nothing reflows. Reveal the words first (Words, stagger 8), then fade the mark in on its own about 17 f after the first word: opacity 0 to 1 on prog(f, s, s + 6, E.smooth), with no scale pop. To swap something in the slot, stack two spans: the outgoing one moves to translateY -8 px as it fades out while the incoming one rises from +8 px as it fades in, both over 8 f on E.ui.

## Original timing
Mark appears about 17 f after the first word with a 4-6 f fade. Slot swap 8 f with 8 px travel. The line then drifts at 0.5 px/f.

Upstream evidence count: 3; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
