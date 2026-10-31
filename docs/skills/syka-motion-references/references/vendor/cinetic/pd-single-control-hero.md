# One native control as the demo

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · pd-single-control-hero
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: product_demo; energy: calm; role: workhorse; formats: feature, launch, vertical, loop

## Mechanism
Instead of a screenshot, the feature is shown as the single control that embodies it (a picker wheel, a toggle, a segmented switch) at large scale, centred, with no chrome, doing only its native interaction.

## Use when
A settings, targeting or compatibility claim in a type-led film, where one interaction says it is a real product faster than a full UI.

## Avoid when
The feature needs context to make sense; the control is generic (every app has a toggle) and says nothing about the claim.

## Original recipe (adapt to Syka native time and nodes)
Build only that control at 3-5x its native size, centred on an empty stage with no app chrome. For a picker, scroll the column with inertia(f, s, 20, 0.975) from src/lib/anim.ts (≈ 790 px, tau ≈ 40 f, starting at the 20 px/f readable-text limit) and style each item from its distance d to the centre line: scale 1.2 − 0.35 · min(d / 375, 1), colour mixColor(C.ink, C.mute, min(d / 375, 1)), opacity 1 → 0.35 on the same ratio. Either cut while it still drifts, or click the chosen item home with SPR.detent. Toggles and segmented controls keep their real geometry (knob 8 f on E.ui, the selected pill gliding between labels on E.glide).

## Original timing
Shot ≈ 120 f; picker v0 20 px/f, decay 0.975 per frame, an item crossing focus about every 30 f early on and slowing after; detent settle ≈ 12 f; toggle knob 8 f; segment glide 18-24 f.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
