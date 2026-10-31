# Staircase echo shape morph

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · le-clone-stack-morph
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: logo_and_end_card; energy: medium; role: accent; formats: launch, feature

## Mechanism
A large brand shape collapses into a slim pill around the URL, and mid-morph its moving edges show stepped echoes from staggered copies, like a mechanical transformation.

## Use when
Turning a big brand shape or frame into the CTA container. Mechanical, engineered or developer-tool brands. One moment that should feel designed rather than tweened.

## Avoid when
Short moves (under ~150 px the echoes collapse into a smear). Elements that already carry motion blur (double trails). More than once per film.

## Original recipe (adapt to Syka native time and nodes)
Animate one rounded rect from the big shape to a pill that hugs the URL over 48 f on E.smooth, using morphBox from Morph.tsx or width, height and radius directly. Render 7 copies behind it: copy k samples the same morph at frame f - 2k and draws as a 1.5 px stroke (no fill) with opacity 0.6 * (1 - k/9) in one tonal step of the stage colour. The copies show only where the shape moves, stack into a staircase along the moving edges, and coincide and vanish once it rests. The URL swaps in at the start of the morph (8 f fade on E.smooth) and stays still once the pill lands.

## Original timing
Morph: 48 f on E.smooth, height 983 -> 227 px (edge peak ~22 px/f), width 1878 -> 997 px with a long tail. 7 copies at a 2 f delay each (14 f of echo after the leader stops). The URL stays readable for at least 102 f afterwards, under the card's 10-15% push (le-living-hold).

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
