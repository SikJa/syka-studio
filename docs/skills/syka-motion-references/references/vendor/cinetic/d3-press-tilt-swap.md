# Press tilt that hides a swap

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · d3-press-tilt-swap
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: depth_and_3d; energy: calm; role: accent; formats: walkthrough, feature, loop

## Mechanism
A card tips in 3D toward the point that was clicked or tapped and relaxes back flat. The content changes on the tilt's peak frame, so the change has a physical cause.

## Use when
Clicks, copies, likes and swaps in a UI walkthrough that need tactility without a flash.

## Avoid when
Every click in the film already tilts (use it for 1-3 key presses), or the target is a tiny chip where the tilt cannot be seen.

## Original recipe (adapt to Syka native time and nodes)
Wrap the card with a perspective about 3.5x its width (1800-2600 px for full-width panels) and set transform-origin at the edge opposite the press, so the pressed side dips. On the press frame c (the Cursor click), drive rotateX and rotateY toward the press point (direction = the press offset from the card centre, normalised) with an amplitude of 10*hitPulse(f - c, 8, 9) deg: in over 8 f, decaying with tau 9. Swap the state (button fill and label, a photo source, a value) with fd on the peak frame c + 8, so the tilt hides the change. A quick snap variant rocks rotateY 12*hitPulse(t, 1, 2.5) deg plus skewY 2*hitPulse(t, 1, 2.5) deg, swaps the content on the peak and can repeat every 54 f as a rhythm. There is no counter-swing, since overshoot belongs only to true landings.

## Original timing
Press at 10 deg: 8 f in, tau 9 f (under 1 deg by about f30). Snap rock at 12 deg: attack 1 f, tau 2.5 f, settled in about 8 f. Swap on the peak frame; repeat cadence 54 f; often preceded by a 24 f E.cam push-in.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
