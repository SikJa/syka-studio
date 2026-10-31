# Punch-in insert on the same render

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · cam-punch-in-insert
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: camera; energy: medium; role: workhorse; formats: feature, walkthrough, launch, vertical

## Mechanism
A hard cut jumps from the wide view to a 2-2.5x on-axis close-up, or to a 3-4.5x macro of the exact control being used, while every animation keeps running, then cuts back out.

## Use when
Small UI actions that need hero weight (send, picking a date, a chip), long walkthroughs that need their visual scale reset, and a wide/close rhythm that keeps both context and legibility.

## Avoid when
The UI doesn't hold up at 3-4.5x, or the close-up isn't obviously the same place (keep the cut on-axis or anchored to the cursor, or it reads as a jump).

## Original recipe (adapt to Syka native time and nodes)
Lay the product out once and define two Shots on it: WIDE, and INSERT with ax, ay on the control's centre (or the cursor tip), sx, sy at frame centre or on a third, and k = 2.0-2.5 for an on-axis punch or 3-4.5 for a macro insert. Switch on a whole frame, cam = fd(f) >= CUT ? INSERT : WIDE, and keep the cursor path, hover lift, typing and counters on their own clocks so they carry on mid-motion across the cut; place the cursor with toScreen() of the active shot. Never hold the insert still: give it a 1-2 px/f linear drift along the action's direction, or open it with a decaying offset (+8% of frame width, decayed on E.out over 96 f). Build the UI as live layout at its final size, never as an upscaled bitmap, so text stays sharp at k = 4.5, and cut back out on the next action or at the peak of an exit move.

## Original timing
Wide holds 20-64 f before an on-axis punch (90-220 f when it establishes the scene). On-axis close-up about 60 f. Macro insert 46-74 f, up to 76-154 f when it carries an action. Scale 2.0-2.5 on-axis, 3-4.5 macro. Drift inside the insert 1-2 px/f linear (3-5 px/f for a 2.5x component slide). Cut on the click, keystroke or beat, with no transition frames. Chain 2-3 punches on consecutive beats for a staccato build.

Upstream evidence count: 5; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
