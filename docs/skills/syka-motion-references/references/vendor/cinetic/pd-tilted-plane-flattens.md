# Tilted product plane flattens

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · pd-tilted-plane-flattens
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: product_demo; energy: medium; role: signature; formats: launch, feature, walkthrough

## Mechanism
A real product page lies tipped back in perspective, rises toward the camera and rotates flat to face the viewer, landing the product as a frontal screen.

## Use when
Introducing a real web page or app screen as the real thing while keeping the camera alive; the first frontal look at the product.

## Avoid when
The UI must be read during the move; the plane would need more than about 30° of tilt (text shears and aliases); the same flatten ran within the last 10 s.

## Original recipe (adapt to Syka native time and nodes)
Give the page's parent perspective 1800-2000 px; on the page set transform-origin 50% 100% and tween translateY 270 → −60 px, rotateX 25° → 8° and scale 1 → 1.3 over 68 f on E.out, then drift linearly at about 3.5 px/f and leave on E.in. Resolve the last 8° → 0 as follow-through on its own E.out over 20 f, starting 6 f before the translate lands, so position and tilt settle at different moments. Hero version: hold the plane tilted for up to 34 f with progressive depth of field (4-6 horizontal bands, each a RackFocus at 0/2/4/6/8 px by distance from the focal row), then rotate rotateX and rotateZ to 0 over 80 f on E.glide while every band racks to sharp as the rotation reaches zero. Edge the page with a 1.5 px solid C.line hairline rather than a lit rim; an in-page headline may build with src/fx/Words.tsx while the plane still moves, but nothing is meant to be read until it lands.

## Original timing
Rise 68 f on E.out: top edge ≈ 35 px/f on the first frame, ≈ 12 px/f by f4, ≈ 5.5 px/f by f8, then ≈ 3.5 px/f drift and an exit at ≈ 5.5 px/f on E.in; tilt follow-through 20 f, starting 6 f before the position lands; hero de-skew: hold ≤ 34 f, then 80 f on E.glide (peak edge speed ≈ 60-70 px/f at about 31%).

Upstream evidence count: 3; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
