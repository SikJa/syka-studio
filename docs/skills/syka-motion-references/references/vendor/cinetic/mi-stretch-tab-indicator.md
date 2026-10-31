# Stretchy tab indicator

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · mi-stretch-tab-indicator
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: micro_interaction; energy: medium; role: signature; formats: feature, walkthrough, loop, vertical

## Mechanism
The selected pill of a segmented control shoots to the new option with its leading edge arriving first, stretches to about 1.9x its width mid-travel, then hugs the new label as the label takes the active colour.

## Use when
A tab, filter or toggle switch causes the next state (the chart changes, the list swaps) and deserves weight.

## Avoid when
The control has more than about five options in a tight row (the stretch overlaps its neighbours), or the indicator would only read with refraction or a frosted backdrop behind it.

## Original recipe (adapt to Syka native time and nodes)
Animate the indicator's leading and trailing edges as two tweens on the same E.glide: the leading edge reaches the target edge in 12 f and the trailing edge in 20 f. Width = right - left therefore swells to about 1.9x near frame 6 and relaxes into the target width. Keep the height fixed, the radius at height / 2 and the fill flat. Mix the new label from C.mute to the active colour over the last 8 f, and the old label back over the first 8 f. Step the new label's weight from 500 to 600 on the landing frame with fd. Calm variant: fade the fill to a 1.5 px outline ring over the first 6 f. Swell the ring to 1.35x by 30% of the travel and shrink it onto the target by 100%, over 48 f E.smooth, then snap the solid fill back over 4 f on landing. Put a tick on the landing frame.

## Original timing
Leading edge 12 f, trailing edge 20 f, both E.glide, for hops up to about 250 px. For longer hops keep the 0.6 ratio and lengthen both so the leading edge stays under about 65 px/f (a 420 px hop takes 18 f / 30 f). Label colour 8 f. Calm variant: 48 f E.smooth, 6 f fill fade, 4 f snap.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
