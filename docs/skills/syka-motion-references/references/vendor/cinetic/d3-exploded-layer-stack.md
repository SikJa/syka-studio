# Exploded layer stack

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · d3-exploded-layer-stack
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: depth_and_3d; energy: medium; role: accent; formats: launch, feature

## Mechanism
A live UI component turns to a three-quarter view and separates into its layers along depth to show how it is built, then snaps back together and turns flat.

## Use when
Explaining what a product is made of (data, logic, interface), or that one surface stacks several capabilities.

## Avoid when
The component is visually thin (the layers look identical), or the act's axis is already yaw.

## Original recipe (adapt to Syka native time and nodes)
Split one component into 3-5 full-size layers that share its rect (surface, content block, controls, one live chip) and render them in z order. Turn the group to a three-quarter view on the anchor camera (yaw -28 deg, pitch 14 deg, perspective 2200, roll outside the tilt) on E.cam over 36 f. Then separate the layers to translateZ = i*90 px on E.out over 24 f with stagger(i, n, 12), each casting a neutral shadow on the layer below (alpha 0.18, blur 20 px, offset growing with the gap). Hold for up to 48 f on a yaw drift of 0.05 deg/f while one layer animates its own state. Then collapse z to 0 on E.contact over 16 f, punch 1 + 0.015*hitPulse(t, 2, 6) on the contact frame, and return yaw and pitch to 0 on E.rest over 30 f, starting 10 f before the collapse ends; lay the UI out at shot scale with CSS zoom so its text stays sharp at the angle.

## Original timing
Turn 36 f E.cam; separate 24 f E.out with a 12 f stagger span, 80-120 px per layer; hold up to 48 f with a 0.05 deg/f yaw; collapse 16 f E.contact plus punch hitPulse(t, 2, 6) x 0.015; flatten 30 f E.rest, overlapping by 10 f.

Upstream evidence count: 0; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
