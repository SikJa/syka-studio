# Mini bar-chart answer card

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · dn-answer-card-bars
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: data_and_numbers; energy: calm; role: workhorse; formats: walkthrough, feature, launch

## Mechanism
Inside a chat or a panel, an answer arrives as a small card of labelled horizontal bars that grow in sequence, followed by a one-line insight that states the key figures.

## Use when
An AI or analytics product answers a question with data; a walkthrough needs one piece of quantitative proof.

## Avoid when
More than 6 rows, where the group outruns 30 f and the labels shrink; bars that carry no real meaning.

## Original recipe (adapt to Syka native time and nodes)
The card rises 24 px on SPR.firm (opacity over 10 f on E.smooth). Each row holds a label, a bar track (C.mist on paper, C.ink2 on ink) and a value. Bar i's width is value% x track x prog(frame, at + 5i, at + 5i + 20, E.outSoft), and its value counts on the same progress. Keep tracks at or under 300 px, or stretch the grow to track/15 frames, so the bar tip stays at or under 70 px/f. Only the row the insight is about takes C.accent; the rest stay neutral. Six frames after the last bar lands, type the insight with TypeOn with its two figures at weight 600. Keep the card under a 2% camera breath while it is read, and optionally hard-cut on the next 8th to a 2.4x punch-in on the highlighted row (cam-punch-in-insert) that pans sideways with inertia(f, cut, 20, 0.89), starting at the 20 px/f text limit and settling in about 30 f.

## Original timing
Rows 20 f each on E.outSoft at a 5 f stagger (the group lands within 30 f). The insight types over ~40 f, starting 6 f after the last bar. Card visible ~180 f under a 2% breath. Optional 2.4x punch-in cut, then a pan from 20 px/f decaying 0.89 per frame (settled in about 30 f).

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
