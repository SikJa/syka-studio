# Shared highlight walks the menu

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · mi-shared-highlight-walk
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: micro_interaction; energy: calm; role: workhorse; formats: walkthrough, feature, vertical

## Mechanism
One rounded highlight slides from row to row of a sidebar or menu, trailing the cursor, and the chosen row settles into a pale accent tint.

## Use when
Navigation through a menu, sidebar or list should read as a small human decision, with spatial continuity.

## Avoid when
The rows are too small to read at the shot's framing (push in first), or a soft radial bloom would be added to the highlight.

## Original recipe (adapt to Syka native time and nodes)
Render a single absolutely positioned highlight behind the rows: radius 8 px or row height / 2, C.white on a dark sidebar, C.mist on a light one. Tween its translateY and height to each target row's rect, taken from the layout data, over 12 f E.out, starting 4 f after the cursor reaches that row. Walk about 24 f per row; the first hover can appear in one frame. On the click, mix the chosen row's background to C.accent at 10% opacity over 8 f E.ui and its label to C.ink, then fade the moving highlight over 8 f. The row text never moves.

## Original timing
12 f E.out per hop; about 24 f per row; trails the cursor by 4 f; click tint 8 f E.ui; highlight fade 8 f.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
