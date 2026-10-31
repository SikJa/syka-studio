# Push-aside with bound layout

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ui-push-aside-reflow
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: ui_choreography; energy: medium; role: workhorse; formats: launch, feature, walkthrough

## Mechanism
An incoming panel or card enters from the edge and the neighbouring content moves aside because it is bound to the panel's edge, so one motion moves two elements and nothing overlaps.

## Use when
Introducing a detail panel, a new card or a caption beside existing UI, or a joke where the layout itself does the gag.

## Avoid when
The incoming element should float above (modal, popover), or there is no room to move into.

## Original recipe (adapt to Syka native time and nodes)
Bind instead of tweening twice: each frame set neighbour.x = min(restX, panel.left - gap), so the neighbour reflows from the panel's own position. Shove: a dark card (C.ink2, radius 24 px, about 62% of frame width) enters from beyond the right edge over 72 f on E.whip (peak about 72 px/f at 40% under the motion-blur pass) and is placed so it reaches the headline word only after 58% of its move, where the card has slowed to 20 px/f or less, so the shoved word stays readable. Make room: a side panel 36% of frame width slides in on E.glide over 54 f (peak about 38 px/f) while the content card moves 0.43x the panel's travel on E.smooth, starting 28 f before the panel so it anticipates the arrival; the exit mirrors both over about 50 f. For copy, the product card glides 370 px aside and scales 1 to 0.83 on E.glide over 48 f (peak about 23 px/f) while the headline rises line by line into the freed side (Words, 6 f stagger), starting 4-6 f after the slide.

## Original timing
Shove: 72 f (E.whip), contact after 58% of the move, word <= 20 px/f. Side panel: 36% FW over 54 f (E.glide); neighbour 0.43x travel with a 28 f lead (E.smooth); exit ~50 f. Copy: 370 px + scale 0.83 over 48 f (E.glide); lines 6 f apart from +4-6 f.

Upstream evidence count: 3; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
