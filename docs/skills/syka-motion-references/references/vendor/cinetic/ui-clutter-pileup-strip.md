# Clutter pile-up, then strip to one

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ui-clutter-pileup-strip
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: ui_choreography; energy: high; role: accent; formats: launch, feature, vertical

## Mechanism
Clicks spawn copies of a control until the frame is a messy pile, then elements vanish one per beat and the survivors snap to re-centre until a single tile remains.

## Use when
Showing overload (too many tools, buttons, tabs, notifications) and then focus: the product reduces chaos to the one thing that matters.

## Avoid when
Calm or premium films, or elements whose text must be read; the jumps are deliberately abrupt.

## Original recipe (adapt to Syka native time and nodes)
Pile-up: on each click (pressAt from fx/Cursor.tsx) spawn a clone every 4 f for about 60 f at x = (rand(i) - 0.5)*500 and y = (rand(i + 99) - 0.5)*300 px, each travelling 40-80 px out from the previous clone over 8 f on E.out while scaling 0.9 to 1, so the motion-blur pass smears every spawn, and drift the whole pile up 1.5 px/f. Strip: hold the survivors in an array whose length drops at listed frames, one removal every 5-7 f, choose the state with fd(f), and compute the centred layout from the current array with no tween, so the remaining tiles jump to their new places on the removal frame. Hold the last survivor 17 f under a 0.5% scale drift (breath() from lib/camera.ts), then exit it or let it become the next shot. Put a soft tick on every spawn and removal, rising in level, so the acceleration is heard.

## Original timing
Spawns every 4 f for ~60 f (12-15 clones), 8 f each (E.out, 40-80 px), pile drift 1.5 px/f. Removals every 5-7 f with an instant re-centre (fd); last survivor 17 f with a 0.5% drift.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
