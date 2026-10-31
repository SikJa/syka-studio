# Mark docks into the app

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · pd-mark-docks-into-app
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: product_demo; energy: medium; role: accent; formats: launch, feature, sting

## Mechanism
An integration mark or icon travels to an app tile or page and settles overlapping its face, rising in front of it at the moment of contact, so it reads as plugging in.

## Use when
An integration, plug-in or works-inside claim; handing off from a settings screen into the platform it acts on.

## Avoid when
The mark would pass over text being read; the mark is also the end lockup (it would appear early, so dock an integration icon instead).

## Original recipe (adapt to Syka native time and nodes)
Move the mark toward the tile centre minus a small offset (15-20% of the tile) over 25 f on E.outSoft so it decelerates into contact; at overlap (frame 17 of the approach) raise its z-index and translateZ above the tile, and let it come to rest on frame 25. On contact the tile answers with scale 1 + 0.02 · hitPulse(f − contact, 2, 3); the tile is a matte solid with a 1.5 px C.line edge and a soft neutral shadow. Shared-element variant: lift a small icon out of its row (scale 0.53 → 1 over 27 f on E.out while its tile inverts light/dark over 18 f), float it 45 f with a linear rotateZ 1.5° and rotateY 4° drift, then shrink it over 12 f on E.inOut into the logo slot of a page that swings in from the bottom right (perspective 1000 px, rotateX 55° → 40°, rotateZ −30° → −22° over 50 f on E.out). Position the icon through the page's own transform and, on the frame it reaches the slot, replace it with the page's own logo in one frame (decided with fd, identical transform) instead of crossfading the two copies.

## Original timing
Approach 25 f on E.outSoft, overlap at f17, rest at f25; tile bump 2% (attack 2 f, tau 3, about 8 f). Variant: lift 27 f, colour invert 18 f, float 45 f, shrink 12 f on E.inOut, page swing 50 f on E.out, one-frame swap to the page logo on arrival.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
