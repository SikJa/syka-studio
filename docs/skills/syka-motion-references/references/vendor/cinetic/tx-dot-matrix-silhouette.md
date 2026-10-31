# Faint dot-matrix silhouette

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · tx-dot-matrix-silhouette
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: texture_and_finish; energy: calm; role: accent; formats: launch, feature, vertical

## Mechanism
Behind a claim, a barely visible field of dots forms a meaningful silhouette (a world map, a region, the product's own shape), adding literal context without competing with the type.

## Use when
Claims about reach, coverage, location or scale, and any shot where a silhouette adds literal meaning behind the copy.

## Avoid when
Generic decoration with no meaning; contrast above ~6%, where it starts competing with the copy; small vertical frames where 13 px dots read as noise (scale the pitch up instead).

## Original recipe (adapt to Syka native time and nodes)
Precompute dot centres on a 20 px grid at 1080p, keeping only those inside a silhouette bitmap (a land mask, a region outline, the mark), and render them as one SVG of 13 px circles (or bake it to PNG). Fill the dots with the ground colour shifted about 4% in lightness, same hue (OKLCH 0.03-0.04: lighter on dark grounds, darker on light ones), and place the layer under the type. Keep it alive with a scale of lmix(1.00, 1.02, prog(f, s, e, E.linear)) across the shot or a translate under 1 px/f, and let it leave with the shot's cut rather than fading.

## Original timing
Holds one shot of 80-100 f; scale 1.00 to 1.02 linear across it (well under 1 px/f); arrives and leaves on cuts, no fades.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
