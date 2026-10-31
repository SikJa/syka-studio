# Pull out from inside the object

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · cam-inside-object-pullout
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: camera; energy: medium; role: signature; formats: launch, sting, feature, vertical

## Mechanism
The shot opens on what reads as a full-bleed colour field or a statement card, and one long pull reveals it was the face of a small object (an app icon, a card, a screen, the mark) sitting among its neighbours.

## Use when
Cold opens and hooks where a calm statement or a colour field should turn out to be part of the product (the question was printed on the app icon, the colour was one card in the grid); landing the mark into the final lockup; any reveal whose point is scale.

## Avoid when
The face is a photo or bitmap (it falls apart at 8-14x), the context it lands in is not recognisable at a glance, or a scale-through cut or detail-first pull-back has already used the same object. Once per film.

## Original recipe (adapt to Syka native time and nodes)
Lay the object out at true size inside its real context (a dock, a grid, a window, the lockup) in the anchor camera's world, with its face, corner radius and shadow as live layout in world units, never a bitmap. Shot FACE puts ax, ay on the object's centre at frame centre with k0 = 1.04 x max(W / objectW, H / objectH), so its edges sit just outside the frame (about 13.3 for a 144 px icon at 1920 wide), and Shot CONTEXT frames the object at k = 1 in its slot. Blend cam = lc(FACE, CONTEXT, prog(f, a, a + N, E.dolly)) with N = 25.7 x ln(k0); this caps the log zoom rate at about 6%/f mid-move, so anything entering at the frame corner moves under about 66 px/f, and the corners, the shadow and the neighbours arrive purely by coverage, with no fades of their own. Draw the opening copy on a screen-space overlay at toScreen(cam, centre), scaled by (cam.k / k0) ** 0.46 so it shrinks more slowly than the object, and fade it out on E.smooth while the object's on-screen width falls from 1.3x to 1.0x the copy's width, so it never spills past the edges. Read the face under a cam-living-hold creep before the pull, land with no overshoot, and start the next beat (an icon hop, a wordmark build) within 12 f of the settle.

## Original timing
Face hold 24-48 f for the read, with a 0.04-0.07%/f creep. Pull from k0 = 8-14 to 1 over N = 25.7 x ln(k0) frames on E.dolly (about 53 f from 8x, 66 f from 13.3x), log rate peaking near 6%/f mid-move and landing at rest. Copy scale tracks k ** 0.46 and fades over the 8-14 f in which the object's width passes 1.3x -> 1.0x the copy width. Anchor travel to the slot under 10 px/f. --blur for frames above 12 px/f.

Upstream evidence count: 4; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
