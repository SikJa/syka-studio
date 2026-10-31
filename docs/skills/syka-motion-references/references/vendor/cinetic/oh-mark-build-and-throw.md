# Mark builds, then is thrown into a macro of itself

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · oh-mark-build-and-throw
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: opening_hook; energy: high; role: accent; formats: sting

## Mechanism
On frame 1 a dot swells into the brand mark. The mark grows briefly, holds for a breath, then shrinks away faster and faster and hard-cuts at peak speed to a frame-filling macro of the same mark, which keeps pulling back.

## Use when
A brand-first logo sting where recognition must land in under half a second and the energy must pour into the next shot.

## Avoid when
The mark is unfamiliar and needs a longer hold to be learned, or the film already uses a scale-continuity cut elsewhere. Never use it to show the full lockup.

## Original recipe (adapt to Syka native time and nodes)
Show the mark only; the wordmark lockup is kept for the end. A 12 px dot at frame centre scales into the 320 px mark over 18 f on E.out, while a wrapper grows 0.83 -> 1 on E.out over 32 f from f8; then hold 8 f. Exit: wrapper scale 1 -> 0.55 over 20 f on E.in, with the hard cut on the exit's last (fastest) frame. The next shot opens on the same mark at the same screen point, its k multiplied by zoomHandoff(t, v0, 24) with v0 = zoomSpeed(kOut, cut - 1) (about -0.168): it starts near 2.2x and slows to 1x with no speed step at the cut, revealing the stage and the first UI as it settles. No overshoot anywhere; the master's motion-blur pass handles the fast frames (incoming edges peak at about 59 px/f).

## Original timing
Dot to mark 18 f on E.out (edge about 49 px/f on its first frame); grow 32 f from f8; hold 8 f (f40-48); exit 20 f on E.in (f48-68), cut at f68 (1.13 s); macro pull-back 24 f through zoomHandoff from about 2.2x.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
