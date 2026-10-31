# Velocity handoff cut

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · tr-velocity-handoff-cut
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: transition; energy: any; role: workhorse; formats: any

## Mechanism
The outgoing shot speeds up in one direction and is cut on its fastest frame. The next shot opens already moving the same way and brakes to rest, so momentum runs straight through the edit.

## Use when
Most cuts between moving shots: feature-to-feature edits, montages, chapter changes, and any film that must never stop. Velocity-matched cuts are exempt from the two-uses-per-type limit.

## Avoid when
One side has to be still (a held statement or a designed freeze), or the two shots would move in opposite directions. Carry a shape or an anchor across instead.

## Original recipe (adapt to Syka native time and nodes)
Make the cut an act boundary in timeline.ts so motion-blur samples never straddle it, and place it on a beat with b(). In the outgoing act, drive the camera (src/lib/camera.ts) or the hero's translate on E.exit (E.contact, or E.in for a harder snap) over its last 16-24 f, so it ends at peak speed on the final frame; for a zoom, apply the same ramp to k through lmix. In the incoming act, start the key element moving on frame 0 in the same screen direction at 1.0-1.5x that speed and slow it on E.out over 45-90 f. Size the two sides with exitSpeed(D, T, ease) and entryDistance(v, T) from references/transitions.md; for a flicked list, use y = v0·(1 − k^f)/(1 − k) with k = 0.92-0.943 and no overshoot. Give each act one dominant screen vector (+x in one act, −x in the next) and start every incoming element on the side it would enter from.

## Original timing
Exit: last 16-24 f on E.exit (speed grows about ×1.1-1.2 per frame), ending at 25-40 px/f (never above 60) or −6 to −8% scale per frame. Entry: 30-55 px/f on frame 0, slowing about ×0.92-0.94 per frame (E.out over 45-90 f; entryDistance(40, 60) is about 400 px). A 1-3 px/f drift may run under the hold before the ramp. Text inside a moving shot must be under 20 px/f by the time it has to be read.

Upstream evidence count: 9; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
