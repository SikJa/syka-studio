# Rising colour wash carrier

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · cl-rising-wash-carrier
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: color_and_light; energy: medium; role: accent; formats: launch, feature, sting, vertical

## Mechanism
A soft single-hue field rises from the bottom edge behind the type, swells and sweeps up across the frame on the change, then recedes off the top, so the foreground swap reads as one move.

## Use when
Changing cards behind continuous colour, leading into an accent-ground claim or the end card, or smoothing a hard cut into a new scene.

## Avoid when
Shots already on an accent ground, or dense UI that the wash would tint. A soft accent haze behind type reads as glow.

## Original recipe (adapt to Syka native time and nodes)
Place a full-frame layer under the type with background radial-gradient(ellipse 70% 60% at 50% Y, C.accent 0%, transparent 70%). The gradient is soft on its own, so use no blur filter, keep normal blend and keep the saturation low. Animate Y from 110% to 75% on E.out (coverage 0 to 47%). Then swell the ellipse from 70% to 110% and wipe it up (centroid from about 487 to 154 px at 1080p) on E.inOut, changing the foreground underneath on the fastest frame, and finally let it recede to Y -20% on E.outSoft. Short version into a hard cut: a bottom-anchored band of 40% height, linear-gradient(to top, mixColor(C.accent, C.ink, 0.5), transparent), translateY from 100% to 20% on E.in, with the cut landing mid-rise. Use it to preview the accent ground that is coming.

## Original timing
The rise takes 39 f on E.out. The swell and wipe take 12 f on E.inOut (about 28 px/f). The recede takes 90 f on E.outSoft. The pre-cut band takes 16 f on E.in (about +14 luma levels).

Upstream evidence count: 4; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
