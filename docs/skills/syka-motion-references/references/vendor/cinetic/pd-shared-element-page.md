# Shared element survives the page change

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · pd-shared-element-page
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: product_demo; energy: medium; role: signature; formats: walkthrough, feature, launch

## Mechanism
The cursor clicks a row; the page drains away except the row's icon (or the clicked card), which stays exactly in place while the next page assembles around it with a short zoom-out.

## Use when
Navigating into a detail view, or carrying a piece of content between apps, where spatial continuity should make the product feel instant.

## Avoid when
Nothing exists in both states; the anchor is under about 40 px and cannot carry attention; it would need to travel more than a third of the frame (use a native transition).

## Original recipe (adapt to Syka native time and nodes)
Duplicate the anchor (a row's icon, a card or a modal) into a top overlay at its exact screen rect. On the press frame fade page A to its background colour over 6 f on E.smooth and hold the lone anchor 2-4 f. Then mount page B at scale 1.2 about the anchor and settle it with lmix over 24 f on E.out, while the overlay interpolates from A's rect to B's (both computed from layout data, so FLIP by construction) and B's blocks fade in 2 f apart over 10 f. Cross-app variant: keep one card container mounted, take child A out through RackFocus to 8 px with opacity over 36 f, resize the card to the new aspect over 20 f on E.out, and bring child B in from 8 px over 24 f. Cut variant: keep the anchor fixed on a top layer while only the background layer switches on the cut frame, then drag the anchor into its new slot over 40 f on E.whip.

## Original timing
Hover 12 f, press (pressAt), page A out 6 f, anchor alone 2-4 f, page B 1.2 → 1 over 24 f on E.out (≤ 50 px/f at 960 px from the anchor), block stagger 2 f over 10 f: about 48 f from click to settled. Cross-app: 36 f out, 20 f resize, 24 f in. Cut variant: anchor drag 40 f on E.whip.

Upstream evidence count: 3; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
