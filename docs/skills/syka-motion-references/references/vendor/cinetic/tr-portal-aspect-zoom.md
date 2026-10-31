# Portal zoom with aspect morph

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · tr-portal-aspect-zoom
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: transition; energy: high; role: signature; formats: launch, feature

## Mechanism
A window opens in the middle of a solid tile. Tile and window grow faster and faster while the square stretches to 16:9, until the window's interior is the next scene and the tile's border has flown off the edges.

## Use when
The film's energy peak and act break, going inside the product, when the mark or app icon is a tile.

## Avoid when
The accent has already flooded the frame once (the tile border is a brief accent flood), or another zoom-through sits in the same act.

## Original recipe (adapt to Syka native time and nodes)
Draw an outer rect in the accent and an inner rect inset by 30% of the outer width and height on each side. The next scene renders inside the inner rect's clip (insetClip) from frame 0, at its final transform. Outer width w = lmix(204, 4800, prog(f, 0, 39, E.linear)), a pure exponential of about ×1.084 per frame, with aspect = mix(1, 16/9, prog(f, 0, 30, E.smooth)) and height = w / aspect. The accent border's outer edges leave the frame near frame 30, and the inner window covers the frame at frame 39, when the clip is dropped. Optional lead-in: the words on either side speed inward under the tile (translateX by their distance over 22 f on E.in, with blurOut). Then the tile turns 90 deg like a cube to bring a plain accent face to the front (CSS 3D box, front = the mark, side = accent at brightness 0.85, over 12 f on E.inOut), and holds that blank face 6 f before the window opens. Keep text out until the window has filled; the next scene's labels rise in as the border clears.

## Original timing
Lead-in: converge 22 f, cube turn 12 f, blank hold 6 f. Portal: 39 f at ×1.084 per frame (border gone by about frame 30, inner window edges ≤ 78 px/f). Aspect 1 → 1.78 over the first 30 f. Next-scene labels start from about frame 30 on a 4-6 f stagger.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
