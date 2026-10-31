# Cursor glyph follows context

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · mi-cursor-glyph-context
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: micro_interaction; energy: any; role: workhorse; formats: walkthrough, feature, launch, vertical

## Mechanism
The pointer changes shape with what it is over, as a real system pointer does: an I-beam over text, an open hand over something draggable, a closed fist while dragging, and the arrow everywhere else. Each change is a one-frame swap.

## Use when
A cursor drives a walkthrough that both types and drags, and the pointer must behave like the real system's rather than an arrow stamped on everything.

## Avoid when
The cursor only clicks buttons (the arrow is correct there), or a snappy vertical edit would flash the glyph changes past before they read.

## Original recipe (adapt to Syka native time and nodes)
Add a kind prop to src/fx/Cursor.tsx ('arrow' | 'ibeam' | 'hand' | 'grab'). Draw every glyph with the same C.ink fill, 2.4 px C.white outline and drop shadow, and give each its own hotspot, so a swap never shifts the point the cursor acts on: the arrow keeps its tip at (x, y); the I-beam (a 2.5 px stem 28 px tall with 9 px crossbars) is centred on (x, y); the open and closed hands have the hotspot at the centre of the hand. Choose the kind on fd(f) from the layout rects, never by tween. Use 'ibeam' while the hotspot is inside a text field or selectable text, 'hand' over a draggable item, and 'grab' from the frame pressAt goes down on a grab until the release. Then show 'hand' for 6-10 f until the hotspot leaves the item, and 'arrow' everywhere else. Each swap takes one frame, with no crossfade or scale blend. The press scale (1 - 0.12 x press) and the motion-blur pass apply to every glyph alike, and the fist appears on the press frame, so closing the hand is the press. While dragging, evaluate the item's path at f - 2 so it rides behind the fist and reads as pulled. Use the I-beam only on slow approaches (15 px/f or less) and at no less than about 2.2% of frame height (Cursor scale about 1.6 at 1080p), because its thin stem flickers in fast motion.

## Original timing
Swap in 1 f on the frame the hotspot crosses a rect edge; fist on the pressAt down stroke (4 f down, 8 f recoil); open hand for 6-10 f after the release; item trails the fist by 1-3 f; I-beam approaches at 15 px/f or less.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
