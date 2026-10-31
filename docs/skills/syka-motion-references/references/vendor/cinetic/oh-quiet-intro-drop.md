# Sparse intro, drop on the first hard cut

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · oh-quiet-intro-drop
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: opening_hook; energy: any; role: workhorse; formats: launch, feature, walkthrough, vertical

## Mechanism
(Sound and picture.) The first ~2 s carry only light plucks or a filtered, wide pad under the opening type; the low end and the kick land exactly on the frame where the punchline card or first product shot cuts in.

## Use when
Almost any film that opens on type and then shows the product with a tension-and-release shape.

## Avoid when
Stings under 4 s, openers designed to be loud from frame 0 (live grid, macro scramble), or a drop that cannot land on a whole-frame cut.

## Original recipe (adapt to Syka native time and nodes)
Arrange or edit the track so bar 1 has no sub and no kick and sits about 14 dB under the body, sounding at intent from frame 0 with no fade-in across the first bar: a steady filtered bed of plucks or pad, which may step up a few dB at the half-bar. Keep it wide (side about 3 dB under mid) and narrow it on the drop (side 16-19 dB under mid). Put the first hard cut on a downbeat, for example b(2) in src/timeline.ts (frame 120 at 120 BPM). Schedule the kick on that exact frame in src/sync.ts and the first sub swell 8-12 f before it. Keep the intro picture to one line or two short cards (2 words each at most) so reading fits the space; per-word ticks ride on top at a constant level.

## Original timing
Intro 117-156 f (1.95-2.6 s); about +14 dB from intro to body; sub 8-12 f before the cut; kick on the cut frame (within 1 f).

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
