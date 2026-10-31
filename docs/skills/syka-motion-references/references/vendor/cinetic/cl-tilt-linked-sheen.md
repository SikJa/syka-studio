# Tilt-linked sheen

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · cl-tilt-linked-sheen
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: color_and_light; energy: calm; role: accent; formats: launch, feature, sting

## Mechanism
As a card or device tilts in 3D, a faint highlight band slides across its face in step with the angle, so the surface reads as a real material catching a key light.

## Use when
Perspective UI tilt-ups, cards flipping or settling out of 3D, device turns, and logo tiles yawing.

## Avoid when
Flat 2D layouts with no rotation (use the one-shot specular sweep instead).

## Original recipe (adapt to Syka native time and nodes)
Inside the tilted element, add an overlay above the content and below its 1 px border: linear-gradient(105deg, transparent 40%, C.white at 18% alpha 50%, transparent 60%) at background-size 300%, with screen blend on dark UI or soft-light on light UI. Compute background-position-x from the same rotation value that drives the transform (50% plus 2.5% per degree of rotateY, with rotateX nudging it vertically), so the highlight moves only while the object turns and parks when it settles. Multiply its opacity by clamp((|rotateY| - 2) / 6) so a flat card stays clean. Assume one key light 45° camera-left for the whole film, so every card catches it from the same side.

## Original timing
It follows the tilt move: for example, rotateY going from 12° to 0 over 40 f on E.out moves the band about 30% and parks it. Peak overlay opacity is 0.18 on dark UI and 0.10 on light UI.

Upstream evidence count: 0; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
