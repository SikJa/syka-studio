# Row cascade

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ui-row-cascade
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: ui_choreography; energy: medium; role: workhorse; formats: any

## Mechanism
List rows or cards appear one after another from top to bottom, each rising a few pixels as it fades in, so the list reads as data streaming in.

## Use when
Populating any list, inbox, table, feed or a pair of mirrored input and output columns.

## Avoid when
Rows are added one at a time over a longer beat (top insert), or the list arrives by scrolling (flick scroll).

## Original recipe (adapt to Syka native time and nodes)
For row i, start = t0 + 4*i (6*i for taller cards); translateY 8 to 0 px through arrive() and opacity 0 to 1, both over 12 f on E.out, placed by transform only. When two columns describe input and output, give both sides the same row index so the build is mirrored and 5 rows complete in about 30 f. Let each row's text land in C.mute and darken to C.ink over 12 f, 40 f after the row arrives (mixColor), so the eye reads the structure first and the words second. Start the cascade about 20 f before the previous move (a transition, a portal edge) finishes, so the start of the scene is hidden inside it.

## Original timing
Stagger 4 f (rows) to 6 f (cards); each row 12 f (E.out), 6-12 px rise; ink-in 12 f at +40 f; overlap the previous move by ~20 f.

Upstream evidence count: 3; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
