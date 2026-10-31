# Mark turns through a key light

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · le-mark-glint-turn
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: logo_and_end_card; energy: calm; role: accent; formats: launch, sting, feature

## Mechanism
The mark (an extruded glyph, a coin or a tile) turns a few degrees in 3D, and its face passes through a light, so a single specular sweep crosses it as it settles face-on.

## Use when
Premium, material or physical brands (finance, hardware, collectibles). 3D marks. A mark that needs one moment of life early in its hold.

## Avoid when
Flat, playful or line marks (a sheen on a stroke looks like a template effect). Films with no other 3D. A second glint anywhere in the film (it reads as a preset).

## Original recipe (adapt to Syka native time and nodes)
Give the mark depth with CSS 3D: perspective 1200 px on the parent, the front face plus 6-10 copies stacked 1 px apart in z in a darker tonal step for the extrusion (or a mesh in Three.js). Rotate it rotateY tw(f, a, a+40, -35, 0, E.outSoft) with a small rotateX 20 -> 0 so it settles face-on. Sweep the light in 2D: a white band 30% of the mark's width, with opacity 0 -> 0.9 -> 0 across its width, masked to the mark (mask-image of the mark SVG) with mix-blend-mode screen, translated across the face over 14 f. Time it so the band's centre crosses as the rotation passes ~70%.

## Original timing
Turn: 40 f on E.outSoft (~4 deg/f peak for 35 deg). Glint: 14 f on E.smooth, starting ~f20. One glint per film.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
