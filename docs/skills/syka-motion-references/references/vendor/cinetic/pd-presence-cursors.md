# Several people at work at once

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · pd-presence-cursors
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: product_demo; energy: medium; role: accent; formats: feature, walkthrough, launch

## Mechanism
Two or three named cursors move and act on the same canvas at the same time, each in its own rhythm, while presence avatars stack in the corner, so collaboration reads without a word.

## Use when
Collaborative documents, whiteboards, design and planning tools: anything whose claim is 'together, live'.

## Avoid when
A single-user product, or a frame where the name flags would be too small to read; never more than three cursors, which turns into noise.

## Original recipe (adapt to Syka native time and nodes)
Draw each collaborator as src/fx/Cursor.tsx plus a name flag pinned 14 px right and 18 px below the tip (a 6 px-radius label with an initial and first name in C.white on C.ink, C.ink2 or C.mute), so identity comes from the label rather than from colour and the one accent stays free for the newest edit. Script each person as a list of {to, at, action} beats: travel on cursorArc (bow 0.15-0.25, its sign from rand(name)) on E.smooth at 6-14 px/f, with every start shifted by rand(name + i) × 10 f so no two cursors arrive or press on the same frame. Between beats each cursor wanders: every 24 f it eases on E.smooth to a new point within 6 px of its rest, picked with rand(name + floor(f / 24)), so no hand ever freezes. Each action lands on that person's press frame (pressAt): a note dropped onto the canvas on SPR.firm, a shape dragged with the item evaluated 2 f behind the cursor, or a label typed with TypeOn at 30 cps beside the flag; the newest edit takes a 2 px C.accent outline for 24 f, then relaxes to C.line. In the top bar, overlapping 28 px avatar circles with initials scale in on spr(f, join, SPR.micro) as each cursor first enters the frame.

## Original timing
Shot 180-240 f; travel 6-14 px/f on E.smooth, arrivals and presses at least 6 f apart; wander ≤ 6 px per 24 f; one action every 30-50 f across all cursors; note settle on SPR.firm ≈ 16 f; accent outline 24 f; avatars on SPR.micro 6-10 f each; at most three cursors.

Upstream evidence count: 0; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
