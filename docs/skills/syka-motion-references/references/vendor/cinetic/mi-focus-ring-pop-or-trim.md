# Focus ring: pop on click, trim to point

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · mi-focus-ring-pop-or-trim
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: micro_interaction; energy: any; role: accent; formats: feature, walkthrough, launch, vertical

## Mechanism
A thin outline around a control either pops outward and fades the moment it is clicked, or draws itself clockwise around a target and erases from the tail, pointing at the action without a cursor.

## Use when
A click needs a visible result the next shot can build on, or a calm frame must point at the next action without moving a cursor.

## Avoid when
The cursor already sits on the target (the ring is redundant), or the ring would need a glow or blurred halo to read.

## Original recipe (adapt to Syka native time and nodes)
Draw an SVG rounded rect around the control's bounds, with rx equal to the control radius plus the outset, a crisp 2-3 px stroke and no blur copy. Pop mode: on the press frame, grow the outset from 4 to 14 px with prog(..., E.out) over 8 f and fade the stroke from 0.9 to 0 linearly over 20 f. For a handoff, keep the ring at 14 px instead so it becomes the border of the next element (an alert card, or the frame of the next shot). Trim mode: 6 px outset, dasharray '10 8', masked by a second rect with pathLength 1 that shows only the run from tail to head (strokeDasharray `${h - t} 1`, strokeDashoffset -t). Here head = prog(f, s, s + 24, E.smooth) and tail = prog(f, s + 24, s + 48, E.smooth). Repeat on the next target about 108 f later while the cursor rests nearby. Use C.accent for the stroke only when the accent's one meaning is 'act here'; otherwise use C.ink on light stages and C.white on dark ones.

## Original timing
Pop: outset 4 to 14 px in 8 f E.out; opacity 0.9 to 0 over 20 f, linear from the press. Trim: draw 24 f and erase 24 f, both E.smooth (a 48 f loop); dashes 10/8 px, 3 px stroke; next target about 108 f later.

Upstream evidence count: 3; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
