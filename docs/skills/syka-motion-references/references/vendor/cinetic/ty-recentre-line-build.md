# Re-centring line build

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ty-recentre-line-build
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: typography_motion; energy: medium; role: workhorse; formats: any

## Mechanism
Words or typed glyphs join a centred line one at a time while the whole line glides sideways so it is centred on every frame.

## Use when
Speaking-pace builds, stat rows that widen as words arrive, centred typed headlines, any line whose final width is unknown while it builds.

## Avoid when
Shifts over about 280 px per word (split the line instead); left-aligned layouts; a line that must keep an anchored element still (use ty-inplace-light-up-beats).

## Original recipe (adapt to Syka native time and nodes)
Measure the line at each state with measureTracked and set targets x_k = centreX - width_k / 2; drive the container as a sum of springs, x = x_0 + sum over k of (x_k - x_(k-1)) x spr(f, land_k, SPR.firm), which never overshoots and smooths away per-glyph steps when it follows typing. Each new word drops from -0.35 em (or rises from +0.2 em) into its slot on arrive(prog(f, land_k, land_k + 18, E.out)) with opacity 0 -> 1 over 6 f; after the last word keep a residual 0.3 px/f drift. Pre-solved alternative for short typed lines: lay out the final centred line, fade each character in over 5 f at 1.3 f apart, and glide the container +90 px -> 0 on prog(f, s, s + 24, E.out) so it lands centred with the last glyph. Optional: a single-hue pill behind the line whose width follows the measured width + 50 px on the same springs.

## Original timing
A new word every 26-36 f (0.43-0.6 s); SPR.firm re-centre (peak about 7% of the shift per frame, 97% by 27 f), so shifts up to 280 px stay under 20 px/f; word drop 18 f E.out; pre-solved: 1.3 f per character, 5 f fade, 90 px glide over 24 f E.out; residual drift 0.3 px/f.

Upstream evidence count: 6; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
