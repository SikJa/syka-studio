# Crane down with a delayed push

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · cam-crane-push
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: camera; energy: calm; role: accent; formats: walkthrough, feature, launch

## Mechanism
The camera tilts down the page past the chart to the detail cards while a slow push-in builds behind it, as if the operator were leaning in to read.

## Use when
Moving down a long page or dashboard from the overview to the detail that matters.

## Avoid when
Pages too short to travel 500 px or more, or vertical formats where the push crops the column.

## Original recipe (adapt to Syka native time and nodes)
Sum two vertical components on the anchor camera's sy: a main move of about 240 px on prog(f, a, a + 64, E.smooth), and a 300 px drift on prog(f, a + 40, a + 220, E.rest) that overlaps it, so the motion never stalls and fades out slowly. Multiply k by lmix(1, 1.22, prog(f, a + 40, a + 240, E.rest)) so the push starts 40 f late and peaks while the tilt is decelerating. Put ax on the column the viewer will read so the push doesn't drift sideways.

## Original timing
Main tilt 64 f on E.smooth, about 240 px, peak about 10 px/f mid-move. Drift 300 px from a + 40 to a + 220 on E.rest (peaks near 5.8 px/f, under 0.5 px/f by the end). Push +22% from a + 40 to a + 240 on E.rest, peak about +0.35%/f near a + 98.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
