# Hard swap on the cause frame

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · pd-hard-swap-on-cause
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: product_demo; energy: medium; role: workhorse; formats: any

## Mechanism
On a click or selection the product image, view or value changes in one frame with no crossfade, any price or count rolls up from just below its new value, and a physical card can hide the swap in a small 3D kick.

## Use when
A choice changes the product instantly: a variant picker, filter, plan selector, theme switch, a canvas that appears whole on launch.

## Avoid when
The change is a process the viewer should watch; two numbers would sit half-and-half in place; swaps faster than one per 30 f (the clicks read as a macro).

## Original recipe (adapt to Syka native time and nodes)
Export the cause frame once (the press of pressAt from src/fx/Cursor.tsx after a hover state shown 6 f earlier, or a selection marker's landing) and switch state on fd(f) >= CAUSE so every motion-blur sub-sample agrees; never crossfade the two states. Re-count numbers with Roll fed countSteps(next − delta, next, CAUSE, 40, E.out), delta about 5-10% of the value, so the digits roll instead of cutting. Punch the swapped object with scale 1 + 0.02 · hitPulse(f − CAUSE, 2, 5). For a print or card beside a list, kick it: perspective 900 px, transform-origin on its left edge, rotateY = 12° · hitPulse(f − CAUSE + 1, 1, 2.5) with skewY 2° on the same envelope and a soft shadow (0 18px 40px rgba(0,0,0,.18)), while the list's selection marker moves 6 f before the swap.

## Original timing
Swap 1 f on the cause frame; hover 6 f before the press; recount 36-46 f on E.out with 14 f digit rolls; punch attack 2 f, tau 5; kick peaks on the swap frame and settles in 6-8 f; at most one swap per 30 f, 54 f apart in a repeating sequence.

Upstream evidence count: 3; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
