# Finished result first, then rewind

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · oh-result-first-rewind
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: opening_hook; energy: medium; role: accent; formats: walkthrough, feature, launch

## Mechanism
The film opens on the finished end state at its most impressive, holds for a beat, then visibly rewinds every element back to the empty start, where the story begins playing forward.

## Use when
Walkthroughs and feature films whose output is visually rich and readable at a glance.

## Avoid when
An end state that needs explaining, or more than about 30 state changes (the rewind turns to mush).

## Original recipe (adapt to Syka native time and nodes)
Every element is a function of frame, so remap time once at the act root: local = f < r0 ? T_end : T_end - (T_end - T_0) * prog(f, r0, r0 + R, E.smooth), with R = 36-48 f. Pass local to every component and decide discrete state with fd(local); entrances then replay backwards, and E.out arrivals become accelerating exits. Open at T_end with breath (+2.5%) over a 40 f hold. The rewind's peak rate is 2.86 × (T_end − T_0) / R times real time, so rewind at most about 120 f of build (about 8x at the peak for R = 42); for a longer build, set T_0 to a later, partly built state. Any element whose reversed move would pass 60 px/f, and any readable text that would pass 20 px/f, fades out over the rewind instead of travelling. Put one short filtered reverse swish under the rewind and a click on its last frame, then play the walkthrough forward from T_0 on the next beat.

## Original timing
Hold 40 f; rewind 36-48 f on E.smooth (peak about 8x real time, at most about 120 f of build); forward play from the next beat.

Upstream evidence count: 0; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
