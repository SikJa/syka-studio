# Card fan that buries, then scatters

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · d3-card-fan-bury-scatter
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: depth_and_3d; energy: high; role: signature; formats: launch, feature

## Mechanism
A dozen identical cards swoop in from two corners along a curved arc and stack in depth until they bury the frame. They drift for a beat, then scatter outward and leave one small card in the centre that carries the number.

## Use when
A big count or scale claim (cards issued, transactions, users) needs to feel physical before it collapses to one legible number.

## Avoid when
The film already has a card or tile swarm, or the stat must be read at once; in a calm film the 50 f bury is too loud.

## Original recipe (adapt to Syka native time and nodes)
Place N = 12 card divs along a cubic bezier from two opposite corners toward the centre (sample it with getPointAtLength from @remotion/paths). Card i gets rotateZ = the path tangent, rotateY = 35 - 4i deg, rotateX = 18 deg and translateZ = -60i px inside one perspective(2000px) stage; the shot clips with overflow hidden, which flattens preserve-3d, so sort the cards by z yourself before rendering. Each card flies from just beyond the corner (travel at most about 700 px) to its slot on E.outSoft with start offsets stagger(i, 12, 22), then the whole fan drifts 15-40 px and breathes +2% on E.smooth. The hero card sits small and lowest in z at frame centre from the start. The scatter moves every fan card 340 px outward along its own radial vector while translateZ rises +700 px (about x1.5) on E.in, so they leave by scale and travel and uncover the hero card, whose figure then locks (Roll or Words). Card faces use a single-hue tonal ramp (dark to light of one colour, as a dithered PNG) so the repetition reads as one material.

## Original timing
Per card 50 f on E.outSoft, starts 2 f apart (22 f span): the fan covers 50% of its final area by f6, 90% by f26 and all of it by f50 (peak about 62 px/f). Drift 84 f at 0.2-0.5 px/f plus breath +2%. Scatter 26 f on E.in, peak about 75 px/f (master motion blur). The hero figure locks 4-6 f after the last card clears.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
