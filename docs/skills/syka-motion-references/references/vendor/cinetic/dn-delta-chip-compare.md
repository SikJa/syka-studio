# Before-to-after with a delta chip

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · dn-delta-chip-compare
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: data_and_numbers; energy: medium; role: accent; formats: launch, feature, vertical, walkthrough

## Mechanism
The old figure steps back to a small grey 'before', the new figure counts in at hero size, and a delta chip ('-38%') pops in the accent on the landing frame.

## Use when
Improvements such as cost down, speed up or errors falling from 412 to 3; before-and-after claims.

## Avoid when
The change is small or noisy; the story has no real 'before' state to show.

## Original recipe (adapt to Syka native time and nodes)
At the cue the old hero figure lifts out (0.3 em up, 12 f on E.in through depart, opacity on E.smooth), while a smaller 'before' copy rises into a secondary slot above-left through MaskRise, so the two values never sit crossfaded in one place. The new figure counts at hero size from the old value to the new on E.type over 36 f, and a 2 px C.mute strike draws across the 'before' value over 10 f on E.out. On the count's landing frame, the delta chip (C.accent fill) scales from 0.6 to 1 from its left edge on SPR.micro (no overshoot) with a tick, then its fill relaxes to C.ink2 with accent text over 20 f.

## Original timing
Old figure exits over 12 f on E.in. 'Before' MaskRise 30 f. New count 36 f on E.type. Strike 10 f on E.out. Chip on the landing frame (SPR.micro, no overshoot), fill relaxes over 20 f. Hold at least 36 f under a breath.

Upstream evidence count: 0; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
