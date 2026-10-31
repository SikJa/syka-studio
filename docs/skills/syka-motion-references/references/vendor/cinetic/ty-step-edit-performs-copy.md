# Hard-step edits that act out the copy

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ty-step-edit-performs-copy
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: typography_motion; energy: medium; role: accent; formats: launch, feature, sting

## Mechanism
The headline does what it says with one-frame edits: broken words click straight one at a time, or words delete from the end faster and faster.

## Use when
Copy about fixing, undoing, cleaning up or simplifying; a deadpan joke beat; a problem line that should visibly go away.

## Avoid when
Copy the motion would contradict; calm films; more than one per film.

## Original recipe (adapt to Syka native time and nodes)
Give each word two states and pick one by fd(f) >= step_i, with no tween at all. Fix variant: broken states are per-letter rotation along an arc (letter j rotated (j - mid) x 6 degrees and raised (j - mid)^2 x 2 px), skewX(15deg) with translateY -0.17 em, or rotate(-20deg), drifting 0.5 px/f while broken; steps land at +6, +26 and +40 f after the cut, each with a 2% scale punch from hitPulse(t, 1, 4) on the fixed word. Delete variant: words.slice(0, n) with n dropping at accelerating intervals (10, 5, 5, 2 f), building pressure into the cut. Each step gets one click, each a little louder than the last.

## Original timing
Snap 1 f, no tween; fix intervals 20 then 14 f; delete intervals 10/5/5/2 f; broken-state drift 0.5 px/f; click within 1 f of each step; hold the fixed line at least 42 f.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
