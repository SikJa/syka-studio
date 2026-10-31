# Device keeps time inside the lockup

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · le-mark-ticks-in-lockup
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: logo_and_end_card; energy: calm; role: accent; formats: launch, feature, loop, sting

## Mechanism
During the hold, the story device that became part of the mark (a dot, a bar, a stripe) gives one or two small ticks on the beat, so the bookend plays inside the finished lockup instead of after it.

## Use when
Films whose story device became a piece of the mark. Ends that should close the device's loop without ending on the device alone.

## Avoid when
Marks without a separable piece. Very still closes, where any pulse breaks the calm. Loops that need the device to travel back to its frame-0 position instead.

## Original recipe (adapt to Syka native time and nodes)
Keep the device as its own Mark piece (e.g. MARK.D). During the hold, pulse only that piece: scale 1 + 0.12 * hitPulse(f - beat, 2, 6) about its own centre, or a nudge of 3 * hitPulse(f - beat, 2, 6) px along the device's signature direction. If the accent means 'what just landed', flash the piece to C.accent on the pulse and return it to its resting colour over 12 f with mixColor. Place 1-2 ticks on downbeats in the first second of the hold, in time with the stinger's tail, and none in the last 30 f, so the final frame is calm and identical to the poster.

## Original timing
1-2 ticks at least 30 f apart. hitPulse attack 2 f, tau 6 f (gone in ~38 f). Amplitude 10-14% scale or 2-4 px. None in the final 30 f.

Upstream evidence count: 0; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
