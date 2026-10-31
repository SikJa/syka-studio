# Unit grid that fills to the count

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · dn-unit-grid-tally
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: data_and_numbers; energy: calm; role: accent; formats: launch, feature, vertical

## Mechanism
A grid of small squares, each standing for a fixed number of units, fills in a diagonal wave while a counter beside it reaches the total, and one cell lands in the accent.

## Use when
Shares and proportions ('3 in 10 teams'), quotas, capacity; making a large count tangible without a chart.

## Avoid when
Exact values with many significant digits, which the grid can't show honestly; cells under 12 px on vertical phone formats.

## Original recipe (adapt to Syka native time and nodes)
Lay out an n x m grid of 14-20 px rounded squares as a C.line track, each square standing for a fixed number of units. Fill cell (r, c) from at + stagger(r + c, n + m - 1, 30, E.out), with opacity over 8 f on E.smooth and scale from 0.6 to 1 on SPR.micro, and fill the last cell by its fraction through a width clip. The counter beside the grid shows filled cells x unit on fd(frame) in tabular figures, so the number and the grid can never disagree. The cell that carries the point (the last one, or 'you') lands in C.accent with scale 1 + 0.15 * hitPulse(t, 2, 8).

## Original timing
Diagonal wave over 30 f on stagger with E.out. Each cell fades over 8 f, with an SPR.micro scale. Accent cell pulse: attack 2 f, tau 8 f. Hold at least 36 f with a 2% push.

Upstream evidence count: 0; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
