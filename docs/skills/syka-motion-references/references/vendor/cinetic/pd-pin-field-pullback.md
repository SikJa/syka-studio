# Pin field pull-back

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · pd-pin-field-pullback
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: product_demo; energy: medium; role: accent; formats: feature, launch, walkthrough

## Mechanism
A map pulls back from a close view to reveal a field of location pins that drop in as accent marks and relax to ink, then a card grows out of the pin the cursor picks.

## Use when
Location, coverage, store-finder or delivery features; any everywhere claim backed by real places.

## Avoid when
Fewer than about five locations; a map style busy enough to hide the pins; a route arc has already run on the same map.

## Original recipe (adapt to Syka native time and nodes)
Scale the map group with k = lmix(2.2, 1, prog(f, s, s + 50, E.outSoft)) about the focus point. Pop the pins during the pull with SPR.micro (no visible overshoot: a field of pins is not a landing) on scale 0 → 1 and translateY −12 → 0 px, transform-origin at the bottom centre, with offsets from stagger(i, n, 30) so the whole group lands within 30 f; each pin arrives in C.accent and relaxes to C.ink over 24 f (mixColor). The cursor clicks one pin and its card grows from the pin tip (transform-origin at the pin, scale 0.6 → 1 over 12 f on E.out), with a leader line drawing over 8 f and its label sliding 25 px over 12 f on E.out.

## Original timing
Pull 50 f on E.outSoft (first frame ≈ −7% scale per frame); pins ≈ 11 f each on SPR.micro, the group within 30 f (2-6 f apart); colour relax 24 f; card 12 f, leader 8 f, label 12 f.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
