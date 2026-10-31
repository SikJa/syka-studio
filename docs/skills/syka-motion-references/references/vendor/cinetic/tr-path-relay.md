# Path relay

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · tr-path-relay
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: transition; energy: calm; role: workhorse; formats: launch, feature, walkthrough, loop

## Mechanism
A line and its lead dot carry the eye from one place to the next. The connector bends around a rounded corner with the camera following, or continues across a cut and enters the next shot from the same edge at the same angle.

## Use when
Money, data or messages travelling (send, route, sync), flowcharts and timelines, and films whose UI already uses lines and nodes.

## Avoid when
The film has no line language, or the path would cross readable text. A path that loops back reads as indecision.

## Original recipe (adapt to Syka native time and nodes)
Draw the connector as an SVG path (stroke ≥ 1.5 px, C.white on ink or C.ink on paper) with pathLength 1, revealed by stroke-dashoffset; corners are arcs of r = 40 px. Place the lead dot with getPointAtLength (from @remotion/paths, or an analytic line-plus-arc), where the arc length grows with prog(f, a, b, E.linear) at 8-16 px/f. The camera follows with a lag: the anchor-camera Shot frames the dot's position at f − 10. Across a cut, start shot B's path at the frame edge where A's path left, at the same angle and speed, so the dot reaches its target 18 f after the cut. Off-frame variant: the dot or cursor speeds out of frame on E.contact over 24 f and stays hidden 12 f while the camera relocates. It then re-enters at ≤ 60 px/f, slowing ×0.92 per frame to rest in about 36 f.

## Original timing
Dot at a constant 8-16 px/f. Corner radius 40 px. Camera lag 8-12 f. One run lasts 60-72 f. After a cut the dot lands 18 f later. Off-frame gap 12 f; re-entry at ≤ 60 px/f, slowing ×0.92 per frame.

Upstream evidence count: 3; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
