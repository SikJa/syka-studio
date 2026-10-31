# Container morph into its next role

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ui-container-morph
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: ui_choreography; energy: medium; role: workhorse; formats: launch, feature, walkthrough

## Mechanism
One element changes shape into what it becomes, a button unfolding into a panel, a card stretching into a detail view, a pill collapsing into an app tile, so there is no navigation cut to explain.

## Use when
A click that opens something (button to panel, card to detail), a status becoming an icon, an object docking into its slot.

## Avoid when
The size change comes from content or a drag (live reflow), or the two states have no visual relation.

## Original recipe (adapt to Syka native time and nodes)
Keep one element mounted and animate its position (x and y inside one transform), width, height and border radius from the old rect to the new role's rect; never swap two elements. Use E.whip over 30-36 f (slow first 5 f, speed peak near 40%, long settle) and lengthen it so the fastest edge stays under about 70 px/f (frames >= 3.8 x edge travel / 70); a pill collapsing to a tile keeps its height locked while its radius goes from 999 px to 22% of its side, and a panel's radius eases from 44 to 36 px. The old content fades out in the first 12 f on E.smooth, a title that survives FLIPs to its header position and scale (1 to 0.6) on the same curve, flying at opacity 1 - 0.45*clamp((v - 20)/30) (v its speed in px/f) whenever it passes 20 px/f so it lands sharp, the new content enters 8 f after the speed peak with a 2-4 f stagger, and a backdrop behind a panel morph dims linearly over the same frames. Optional preface: the card's outline retracts first (SVG rect with pathLength 1, strokeDashoffset 0 to 1 over 15 f); for a content swap inside a card that stays, the old child leaves with depart() and blurOut(q, 8) over 18 f on E.in, the card resizes to the new aspect over 20 f on E.out, and the new child arrives with arrive() and blurIn(p, 8) over 18 f on E.out.

## Original timing
Morph 30-36 f (E.whip), edges <= 70 px/f. Old content out 12 f (E.smooth); title FLIP to 0.6 scale; new content +8 f after the peak, 2-4 f stagger; backdrop dim linear over the morph. Outline retract 15 f. Content swap: out 18 f (E.in), resize 20 f (E.out), in 18 f (E.out).

Upstream evidence count: 4; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
