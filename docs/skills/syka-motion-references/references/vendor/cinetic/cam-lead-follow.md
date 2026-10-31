# Follow the lead dot

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · cam-lead-follow
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: camera; energy: medium; role: workhorse; formats: walkthrough, feature, vertical, launch

## Mechanism
A small lead (a progress dot, a travelling packet, a drawing line's head) moves through the layout and the camera follows it with a soft lag, never quite stopping, so the viewer always knows where to look.

## Use when
Agent progress, pipelines, timelines and journeys across a map: any story told by one thing moving through a layout.

## Avoid when
The lead moves faster than about 20 px/f for long stretches (the lag lets it escape the frame), or the whole layout fits in one framing.

## Original recipe (adapt to Syka native time and nodes)
Make the follow a pure function of the frame: loop i from the shot's first frame to f, updating c += (lead(i) - target - c) * 0.08 (target is the lead's desired screen position, for example 40% of the frame height), plus a constant 2 px/f drift in the direction of travel; never keep state between renders. Feed c into the anchor camera (ax, ay on the lead's world point) and draw the lead as a flat dot in the one accent colour with no halo. Reveal each step row as the lead passes it: opacity prog(f, tPass, tPass + 12, E.smooth) with a 12 px rise through arrive(). At a corner, let the lead turn first and the camera's lag carry the turn; at the destination, punch in (cam-punch-in-insert) or ease to rest on E.rest.

## Original timing
Lag coefficient 0.08 per frame (time constant about 12 f). Peak 12.5 px/f, residual drift 2-2.5 px/f, never 0. Step rows reveal over 12 f as the lead passes. Bumps between steps about 40 f.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
