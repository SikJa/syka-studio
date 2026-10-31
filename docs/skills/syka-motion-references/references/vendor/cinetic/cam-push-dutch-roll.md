# Push-in with a roll swing

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · cam-push-dutch-roll
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: camera; energy: medium; role: accent; formats: launch, feature

## Mechanism
The camera dives into one corner of the UI, rolls a few degrees off level mid-dive like a hand-steered move, and rolls back to level as it lands.

## Use when
A push that would otherwise feel mechanical: diving into a settings corner, a sidebar or a detail panel.

## Avoid when
Next to another rolled or tilted move in the same act (one rotation axis per act), or on moves shorter than 40 f, where the roll reads as a wobble.

## Original recipe (adapt to Syka native time and nodes)
Blend lc(WIDE, TARGET, t) with t = prog(f, a, a + 60, E.smooth), where TARGET has ax, ay on the corner element, sx, sy at that element's current screen point (so it stays put while the frame grows around it) and k = 2.09 x WIDE.k. Add the roll on its own curve: roll = t < 0.57 ? mix(0, -4, E.smooth(t / 0.57)) : mix(-4, -0.3, E.smooth((t - 0.57) / 0.43)), passed as the Shot's roll so camera() keeps it rigid outside any tilt. For a tilted landing, ease pitch 0 -> 8 deg over the last 24 f. Keep |roll| under 11 deg.

## Original timing
60 f; zoom 1 -> 2.09 on E.smooth in log space, peak about 3.5%/f mid-move. Roll 0 -> -4 deg by 57% of the move, back to -0.3 deg at the end, each segment E.smooth. Optional pitch 0 -> 8 deg over the last 24 f.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
