# Icon lifts out of its row into a 3D hero

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · d3-icon-lift-to-hero
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: depth_and_3d; energy: medium; role: signature; formats: launch, feature, walkthrough

## Mechanism
A small icon tile peels out of a settings row and inverts from dark to light. It flies to frame centre growing almost 2x, tilted in 3D and slowly turning as it floats into the next chapter.

## Use when
A tiny detail (an integration, a setting, a source) should become the hero of the next section, bridging two chapters.

## Avoid when
The icon has no follow-up role, or another element already did a lift-to-centre in this film.

## Original recipe (adapt to Syka native time and nodes)
On frame c, duplicate the chosen tile into a top layer at its exact row rect with the same placement transform, so the swap is pixel-identical, and hide the original. Rack the rest of the UI soft with RackFocus (blur 12 px) as it dims to 40%. Fly the tile to centre on E.whip over 24-30 f (travel at most 560 px so the peak stays under 70 px/f). On the way it tilts to rotateX 15, rotateY 20 and rotateZ -4 deg (perspective about 3.5x its width, radius 22%) and inverts its colours over 18 f on E.smooth (tile C.ink2 to C.white, glyph C.white to C.ink). As the travel lands, grow it from 0.53 to 1.0 (x1.9) on E.out over 27 f, then float for 45 f with linear drifts of rotateY +4 deg and rotateZ -1.5 deg, grounded by a lift shadow at z of about 150 (motion-tokens section 7). It then becomes the anchor of the next chapter or exits shrinking x0.43 over 12 f on E.in.

## Original timing
Travel 24-30 f E.whip; colour inversion 18 f E.smooth; grow x1.9 over 27 f E.out (fastest growth about 3 f in); float 45 f E.linear (rotateY +4 deg, rotateZ -1.5 deg); exit x0.43 over 12 f E.in.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
