# One control drives several live numbers

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · dn-linked-control-counters
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: data_and_numbers; energy: calm; role: workhorse; formats: feature, walkthrough, launch

## Mechanism
Dragging a slider visibly drives every dependent figure in lockstep, and the fill changes tint once it passes a marked threshold.

## Use when
Calculators, pricing, risk limits, utilisation: any feature whose logic is 'move this and those follow'.

## Avoid when
The dependent figures aren't computed consistently from one formula; more than 3 dependents.

## Original recipe (adapt to Syka native time and nodes)
Drive everything from one progress, p = prog(frame, at, at + 90, E.smooth). The slider fill is mix(0.35, 0.84, p) x track, the thumb (with a 2 px ring) rides the same value, and each dependent figure (percentage, amount, headroom) is computed from that value on fd(frame), rounded and set in fixed-width tabular figures. Past the threshold marker, draw the fill from the marker to the thumb in a brighter tint of the fill hue, and switch the affected figure's colour on the crossing frame. The cursor (Cursor.tsx) grabs the thumb 8 f before the drag starts and rides it. Figures that fall (headroom 44K to 13K) count down on the same p, and the formula is asserted in data.ts so every frame stays consistent.

## Original timing
Drag 90 f on E.smooth (fastest change mid-drag). Cursor grabs 8 f before. Figures update every whole frame. Hold the end state at least 36 f under a breath.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
