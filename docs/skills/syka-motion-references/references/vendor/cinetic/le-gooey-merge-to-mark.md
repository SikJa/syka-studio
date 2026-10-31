# Liquid blob resolves into the mark

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · le-gooey-merge-to-mark
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: logo_and_end_card; energy: medium; role: signature; formats: launch, sting, loop

## Mechanism
A dot, or two soft lobes sliding in from the sides, swells into a liquid blob that stretches, splits and snaps into the crisp geometric mark.

## Use when
Products about raw input becoming structure, or about merging and joining. The story device is a dot. Marks made of a few separate primitives.

## Avoid when
Marks with thin strokes or text inside (the threshold eats them). Brands that need crisp precision throughout. Films already using a soft morph seam.

## Original recipe (adapt to Syka native time and nodes)
Draw the mark's primitives as SVG circles and rects in one group, all starting stacked on the seed dot, and move each to its final place on E.smooth with a 2-4 f stagger. Two-lobe version: two large rounded shapes move translateX +/-600 -> +/-160 px on E.outSoft, fuse at centre and frame the closing line. Filter the group with feGaussianBlur stdDeviation 10, then feColorMatrix (type matrix, alpha row '0 0 0 18 -7'), which thresholds the blur into a liquid neck wherever parts are close. Over the last 8 f, ramp stdDeviation 10 -> 0. On the frame it reaches 0, swap the filtered group for the crisp Mark at the identical transform: a one-frame swap of identical shapes, never a crossfade. Use flat fills only; the threshold makes hard edges, and rim lights or inner highlights would be eaten or look like neon.

## Original timing
46 f. Parts travel f0-38 on E.smooth at a 2-4 f stagger, and the blob visibly splits ~26 f in. Blur ramp and crisp swap over the last 8 f. Two-lobe version: converge in 40 f on E.outSoft (first frame ~49 px/f, motion-blur pass on), then drift 0.3-0.5 px/f under the line.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
