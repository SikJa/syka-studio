# Extrude then crash in

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · cam-crash-zoom-through
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: camera; energy: high; role: accent; formats: launch, sting

## Mechanism
An object grows toward camera (a disc extruding into a tall cylinder) and the camera slams into it, hard-cutting to its interior while still rushing forward.

## Use when
A violent spatial jump into the product at the energy peak of a launch film or sting.

## Avoid when
Calm films, any second use in the same film, and readable text on either side of the cut.

## Original recipe (adapt to Syka native time and nodes)
Extrude first: the object's scaleY goes 1 -> 2.5 over 12 f on E.in, with transform-origin at its base, so it accelerates toward camera. Overlapping the last 8 f of the extrusion, push the anchor camera into its face with k = k0 * Math.exp(0.64 * ((f - s) / 24) ** 3) over 24 f, then hard-cut on the last frame to the interior shot. Open the interior already moving: k starts at 1.76x its rest value and lmix-decays over 40 f on E.outSoft, while the tube walls converge on a vanishing point. Draw the walls as two or three flat, crisp-edged steps of the object's own colour (darker at the rim, lighter toward the vanishing point), with no bloom, halo or bright blurred edges. Render with --blur so the frames either side of the cut streak; spreading the crash across the cut keeps the frame edge under about 80 px/f.

## Original timing
Extrusion 12 f on E.in. Camera push 24 f on a cubic ease-in, x1.9, reaching about 8%/f (about 77 px/f at the frame edge) on the cut frame. Interior entry x1.76 -> rest over 40 f on E.outSoft.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
