# Accent icon cools to its neutral mark

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · le-hot-to-neutral-cool
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: logo_and_end_card; energy: medium; role: accent; formats: launch, feature, sting, vertical

## Mechanism
The app icon pops up from tiny in the film's hot accent, cools through darker tones to its neutral final colours, lifts a little to make room, and the name fades in beneath it.

## Use when
Films whose accent stood for heat, urgency or the problem early on and should cool into the product. App-icon lockups.

## Avoid when
The accent already means something else in the film (one accent, one meaning). Icons whose final colour is the accent itself.

## Original recipe (adapt to Syka native time and nodes)
Pop the icon from tiny with scale mix(0.19, 1, prog(f, a, a+38, E.out)), its tile filled C.accent. Cool it as one object, never as two crossfaded copies: tile fill mixColor(C.accent, C.ink, p) and glyph mixColor(C.ink, C.white, p), with p = prog(f, a+6, a+34, E.smooth). OKLab mixing passes through darker shades of the same hue instead of muddy grey. Then lift it to make room: translateY 0 -> -102 px and scale 1 -> 0.945 over 36 f on E.smooth. As the lift passes 60%, fade the label up under it: opacity 0 -> 1 and translateY 8 -> 0 through arrive, over 15 f.

## Original timing
Pop: 38 f on E.out (0.19 -> 0.72 by f6). Colour: 28 f (f6-34) on E.smooth. Lift: 36 f on E.smooth. Label: 15 f. Then hold 90-120 f under a push.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
