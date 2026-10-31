# Stalled state by dimming

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ui-stalled-state
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: ui_choreography; energy: calm; role: accent; formats: launch, feature, walkthrough

## Mechanism
A token stops on its rail, the destination greys out, short status words appear one after another, and the frame goes briefly still so the blockage is felt.

## Use when
The problem beat: money, a message or a task stuck waiting (closed, pending, rejected) just before the product unblocks it.

## Avoid when
The film has no problem act, or the block would sit longer than about 1.5 s; stillness only works as a short contrast to the motion around it.

## Original recipe (adapt to Syka native time and nodes)
Split the rail at the stalled token: the travelled part solid, the part ahead dotted (strokeDasharray '2 4'), both drawn from the same path and clipped at the token's position. On the stall frame the destination node dims to 30% (opacity, or mixColor toward C.mute) over 8 f on E.smooth; status words then appear beside the token at +6, +28 and +40 f, each an opacity step with a 6 px rise through arrive() over 8 f on E.out, and at +51 f the first word dims to 40% so the decisive word (the reason, the day) stands alone. Bring the camera to zero velocity for a designed freeze of at most 15 f on a gap in the sound, then resume a 0.3 px/f drift so nothing sits static past 48 f.

## Original timing
Node dim 8 f (E.smooth) to 30%. Status words at +6/+28/+40 f, 8 f each (E.out, 6 px rise); first word dims at +51 f. Freeze <= 15 f on a silence, then 0.3 px/f drift.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
