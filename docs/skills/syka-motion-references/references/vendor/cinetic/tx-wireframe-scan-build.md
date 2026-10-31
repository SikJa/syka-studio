# Wireframe-to-product scan

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · tx-wireframe-scan-build
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: texture_and_finish; energy: medium; role: signature; formats: launch, feature

## Mechanism
A thin accent line sweeps across a UI card: ahead of it the card is still a wireframe of outlines and skeleton bars, behind it the finished product is already there.

## Use when
Idea-to-product, design-to-code, generation or build stories; the first appearance of the hero UI.

## Avoid when
More than once per film; UI too sparse to read as a wireframe; a film that already uses another scan device such as scanline transmutation.

## Original recipe (adapt to Syka native time and nodes)
Render the component twice in one container: the real UI, and a wire version of the same component (backgrounds transparent, every box a 1.5 px C.line outline, text replaced by rounded bars at the measured text width and 40% opacity, icons as outlined circles). Drive x from -4% to 100% of the card width with prog(f, s, s + 44, E.smooth) and, clamped to 0-100, clip the real layer with `inset(0 ${100 - x}% 0 0)` and the wire layer with `inset(0 0 0 ${x}%)`, and draw a 2 px C.accent line at x reaching 24 px past the card's top and bottom, with no glow. Add a soft swell event across the sweep and a snap as the line leaves the card, then fade the line over 10 f on E.smooth.

## Original timing
Sweep 40-48 f on E.smooth across a 600-900 px card (edge peak ~40-58 px/f; the UI itself never moves); line fade 10 f; the finished card then holds at least 30 f under a 0.5-1.5 px/f camera drift.

Upstream evidence count: 0; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
