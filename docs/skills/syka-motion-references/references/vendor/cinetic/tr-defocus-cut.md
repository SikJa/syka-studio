# Defocus cut

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · tr-defocus-cut
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: transition; energy: medium; role: accent; formats: launch, feature, walkthrough

## Mechanism
The outgoing shot throws itself out of focus in a few frames, the film cuts to a shot that is still fully defocused with its content already moving, and the lens snaps sharp as that content settles.

## Use when
Joining two shots with nothing in common (no shared shape, direction or colour), or a deliberate 'look again' beat.

## Avoid when
As the default seam (it turns into a soft crossfade), on shots dominated by small text, or more than twice per film.

## Original recipe (adapt to Syka native time and nodes)
In the outgoing act's last 6 f, wrap the scene in RackFocus with t = prog(f, T − 6, T, E.in) and blur 16 px, fading it toward the next stage colour (opacity 1 → 0.2). Hard cut on the act boundary. The incoming act opens in RackFocus at blur 24 px and t = 1, held for 6-12 f while its content already moves in (cards on a diagonal, E.out over 20 f). Then t goes 1 → 0.1 over 8 f on E.in (the snap) and 0.1 → 0 over 12-20 f on E.outSoft with mid = true. Text in the incoming shot uses Words.tsx or blurIn so it lands sharp, and readable text is never blurred for more than 6 f.

## Original timing
Out: 6 f on E.in to 16 px. Cut. Defocused hold 6-12 f at 24 px. Snap 8 f (E.in) to t = 0.1. Settle 12-20 f (E.outSoft). Incoming card move 20 f on E.out. About 30-45 f in all.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
