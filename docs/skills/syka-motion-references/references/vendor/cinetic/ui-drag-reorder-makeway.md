# Drag to reorder, siblings make way

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ui-drag-reorder-makeway
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: ui_choreography; energy: calm; role: workhorse; formats: walkthrough, feature

## Mechanism
An item lifts under the cursor, travels on a slight arc to a new position while its neighbours slide aside one slot at a time, and settles into place with a firm landing and no bounce.

## Use when
Prioritising, scheduling, kanban boards, playlists: any product whose smart part is ordering things.

## Avoid when
The reorder is automatic (animate the computed reorder on one curve, with no cursor), or more than 2-3 drags would fall in one shot.

## Original recipe (adapt to Syka native time and nodes)
On the press (pressAt(f, grab)) the item moves to its own top layer and lifts: scale 1 to 1.03 and its shadow from 0 6px 16px at 8% to 0 18px 40px at 14% over 8 f on E.ui. It then follows cursorArc(from, to, prog(f, a, a + T, E.glide), 0.15) with T = max(36, 0.15 x distance) f, so it never exceeds 20 px/f and its label stays readable, and rotateZ = -0.15 deg per px/f of horizontal speed, clamped to +-4 deg. Siblings take their y from the computed layout for the currently hovered index, evaluated on fd(f), so each time that index changes the displaced sibling moves one pitch over 12 f on E.ui. On release the item settles into its slot with spr(f, drop, SPR.firm), the lift reverses over 10 f, its marker flashes C.accent and relaxes to neutral over 24 f, and a tick lands on the drop frame.

## Original timing
Lift 8 f (E.ui), scale 1.03. Drag T = max(36, 0.15 x distance) f (E.glide) on a 0.15 bow, <= 20 px/f, tilt <= 4 deg. Sibling shift 12 f (E.ui) per index change. Drop SPR.firm, shadow back over 10 f, accent relax 24 f.

Upstream evidence count: 0; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
