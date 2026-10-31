# 3D flip that swaps state

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · d3-flip-face-swap
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: depth_and_3d; energy: medium; role: workhorse; formats: any

## Mechanism
An icon or card turns over in 3D and comes back around changed (outline to solid, grey to full colour), then shrinks and travels to its next place.

## Use when
A state change (activated, connected, colourised) needs a physical cause, especially as the film's only 3D turn.

## Avoid when
Several flips have already happened, or the cards carry heavy text (it goes mirrored and soft mid-turn).

## Original recipe (adapt to Syka native time and nodes)
Give the wrapper a perspective about 3.5x the object's width (about 1000 px for a 280 px icon; UI-scale planes stay at 1800-2600 px). Stack two faces with backface-visibility: hidden, the back one pre-rotated rotateY(180deg), or keep one face and swap its source when |angle| > 90 deg, mirrored with scaleX(-1) and decided with fd(frame). Turn rotateY 0 to 180 on E.inOut over 10 f with brightness 0.7 + 0.3*|cos(theta)| so the edge-on frames darken, and put a strong transient on the edge-on frame, where the face swaps. Chain on E.rest, overlapping 4 f: scale 1 to 0.38 and translateX 290 px on E.whip over 16 f into the slot. For a deck of logo cards, flip each in 6 f, 6 f apart (the whole group inside 30 f), then move each into its grid slot (scale about 0.25, rotateZ to 0) on E.glide over 12 f, with its label arriving with blurIn 6 px over 8 f.

## Original timing
Hero flip 10 f E.inOut, swap on the edge-on frame (about f5); shrink x0.38 plus 290 px over 16 f E.whip (peak about 62 px/f). Deck: 6 f flips, 6 f apart, slot move 12 f E.glide, labels 8 f.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
