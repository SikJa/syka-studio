# Impact morph with stretch and floor ripple

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · d3-impact-morph-stretch
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: depth_and_3d; energy: high; role: signature; formats: launch, sting

## Mechanism
Something accelerates into a 3D tile. On contact the tile swaps shape and colour in one frame, stretches tall and settles without rebound while the floor beneath it ripples.

## Use when
Cause and effect is the message: raw input hits the product and becomes something new.

## Avoid when
The film has already spent its two true landings or is calm; never as a generic transition.

## Original recipe (adapt to Syka native time and nodes)
A solid accent dot (or the previous shot's element) accelerates into the tile on E.contact over 12 f, with travel of at most 270 px so the peak stays near 70 px/f; the master's motion blur draws its streak. On the contact frame (decided with fd), swap the tile's shape and fill in one frame (border-radius 22% to 50%, ink2 to accent). Then stretch it along the impact axis, anchored at the contact edge: scaleY = 1 + 0.31*hitPulse(t, 1, 4) and scaleX = 1 - 0.10*hitPulse(t, 1, 4), so it pops taller and settles in about 12 f with no rebound. Redraw the perspective grid floor as SVG paths every frame, displacing each vertex by 6*sin(0.052*r - 0.8*t)*exp(-t/6) px, where r is the vertex's distance from the contact point, only where r < 15*t (the wavefront). Punctuate with a camera punch of 1 + 0.02*hitPulse(t, 2, 6) and the impact sound on the swap frame, with no flash.

## Original timing
Approach 12 f E.contact (at most 270 px); swap in 1 f; height stretch +31% decaying over about 12 f (hitPulse(t, 1, 4)); ripple 6 px, tau 6 f, front at 15 px/f, gone by about f20; punch hitPulse(t, 2, 6) x 0.02.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
