# Envelope-matched type cut

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · tr-envelope-match-type-cut
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: transition; energy: medium; role: accent; formats: launch, feature, sting, vertical

## Mechanism
A big line hard-cuts to a much smaller, longer line whose words start spread apart so it spans exactly the old line's width, then the gaps close while the sideways drift carries on, so the outer edges of the type survive the cut.

## Use when
A big two- or three-word claim hands over to its full sentence or call to action; any big-to-small type change where both lines share a centre or a left edge and the type already drifts sideways.

## Avoid when
B is naturally wider than A (use a blur-swap rescale instead), either line is a single word (there are no gaps, so collapse one word's tracking instead), or the alignment changes across the cut.

## Original recipe (adapt to Syka native time and nodes)
On the cut frame, measure line A's on-screen width W_A and its centre or left edge (measureTracked from src/lib/measure.ts times A's current scale). Lay line B out at rest (cap height 2-3x smaller, more words) and read its natural width W_B, which must be smaller than W_A, and its word positions from measureTracked prefixes. Spread B with an extra gap per word space, g(f) = g0 · (1 − prog(f, 0, 36, E.outSoft)) with g0 = (W_A − W_B)/(n − 1), applied as translateX g · (j − (n − 1)/2) on word j of a centred line (g · j with the left edge pinned for a left-aligned one). Each word keeps its own tracking, so it stays readable while the gaps close. Cut on the act boundary, optionally with one ghost frame of B at 0.65 opacity over A. Both lines carry the same horizontal drift through the cut (A's creep, for example −3.5 px/f), which decays in B over 60 f on E.outSoft, and B may ink in from C.mute to C.ink over 16 f with mixColor.

## Original timing
Cut in 0 f, or 1 ghost frame at 0.6-0.7 incoming. The gaps close over 36 f on E.outSoft, half done by frame 5. The outermost words travel (W_A − W_B)/2: keep that at or under 160 px so their first frame stays under 20 px/f, or fly them at 0.6 opacity for the first 6 f. Shared drift 3-4 px/f, decaying in B over 60 f. Hold B at least 60 f.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
