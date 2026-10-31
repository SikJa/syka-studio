# Bento cell takes over the frame

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · lc-bento-cell-takeover
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: layout_and_composition; energy: high; role: signature; formats: loop, launch, feature

## Mechanism
In a flush four-cell grid, one cell grows to fill the whole frame while its siblings are pushed off the edges, still playing as they go, turning a breadth overview into one focused shot without a cut.

## Use when
A loop or launch that opens on four-up breadth and then dives into one feature; returning to the overview between features.

## Avoid when
A chosen cell whose scene was not composed for full frame (it will look sparse), or more than twice per film.

## Original recipe (adapt to Syka native time and nodes)
Build a flush 2x2 grid as in oh-live-grid-cold-open: gap 0, cells exactly W/2 x H/2 on whole pixels, overflow hidden and C.ink in every cell so the seams vanish, with every cell's scene rendered at full 1920x1080 inside a wrapper with scale(0.5) and transformOrigin '0 0'. Scale the whole grid container from 1 to 2 with lmix on prog(f, a, a + 64, E.smooth), about the chosen cell's outer corner (transformOrigin '0 0' for the top-left cell, '100% 100%' for the bottom-right). That corner stays fixed, the chosen cell lands exactly on the frame at native resolution, and the other cells slide out of frame. Keep every cell's loop running through the move and apply motion blur while the far edge exceeds 12 px/f; on landing, drop the grid and continue the cell's scene as a normal shot.

## Original timing
64 f on E.smooth; content at the far frame edge peaks around 60 px/f (the far corner about 68 px/f), with motion blur. Cells keep playing throughout. Follow with at least 90 f of the full-frame scene. To return to the overview, run it in reverse (scale 2 to 1, 64 f, E.smooth).

Upstream evidence count: 0; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
