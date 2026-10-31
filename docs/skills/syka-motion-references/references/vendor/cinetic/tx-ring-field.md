# Intersecting ring field

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · tx-ring-field
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: texture_and_finish; energy: medium; role: signature; formats: launch, loop, sting

## Mechanism
Above and below a centred band of type, families of huge overlapping ellipse outlines rotate slowly in opposite directions and whip on every copy swap, giving the words an ownable abstract environment.

## Use when
Type-led launch cards or a statement sequence on a dark stage that needs a signature environment and a motivated way to change copy without cuts.

## Avoid when
UI demos, where it competes with the product; light stages, where 2 px rings vanish; more than ~4 s of pure ambience.

## Original recipe (adapt to Syka native time and nodes)
One full-frame SVG holds two groups of 6-8 ellipses (rx about 47% of frame width, ry about 32% of frame height, centred just above and just below the text band), each a crisp 2 px stroke in one hue whose opacity steps from 0.6 on the outer ring to 0.15 nearest the band. Rotate the groups in opposite directions, angle = +-(0.2 x f + 14 x the sum over swap cues s_k of prog(f, s_k, s_k + 12, E.smooth)), so each copy swap adds a 14-degree whip, and swap the text hard on each whip's peak frame (s_k + 6) so the motion masks the change. The text stays static at the band's centre; the rings' fastest edges (~50 px/f at the whip peak) get the blur pass.

## Original timing
Drift 0.2 degrees/f between swaps; whip +12-16 degrees over 12 f on E.smooth (peak ~3 degrees/f, ~50 px/f at the outer rim); copy swaps every 60-120 f on the whip's peak frame.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
