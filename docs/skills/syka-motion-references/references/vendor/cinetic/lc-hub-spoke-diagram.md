# Hub-and-spoke concept diagram

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · lc-hub-spoke-diagram
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: layout_and_composition; energy: calm; role: accent; formats: walkthrough, feature, launch

## Mechanism
A central product tile sits inside two thin concentric rings with a short streak orbiting it, inputs on the left and outputs on the right, under a centred one-line headline.

## Use when
Explaining a many-inputs, many-outputs product (integrations, sources to results) in one still composition without narration; the concept beat before a walkthrough.

## Avoid when
More than five chips per side, or when the real product UI can show the same thing directly.

## Original recipe (adapt to Syka native time and nodes)
Centre an opaque 64-96 px icon tile with a soft shadow, and draw two SVG circles around it at 1.8x and 2.8x the tile size: 1.5 px strokes at 15% opacity. The orbiting streak is an SVG arc of about 70 deg on the outer ring, with stroke opacity ramping from 0 to 1 toward its head (a one-hue linearGradient in C.accent), turned by rotate(1.5 * f deg). Inputs (left) and outputs (right) are small opaque labelled chips in mirrored rows that enter together, 6 f per row (opacity plus a 10 px rise, 12 f on E.out); then connector lines from each chip to the outer ring draw with stroke-dashoffset over 16 f on E.out. The headline above reveals with Words, and the orbit keeps the hold alive.

## Original timing
Rows 6 f apart, 12 f each; connectors 16 f on E.out; streak 1.5 deg/f (a quarter turn per second) on E.linear. Hold 120-200 f; the rotation keeps it moving.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
