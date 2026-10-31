# Edge-on sliver snaps face-on

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · d3-coin-edge-to-face
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: depth_and_3d; energy: medium; role: accent; formats: launch, sting, feature, loop

## Mechanism
A thin edge-on sliver snaps open into a full face-on coin or badge. Most of the turn happens in the first frame, then it eases into place as its face catches the light.

## Use when
Revealing a token, coin, badge or mark decisively, or turning a physical object into the logo at the close.

## Avoid when
Flat UI icons without thickness (the edge-on frame becomes an invisible line), or the film already has several flips.

## Original recipe (adapt to Syka native time and nodes)
Build the disc as a face plus a 24 px edge made of 12 stacked disc slices at translateZ steps of 2 px in a darker tone, under preserve-3d, with a perspective about 4x the diameter. Hold it edge-on (rotateY 90 deg) for 4 f, then turn rotateY 90 to 0 on E.out over 10 f (E.out lands about 37% of the turn in the first frame, and the master blur smears it). For a calmer reveal, turn over 22 f to a 10 deg three-quarter rest while it rises 20% of the frame height on E.outSoft. Tie the face brightness to the angle, brightness = 0.75 + 0.25*cos(theta - 20 deg), so it brightens as it turns into the key light (a tonal sheen, no bloom). For a logo reveal at the close, hard-cut on the frame after it settles to the flat logotype, with its mark at exactly the emblem's screen position and size.

## Original timing
Edge hold 4 f. Snap 10 f E.out: frames 1-9 reach about 37, 48, 56, 61, 68, 77, 88, 94 and 100% of the turn. Calm form: 22 f E.outSoft to 10 deg with a 0.2H rise. Match cut on the first settled frame.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
