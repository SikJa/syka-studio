# Pull out of the mark, undershoot, breathe

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · le-macro-pullout-breathe
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: logo_and_end_card; energy: high; role: signature; formats: launch, sting, feature, vertical

## Mechanism
The mark arrives so large that only fragments of it fill the frame, collapses to slightly smaller than its final size, then gently breathes up to rest, as if the camera had found it.

## Use when
The mark's first full appearance at the end, or a logo sting. A hit after a short bass gap. Marks with a strong silhouette or inner shapes that read as abstract fragments when huge.

## Avoid when
Thin line marks (at macro scale they become two hairlines crossing the frame). Right after another zoom-through seam. The mark was already shown at hero size earlier (that makes this a replayed reveal).

## Original recipe (adapt to Syka native time and nodes)
Place the Mark with placeMark at its final spot; centre it where the lockup needs it, e.g. 80 px left of frame centre to leave room for the name. Pick the start scale s0 so the mark's outer edge starts about 750 px from its centre (s0 = 750 / the mark's half-width at rest, about 5x for a 300 px mark), so only fragments fill the frame. Scale it about its own centre in log space: s = lmix(s0, 0.93, prog(f, a, a+N, E.outSoft)) * lmix(1, 1/0.93, prog(f, a+N-24, a+N, E.smooth)), with N = 43 x ln(s0 / 0.93) frames (72 f from 5x). The log rate then starts near 0.105/f, so the outer edge never passes about 80 px/f; from 5x it crosses 1.0 near f35, bottoms out at 0.94 near f52 and breathes up to rest at 1.0 by f72 with no velocity step. Enter it on a cut: the outgoing shot shrinks into its centre on E.in over its last 24 f and cuts at a matching log speed (or start from zoomHandoff in camera.ts at the outgoing log speed). Render with the motion-blur pass. Keep the mark's counters and small parts outside the frame until the log rate falls below 0.07/f (~f10). Put the bottom of the undershoot on the strongest low hit after a ~15 f bass gap.

## Original timing
Collapse: N = 43 x ln(s0 / 0.93) frames on E.outSoft (72 f from 5x; log rate about 0.105/f at the start, outer edge under about 80 px/f, under 0.07/f by f10). Breathe: the last 24 f on E.smooth (0.93 -> 1.0), bottoming at 0.94 near f52. Settled by f72. Hold the mark ~20 f before the name follows.

Upstream evidence count: 3; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
