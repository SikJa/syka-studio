# Fanned stack resolves into slots

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ui-fan-resolve-to-slots
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: ui_choreography; energy: medium; role: signature; formats: launch, feature, vertical

## Mechanism
A tilted, overlapping stack of cards spreads into an even row, or each card flips to show its face and flies small into a slot of a list grid where its label resolves.

## Use when
Many options, offers, integrations or tools becoming an orderly set: the 'all in one place' or 'compare them all' beat.

## Avoid when
The cards must be read while they move, or there is only one card.

## Original recipe (adapt to Syka native time and nodes)
Start with 4-6 cards stacked 20 px apart with seeded tilts (rand(i) mapped to +-6 deg), or a fan (rotateZ -20 deg, rotateY 25 deg, 40 px offset), z-order from the stack. Row preset: x = mix(stackX + 20*i, slotX_i, p) and rotate = mix(seed_i, 0, p) with p = prog(f, t0 + 2*i, t0 + 2*i + T, E.out) and T = max(24, 0.09 x travel) f, so the farthest card stays under 70 px/f and nothing overshoots. Flip preset: card i starts at t0 + 6*i, turns rotateY 0 to 180 deg on E.linear over 6 f, or 8 f for cards wider than 200 px so the edge stays near 50 px/f at edge-on (swapping from its muted back to its full face at 90 deg), drifts on E.out for 12 f (28 down to 7 px/f), then FLIPs to its grid slot rect (scale about 0.25, rotateZ to 0) over max(12, travel/20) f on E.rest; its label then rises 6 px and clears from blurIn(p, 6) over 8 f. Six cards should land within about 60 f.

## Original timing
Row: 2 f stagger, T = max(24, 0.09 x travel) f (E.out), tilt +-6 deg. Flip: 6 f stagger, flip 6 f (8 f over 200 px wide, E.linear), drift 12 f (E.out), FLIP to slot max(12, travel/20) f (E.rest), label 8 f; six cards in ~60 f.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
