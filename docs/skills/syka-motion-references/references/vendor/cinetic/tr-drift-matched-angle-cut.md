# Angle change on a shared drift

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · tr-drift-matched-angle-cut
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: transition; energy: calm; role: workhorse; formats: launch, feature, loop

## Mechanism
A hard cut jumps to a new angle or the next state of the same object (front to top-down, open to closed) while the slow zoom or pan carries on at exactly the same rate, so a calm shot changes viewpoint with no jolt and no speed ramp.

## Use when
Calm films and product beauty shots where a velocity ramp would be too loud: showing an object's second side or its next state within one continuous gesture.

## Avoid when
The two angles look alike (under about 30 deg it reads as a jump cut), the subject's size or position jumps, or one side is static. For a lift in energy, use a velocity handoff instead.

## Original recipe (adapt to Syka native time and nodes)
Write the drift once as a function of the absolute frame and multiply it into both acts' anchor-camera k (src/lib/camera.ts): d(abs) = lmix(1.10, 1, prog(abs, a, a + 96, E.outSoft)) for a settling pull (lmix(1, 1.10, ...) for a push), plus any pan as sx += v · (abs − a). zoomSpeed(kA, cut − 1) then equals zoomSpeed(kB, cut) by construction. Shot A frames the subject from one angle. Shot B frames the same subject at least 30 deg away (yaw ±35-50 deg on a tilted UI plane, or a top-down pitch on an object built with depth) or in its next state (lid open to closed, card face to back). Its on-screen centre stays within ±40 px of A's and its apparent size within ±15%. Cut on an act boundary 8-16 f into the drift, on a beat, while the frame still changes about 0.3% per frame. When the subject itself acts (a lid closes, a device turns), drive that action from one absolute progress too and cut at 35-55% of it, so it finishes in the new angle. Keep the stage colour and light identical, and add no ghost frame.

## Original timing
Drift 96 f on E.outSoft from 1.10x (or a 2-4 px/f pan). Cut 8-16 f in, at −0.26 to −0.36% scale per frame (about 3 px/f at the frame edge); the drift settles 40-80 f after the cut. Angle change at least 30 deg, centre offset at most 40 px, size change at most 15%. Optional subject action 36-60 f on E.smooth, cut at 35-55% of it. Cut in 0 f.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
