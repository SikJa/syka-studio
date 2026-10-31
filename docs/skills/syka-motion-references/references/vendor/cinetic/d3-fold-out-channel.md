# Folded channel that unfolds flat

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · d3-fold-out-channel
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: depth_and_3d; energy: medium; role: accent; formats: launch, feature

## Mechanism
A wide card starts bent into a U-shaped channel with its side walls folded toward camera. It flattens open while the cards stacked inside fan out into a neat row, then the whole thing tips away.

## Use when
Revealing a list, a set of plans or a stack of items as a tangible moment, not a flat fade-up.

## Avoid when
The same act already uses a vertical-hinge yaw, or the contents are dense text that must be read during the unfold.

## Original recipe (adapt to Syka native time and nodes)
Build three panels in a preserve-3d node under perspective(2000px): a front panel, plus left and right walls hinged on its edges (transform-origin at the shared edge) at rotateY(+/-60deg) toward camera. Unfold on E.out over 24 f: the walls go rotateY +/-60 to 0 and the front scale 1.15 to 1, so the channel's outer width goes from about 1890 to 1650 px. Shade each wall with a single-hue black overlay of opacity 0.35*sin(angle) and edge it with a solid 2 px rim one tone lighter than the panel. Inside, 4-5 cards stacked at -70% of a card width and rotated +/-6 deg slide to their row slots and square up on E.out over 20 f with a 2 f stagger, painted in z order. Exit: the whole card rotates rotateX 0 to 35 deg about its bottom edge and drops translateY +80 px on E.in over 16 f, receding to about 74% of its width.

## Original timing
Unfold 24 f E.out; inner cards 20 f E.out, 2 f apart; live hold 30-48 f with breath +2%; tilt-away 16 f E.in (width 1650 to 1225 px).

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
