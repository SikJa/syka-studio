# Iris from a glyph

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · tr-iris-from-glyph
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: transition; energy: high; role: accent; formats: launch, feature, sting

## Mechanism
A small dot appears on a word or icon in the current shot and balloons exponentially to swallow the frame, showing the next scene inside it, so the reveal starts from content rather than from nowhere.

## Use when
A word in the copy names what the next scene shows (a benchmark, a feature, a place); dark-to-light or light-to-dark act changes.

## Avoid when
A linear radius (it crawls, then snaps); the same iris more than twice per film; a seed glyph the viewer has not had 6 f to find.

## Original recipe (adapt to Syka native time and nodes)
Render the incoming scene above the outgoing one, clipped with clip-path: circle(r at cx cy). The 14 px seed dot (in the next scene's stage colour) appears on the glyph, scale 0 → 1 over 6 f on E.out, and holds 6-10 f. Then r = lmix(14, R, prog(f, 0, 20, E.linear)), where R is the distance to the farthest frame corner: a constant ratio of about ×1.25-1.29 per frame. Over the same 20 f, (cx, cy) moves from the glyph to the frame centre on E.smooth. Optional residue: when the disc reaches r ≈ 900 px, step its fill through three tones of one hue over 6 f, and leave a 90 px ring one tone darker at that radius as set dressing for the new shot. For an app icon, use a funnel instead of a circle: a clip polygon anchored at the icon's base whose top width and height grow ×1.18 per frame over 24 f.

## Original timing
Seed in over 6 f, hold 6-10 f. Iris 20 f at a constant ratio (about ×1.25-1.29 per frame, radius in log space). Centre drift 20 f on E.smooth. Optional tonal ramp: 3 steps over 6 f. Funnel variant: 24 f at ×1.18 per frame. The disc fills the frame on the downbeat.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
