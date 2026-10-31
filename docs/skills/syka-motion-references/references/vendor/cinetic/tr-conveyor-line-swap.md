# Conveyor line swap

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · tr-conveyor-line-swap
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: transition; energy: medium; role: workhorse; formats: launch, feature, vertical, loop

## Mechanism
The current line floats up and fades, the stage is empty for an instant, and the next line rises from below into the same spot, so a run of statements reads as one upward feed.

## Use when
Sequences of short claims, lists of capabilities, a subject that changes while the predicate stays.

## Avoid when
Lines of very different length or alignment (the eye loses the slot), or more than 4-5 lines in a row without another seam type.

## Original recipe (adapt to Syka native time and nodes)
Outgoing line: translateY 0 → −135 px through depart(q), with q = prog(f, 0, 30, E.in); opacity 1 → 0 over its last 8 f, plus blurOut(q, 8). Leave 2 empty frames. Incoming line: translateY +188 → 0 through arrive(p), with p = prog(f, 0, 30, E.out). Its opacity goes 0 → 1 over the first 10 f, so it flies faded while faster than 20 px/f, and its colour goes C.mute → C.ink over 16 f with mixColor. For a word-by-word version, use Words.tsx with stagger 3-4 and out/outDur 16, so each old word rises away as its replacement rises in. Keep one direction (up) for the whole run.

## Original timing
Exit: 30 f on E.in (last frame about 26 px/f, while fading). Gap 2 f. Entry: 30 f on E.out (first frame about 37 px/f, while faded); colour over 16 f. Per-word stagger 3-4 f. One line per bar or half bar.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
