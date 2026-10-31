# Product on a thick extruded slab

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · d3-extruded-slab-orbit
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: depth_and_3d; energy: medium; role: workhorse; formats: launch, walkthrough, feature

## Mechanism
The live interface sits on the front of a thick matte slab with rounded corners. When the camera orbits or yaws, the slab's solid edge appears, which turns a screen into an object and makes every angle readable.

## Use when
A single-take product walkthrough or a feature film where the camera travels across one interface.

## Avoid when
The film is flat 2D throughout, or the camera never yaws (the edge never shows and the build is wasted).

## Original recipe (adapt to Syka native time and nodes)
Build the slab behind the live UI face: thickness d = 0.045 x slab height, made of 16-24 stacked rounded-rect slices (same border-radius as the face) at translateZ(-i*d/N) in a flat near-black side tone. The slice just behind the face gets a 1.5 px lighter top edge; render the slices in DOM order back to front under preserve-3d, with no reflections. Move the anchor camera (a Shot with yaw and pitch, perspective 2200), not the slab. Hero push: 1 to 2.56x in log space with yaw 0 to 30 deg and pitch 5 deg on E.smooth over 60 f, landing the target panel in the right third so a void opens for the caption. Cursor-led whip: yaw +/-30 deg, roll at most 11 deg and zoom x0.77 on E.whip over 74 f, with the cursor leading by 4-6 f. After each move the camera stops and the caption, cursor and UI micro-interactions carry the hold (add breath() if nothing moves within 48 f). Lay the UI out at shot scale with CSS zoom and camera scale3d(k/Z, k/Z, 1/Z), switching Z only on a velocity-peak frame.

## Original timing
Slab depth 4-5% of its height; the edge reads from 20 deg of yaw and clearly at 30-35 deg. Hero push 60 f E.smooth (peak about 47 px/f mid-move); whip orbit 74 f E.whip, roll at most 11 deg; the caption builds while the camera decelerates.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
