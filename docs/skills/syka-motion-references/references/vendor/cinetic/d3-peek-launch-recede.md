# Peek, hover, launch and recede

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · d3-peek-launch-recede
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: depth_and_3d; energy: high; role: accent; formats: launch, feature, vertical

## Mechanism
A device or product panel barely rises from the bottom edge, pauses, then shoots up to centre. It is tipped back as it rises, faces camera as it arrives, and slowly settles away from camera.

## Use when
Introducing hardware or a hero product surface, where anticipation makes the main move feel powerful.

## Avoid when
The film has already used anticipation twice, or the object is small UI (it reads as a bounce).

## Original recipe (adapt to Syka native time and nodes)
Start the object below the frame inside a perspective(2200px) parent with transform-origin bottom centre. Peek: translateY -170 px on E.out over 14 f; hover 4 f. Launch to centre on E.whip over 34 f with travel capped at about 640 px: the peak is 3.7x the mean speed, so lengthen the tween for longer travel to keep the peak under 70 px/f. Tip it to rotateX 10 deg while rising and resolve to 0 on E.rest over the last 20 f of the launch. Then recede: scale lmix(1, 0.93, E.smooth(p)) over 60 f while its ground shadow (motion-tokens section 7 formula, z falling from 120 to 0) tightens.

## Original timing
Peek 170 px over 14 f E.out (peak about 64 px/f); hover 4 f; launch of up to 640 px over 34 f E.whip; tilt 10 to 0 deg over the last 20 f on E.rest; recede x0.93 over 60 f E.smooth.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
