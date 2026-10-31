# Device rises already moving

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · pd-device-rise-on-cut
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: product_demo; energy: medium; role: workhorse; formats: launch, feature, walkthrough, vertical

## Mechanism
A phone or app window enters from below already travelling on the cut frame and decelerates into place near centre while the whole shot slowly scales down.

## Use when
The first product shot after a type card or a photo, when the previous shot's energy should carry straight into the product.

## Avoid when
The device is already on screen; a calm film where a 20 px/f arrival feels pushy; it would be the third rise in a row (vary with a tilt or a pull-back).

## Original recipe (adapt to Syka native time and nodes)
Drive the device group's translateY = tw(f, cut − 1, cut + 43, rise, 0, E.out) with rise 140-160 px, so it already moves about 20 px/f on the cut frame (prog is 0 on its first frame, hence cut − 1); no fade-in, since the cut hides the start, and the shadow travels with the device. Under it, scale the whole shot 1 → 0.9 over 48 f on E.outSoft; a desaturated photo backdrop (grayscale(1) contrast(1.1) brightness(0.7)) keeps the device the only colour. When the device must push a title off screen without a cut, rise it from a full frame height below over 48 f on E.glide (peak ≈ 59 px/f at 31%, motion blur on), fade the title on E.smooth starting 16 f before the device moves, and keep the device above the title in z. For anticipation, peek first: 170 px in 14 f on E.out, hover 4 f, then launch the rest on E.whip over 40 f (peak under 70 px/f) and drift the scale 1 → 0.93 over 60 f.

## Original timing
On a cut: 140-160 px over 44 f on E.out, first frame ≈ 6.2 × rise / 44 (about 20-23 px/f), 75% of the travel by f9, settled by f44; shot scale 1 → 0.9 over 48 f on E.outSoft. Over a title: ≈ 1,000 px in 48 f on E.glide, title fade 36 f starting 16 f early. Peek variant: 14 f peek, 4 f hover, 40 f launch on E.whip, 60 f scale drift.

Upstream evidence count: 4; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
