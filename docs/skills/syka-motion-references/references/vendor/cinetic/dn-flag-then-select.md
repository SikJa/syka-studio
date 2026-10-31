# Flag cascade, then one chosen

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · dn-flag-then-select
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: data_and_numbers; energy: calm; role: workhorse; formats: feature, walkthrough, launch

## Mechanism
Status marks appear on a set of cards one after another, then a single card switches to the accent state: many flagged, one picked.

## Use when
Triage, review, matching, anomaly detection: anything that narrows many down to one.

## Avoid when
The pick isn't what the product actually outputs; grids of more than ~12 cards, where the cascade reads as a queue.

## Original recipe (adapt to Syka native time and nodes)
Card i gets its flag at at + 6i: its border mixes from the card fill to a mid grey over 6 f on E.ui, and a 10 px hollow dot scales from 0 to 1 on SPR.micro. Flags stay neutral so the one accent can mean 'chosen'. About 28 f after the first flag, the chosen card switches over 8 f on E.ui: border to C.accent, a 6% accent inner tint, the dot filled, and scale 1 + 0.02 * hitPulse(t, 2, 6). Hold for at most 48 f with a slow 2% push toward it, then the chosen card leaves first on E.in into the cut.

## Original timing
Flags 6 f apart, 6 f each. Selection ~28 f after the first flag, an 8 f change. Hold at most 48 f with a 2% push. The chosen card exits on E.in.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
