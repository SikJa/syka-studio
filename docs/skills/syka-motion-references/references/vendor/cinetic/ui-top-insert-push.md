# Top insert pushes the list down

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ui-top-insert-push
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: ui_choreography; energy: medium; role: workhorse; formats: launch, feature, loop, walkthrough

## Mechanism
New items arrive at the top of a list one at a time and every earlier item slides down one slot, on a steady metronome that reads as abundance or on a slower cadence where each row resolves as it is generated.

## Use when
Results, messages, subtasks or saved items accumulating: generated rows, imports landing, a feed or a stack filling up.

## Avoid when
The whole list should appear at once (row cascade), or there are so many inserts that the pushes blur into noise (scroll instead).

## Original recipe (adapt to Syka native time and nodes)
Compute every item's y from the data each frame (listLayout from the product-ui reference, newest at index 0), so earlier items slide down one pitch on E.ui as each new one mounts; overlapping pushes simply add. Metronome: one insert every 14 f with a 155 px pitch pushed over 20 f (about 21 px/f); the new pill reveals left to right with clip-path inset(0 100% 0 0) to inset(0) over 12 f on E.ui, its icon leading and its label fading in 4 f later, while any paired object (an item landing on a stack) drops 60-90 px with opacity over 10 f on E.out; wrap the group in a camera drift whose velocity decays as vStart*0.97^f from about 19 to 3 px/f over 90 f. Generation: one insert every 36-40 f, the row starting at scaleX 0.6 about its left edge with blurIn(p, 6) and an 8% C.accent tint, reaching full width, sharp and neutral over 12 f on E.out while the rows below move 66 px over 10 f on E.ui. Put a tick on each insert frame (LANDINGS) so the cadence is heard.

## Original timing
Metronome: every 14 f, push 155 px over 20 f (E.ui), pill reveal 12 f (E.ui), label +4 f, camera drift 19 to 3 px/f (x0.97 per frame). Generation: every 36-40 f, resolve 12 f (E.out) from scaleX 0.6 and 6 px blur, push 66 px over 10 f (E.ui).

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
