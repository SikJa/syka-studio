# Icon-led ragged word stack

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · lc-icon-ragged-stack
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: layout_and_composition; energy: medium; role: accent; formats: launch, feature, vertical

## Mechanism
A short lead word is followed by three or four keywords on separate lines, each with a small line icon, set at staggered x positions so the list has a rag instead of bullets.

## Use when
Listing three or four abstract capabilities, platforms or audiences that would otherwise be a bullet list; a 'works across X, Y, Z' beat.

## Avoid when
More than four items, items longer than two words, or icons that decorate rather than mean something (then drop them and keep the rag).

## Original recipe (adapt to Syka native time and nodes)
Build a flex column with one row per keyword. Each row is a 1 em inline SVG line icon (stroke width matching the type's stem, coloured like the text) followed by the word, shifted by translateX from a fixed rag table such as [0, +120, -60, +180] px. The lead word sits above in C.mute; the keywords are C.ink at TYPE.secondary size or larger. Each row enters with translateY 12 px to 0 through arrive(prog(f, s_i, s_i + 22, E.out)) and opacity on the same progress, rows 10 f apart; while held, the whole stack drifts upward at 0.4 px/f.

## Original timing
Rows 8-12 f apart (10 by default), 22 f each on E.out, 12 px rise. Hold the full stack 60-80 f with the drift, then exit in reading order 4 f apart.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
