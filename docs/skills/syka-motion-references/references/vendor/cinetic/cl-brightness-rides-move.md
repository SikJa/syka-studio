# Brightness rides the move

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · cl-brightness-rides-move
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: color_and_light; energy: high; role: accent; formats: launch, sting, feature

## Mechanism
A mark or icon takes its brightness from the same progress that drives its scale or depth, so an oversized pass stays a dark shape and the object reaches full brightness exactly as it lands.

## Use when
A logo mark or icon slams in oversized and shrinks to size, an icon lifts out of the UI toward camera, or a field of objects at several depths is pushed through on a dark stage.

## Avoid when
Text (use cl-ink-resolve, which runs on time), and moves under about 150 px or 1.5x, where the change would not show. On a light stage a giant near-black pass would itself be the flash, so mix toward the paper there.

## Original recipe (adapt to Syka native time and nodes)
Never give the fill a clock of its own: derive it from the transform. Log-scale slam: s = lmix(s0, 1, prog(f, a, a + 66, E.glide)) with s0 = 6-8. Then p = 1 - Math.log(s) / Math.log(s0), and fill = mixColor(mixColor(C.ink, C.white, 0.14), C.white, p * p * p) on a dark stage (on paper, mix from mixColor(C.paper, C.ink, 0.12) to C.ink). While the mark is three or more times its final size and covering much of the frame, it stays a dark grey under about luma 60, so the frame's mean luma never flashes. Lift toward camera: an icon tile peeling out of its row inverts as it travels, with the tile going mixColor(C.ink2, C.white, q) and the glyph mixColor(C.white, C.ink, q), where q = clamp(travel progress / 0.75), so the inversion finishes before the last quarter of the move. Depth field: in a multi-depth parallax field, mix each layer's fill from C.ink toward its own colour by a weight read from its current z (0.45 far, 0.75 mid, 1.0 near), and keep reading it during a push so objects brighten as they approach. Turn on true motion blur while |delta log s| > 0.1 per frame, and check with scripts/measure-speed.py that edges stay under 80 px/f.

## Original timing
Slam: 66 f on E.glide from s0 = 6-8. The fill follows p^3, so it passes mid-grey only in the second half of the move and reaches full brightness on the landing frame. Lift-out: 24 f of travel on E.inOut, with the inversion complete at 75% (about 18 f); a mid-grey tile goes from about luma 160 to 248. Depth weights are 0.45 / 0.75 / 1.0 by z, re-read every frame of the push. Motion blur stays on while |delta log s| > 0.1 per frame, and edges stay under 80 px/f.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
