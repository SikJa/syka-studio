# Cards dealt or dropped into a grid

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ui-card-grid-arrival
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: ui_choreography; energy: medium; role: workhorse; formats: any

## Mechanism
Cards land in a row or grid one after another, either dealt fast with a small tilt that squares up, or falling from just in front of the camera and shrinking into their slots.

## Use when
Revealing a set of options, results, features or integrations that should read as one set with a clear reading order.

## Avoid when
There is one hero object, or more than about 8 cards (use a row cascade or a scroll).

## Original recipe (adapt to Syka native time and nodes)
Deal preset: card i appears at t0 + 5*i, its opacity stepping to 1 on the first frame while rotate goes 4 to 0 deg and scale 0.95 to 1 over 7 f on E.out, left to right, with no overshoot. Depth-drop preset: card i starts at delays [0, 4, 10, 14] (row-major, 6 extra frames between rows) and goes translateY 534 to 0 px and scale lmix(1.38, 1, p) on the same progress p over 54 f on E.out, half the distance in about 6 f at up to 62 px/f under the motion-blur pass. In the depth-drop keep each card's text and icons at opacity 0 until the card slows (prog(f, s + 8, s + 16, E.smooth)), so content resolves on landing below 20 px/f. Cards are opaque with a soft shadow (0 8px 30px at 6% black) and a radius of about 32 px at 1080p.

## Original timing
Deal: 5 f stagger, 7 f settle (E.out), rotate 4 deg, scale 0.95. Drop: 54 f (E.out), stagger 0/4/10/14 f, 534 px, scale 1.38 to 1, peak ~62 px/f, content fades in from +8 to +16 f.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
