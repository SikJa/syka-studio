# Anchored overlay, background swap

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · tr-anchor-overlay-cut
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: transition; energy: medium; role: workhorse; formats: launch, feature, walkthrough, loop, vertical

## Mechanism
A foreground element (a pin, a status pill, a modal, a big word) keeps its exact screen position while the world behind it hard-cuts, so a total change of scene reads as a change of zoom or context.

## Use when
Showing that one thing persists across contexts: a location going from 3D city to map, a request going from an empty void to the full app, a claim held over a run of photos.

## Avoid when
The overlay is text that must be reread after each swap, or the backgrounds are busy and bright enough to swallow it. Keep backgrounds near 5% mean luma under light overlays.

## Original recipe (adapt to Syka native time and nodes)
Render the overlay from one absolute-frame function drawn by every act it crosses (deviceAt in references/transitions.md §4.1). Use the identical transform string on both sides of each cut, so its last frame in one act and its first in the next are consecutive samples of one curve. Each background change is an act boundary; a montage is 2-3 background acts in a row behind the same overlay. The overlay keeps its own clock through the cut (a running scale tween, a 0.5-1 px/f drift or a breath() push), so it is never static for more than 48 f. After the last swap the overlay acts on the new world: it travels into its slot on E.glide over 40 f (moves up to 350 px), or FLIPs into an input.

## Original timing
Background holds of 10-22 f each in a montage (2-3 swaps), or a single swap. Overlay offset across the cut: 0 px ideally, 30 px at most. Overlay drift 0.5-1 px/f. Follow-up move 40 f on E.glide. Cuts on beats or 16ths.

Upstream evidence count: 3; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
