# Off-frame whip relay

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · cam-offframe-whip-relay
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: camera; energy: high; role: signature; formats: walkthrough, feature, launch

## Mechanism
The cursor accelerates up and out of frame, the camera whips down the product while it's hidden, and the cursor re-enters from the top as a fast streak that brakes onto its target.

## Use when
A big spatial jump within one product (top bar to bottom bar, one page to another) that should feel like a match-on-action without a cut.

## Avoid when
Films without a cursor, or destinations less than about one frame height away (a plain reframe is enough).

## Original recipe (adapt to Syka native time and nodes)
Three overlapping keyed parts. Cursor exit: y on E.in toward -10% of the frame height from a to a + 24, after which it stays off screen for 12 f. Camera: sy travels the product distance D (900-1400 px) on E.smooth over N = 2.86 x D / 75 frames (34-54 f), centred on a + 30 so its fastest stretch falls inside the hidden window and peaks at about 75 px/f. Cursor entry: from -10% to the target over 36 f from a + 36 on E.out, entering at about 63 px/f; while it moves faster than 12 px/f, draw a trailing rounded capsule behind the tip, 0.6 x speed long at 40% opacity, and let the blur pass handle the camera.

## Original timing
Cursor exit 24 f on E.in (2.5 -> 15 px/f). Off screen 12 f. Camera 34-54 f on E.smooth centred on the hidden window, peak 60-75 px/f. Cursor re-enters at about 63 px/f and brakes over 36 f on E.out (speed ratio about 0.92 per frame).

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
