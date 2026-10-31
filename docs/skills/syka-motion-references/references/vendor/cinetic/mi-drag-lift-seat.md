# Drag, lift and seat

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · mi-drag-lift-seat
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: micro_interaction; energy: medium; role: workhorse; formats: walkthrough, feature, vertical

## Mechanism
A chip or file picked up by the cursor lifts off the surface, follows the hand with a slight lag and tilt, then drops into its slot with a small contact squash as the slot accepts it.

## Use when
A drag-and-drop (attach a file, add an integration, reorder a card) causes the next state.

## Avoid when
The drag path is long (over about 600 px, cut it), or the item contains text that must be read while it tilts.

## Original recipe (adapt to Syka native time and nodes)
On the grab (pressAt), scale the item 1 to 1.04 and deepen its shadow from 0 2px 4px to 0 16px 32px at 18% black over 8 f E.out. While dragging, place it at the cursor path evaluated at f - 3 (a 3 f lag). Tilt it by rotateZ = clamp(vx * 0.25, -6, 6) degrees, where vx is the cursor's horizontal speed. When it enters the slot, thicken the slot outline from 1 to 2 px and tint it over 6 f E.ui. On release, run the last 40-80 px into the slot on E.contact over 8 f and settle the scale and shadow back. Apply squash(t) anchored at the contact edge, and put a 'snap' or light 'land' on the contact frame.

## Original timing
Lift 8 f E.out to 1.04 with a 16/32 px shadow. Follow lag 3 f; tilt at most 6 degrees. Slot tint 6 f E.ui. Drop 8 f E.contact, plus squash over about 8 f.

Upstream evidence count: 0; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
