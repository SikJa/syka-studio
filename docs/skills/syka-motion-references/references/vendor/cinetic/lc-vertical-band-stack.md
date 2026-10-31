# Vertical clear-band stack

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · lc-vertical-band-stack
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: layout_and_composition; energy: any; role: workhorse; formats: vertical

## Mechanism
In a 9:16 frame, the caption and the subject stack vertically inside the band the feed leaves clear, with their combined mass centred on that band rather than on the frame, and nothing important under the bottom caption zone or the right action rail.

## Use when
Any vertical cut-down or vertical-first film for feeds.

## Avoid when
16:9 masters (use a side-by-side composition there), or full-bleed moments where one giant word fills the screen anyway.

## Original recipe (adapt to Syka native time and nodes)
Get the band from safeBox('feed9x16', W, H): 896 x 1230 px at 1080x1920, centred near y = 885. Stack inside it: the caption on top (fitSize to the band width, at most two lines), a 48 px gap, then the subject below (a UI card at 0.86 of the band width, or a phone screen cropped to its key region), with the stack's combined height centred on the band's cy. Moves are vertical: the subject rises 120 px into place through arrive(prog(f, a, a + 40, E.glide)), the caption reveals with Words 8 f later, and scene changes flow upward (the old stack exits up on E.in over 16 f while the new one rises from below). Never place things side by side, and check every frame with the layout audit so nothing crosses the feed zones.

## Original timing
Subject rises 120 px over 40 f on E.glide; caption Words (stagger 8 f, dur 26 f) start 8 f after the subject; exits 16 f on E.in; hold 60-90 f per stack.

Upstream evidence count: 0; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
