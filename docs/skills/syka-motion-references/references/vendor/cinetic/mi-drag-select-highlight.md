# Drag-select snaps glyph by glyph

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · mi-drag-select-highlight
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: micro_interaction; energy: calm; role: accent; formats: walkthrough, feature, launch

## Mechanism
An I-beam presses at the start of a phrase and drags across it, a tinted highlight grows behind the text one whole character at a time, and on release a small action bar grows out of the selection, ready for the product to act on it.

## Use when
The product acts on a piece of text the user picks (rewrite, translate, comment, format, ask about a passage), and the pick should read as a human choice rather than a preset.

## Avoid when
The text is under about 40 px tall at the shot's framing (push in first), the range spans more than two lines, or the cursor never touches text anywhere else in the film.

## Original recipe (adapt to Syka native time and nodes)
Measure the line once under FontGate: px[k] = measureTracked(text.slice(0, k), size, weight, track) for every k, so the highlight snaps to real glyph edges. Park the I-beam on boundary a and press with pressAt at DOWN. Then drag it to boundary b along x = lineLeft + mix(px[a], px[b], prog(f, DOWN + 2, DOWN + 2 + D, E.smooth)), with D = max(24, 2 x (b - a)) f, so the cursor stays at or under 12 px/f. The selection end is the boundary nearest the cursor, decided on fd(f): k is the index in a..b that minimises |px[k] - x|. The highlight therefore jumps one glyph at a time and never tweens, and that stepping is what makes it read as a real selection. Draw it between the field and the glyphs (layer order: field, highlight, text, cursor), from px[a] to px[k] at full line height with a 3 px radius, in mixColor(C.paper, C.accent, 0.22), keeping the text C.ink. On a dark stage use solid C.accent with C.white text, but only if the accent means 'chosen'. Release the press 6 f after the last step. 4 f later, grow an action bar 12 px above the line from the selection's top centre: transformOrigin at its bottom centre, scale lmix(0.05, 1, prog(f, UP + 4, UP + 14, E.out)), opacity over its first 4 f. For the follow-up, either remove the range in one frame (highlight and glyphs together, with the rest of the line closing up through the measured layout) and type the replacement in from px[a] with TypeOn, or restyle the selected glyphs in place. To select a whole word, use a double click: two presses 8 f apart select it in one step on the second press.

## Original timing
Drag about 2 f per glyph (24-40 f) on E.smooth, cursor at 12 px/f or less; highlight steps per glyph on whole frames; release 6 f after the last step; action bar 10 f E.out from +4 f; hold at least 36 f before the edit; replacement typed over about 26 f; double-click presses 8 f apart.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
