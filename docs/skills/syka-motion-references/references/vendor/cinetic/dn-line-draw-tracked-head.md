# Line chart draws with a tracking head

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · dn-line-draw-tracked-head
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: data_and_numbers; energy: medium; role: workhorse; formats: any

## Mechanism
A line or stepped series draws left to right behind a solid dot at its head that the eye can follow, accelerating through the middle and creeping into its last point.

## Use when
Growth, price or usage over time; any chart where the trend is the message.

## Avoid when
Invented up-and-to-the-right data; charts under ~400 px wide, where the head reads as noise.

## Original recipe (adapt to Syka native time and nodes)
Draw the series as an SVG path with pathLength={1}, strokeDasharray 1 and strokeDashoffset 1 - p. Put a solid head dot (r 6 px at 1080p, with a 2 px ring in the stage colour) at the point at fraction p along the polyline, sampled from the data in JS rather than measured from the DOM. Beneath the line, add an area fill in the line's hue fading from 18% to 0% opacity, clipped by a rect whose right edge follows the head. Drive p from 0 to 1 over 96 f on E.rest in a single link: it starts from rest, peaks near 29% of the draw and spends its last third creeping into the last point, so the head never stops and restarts. The head peaks around 40-60 px/f, so the blur pass streaks it while the drawn line stays crisp; when the head lands, roll in the endpoint value with Roll.

## Original timing
Full draw 96 f on E.rest (peak near 29%, 3.5x the mean speed; the last 30 f creep at about 2-3 px/f on a 1,400 px path). Short form: 24 f on E.out, with the area fill fading in from 8 f later over 16 f. Head peaks at 40-60 px/f at 1080p. Endpoint value rolls over 14 f.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
