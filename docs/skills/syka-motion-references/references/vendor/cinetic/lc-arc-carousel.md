# Arc carousel

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · lc-arc-carousel
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: layout_and_composition; energy: medium; role: signature; formats: launch, feature, loop

## Mechanism
A row of cards rides a wide smile-shaped arc across the lower part of the frame, each tilted tangent to the curve, rushing in, coasting slowly through the middle and speeding out.

## Use when
Showing an inventory or collection (templates, cards, products, integrations) where several items should read at once and the set should feel endless; a looping feature beat.

## Avoid when
Items with dense text that must be read at the edges (tilted edge cards are glanced at, not read), or vertical frames where the arc gets too tight.

## Original recipe (adapt to Syka native time and nodes)
Use a circle of R = 1750 px centred at (960, -790) at 1080p. Card i sits at angle theta_i = theta0(f) + i * 11 deg, with x = 960 + R sin(theta_i), y = -790 + R cos(theta_i) and rotateZ(-theta_i), so the arc bottoms out at y = 960 and the cards lean outward toward the edges. Drive it with a U-shaped speed: theta0(f) = 12 deg * (1 - prog(f, 0, 45, E.out)) - 0.25 deg * (f - 45) - 7.6 deg * prog(f, 45, 90, E.in), over 12 opaque cards with soft drop shadows, z-ordered so the centre card is on top. Behind them, a large flat ellipse (or one accent hue fading to transparent) centred above the arc acts as the dome. Apply the motion-blur pass while card speed exceeds 12 px/f (roughly the first 15 f and the last 20 f).

## Original timing
90 f per pass. Card speed 58 px/f on entry, about 8 px/f through the middle, 39 px/f on exit (angular 1.9, then 0.25, then 1.3 deg/f). Spacing 11 deg, about 336 px of arc, for cards 260-300 px wide.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
