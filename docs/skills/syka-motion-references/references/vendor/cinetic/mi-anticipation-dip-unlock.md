# Anticipation dip before an unlock

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · mi-anticipation-dip-unlock
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: micro_interaction; energy: medium; role: signature; formats: launch, feature, sting

## Mechanism
Light builds on a locked card, the card briefly darkens as the lock's shackle swings open, then it pops to clean full-tone content, so the release feels bigger than it is.

## Use when
Something locked, gated or hidden becomes available (an unlock, a reveal, access granted) and the moment should land as a payoff.

## Avoid when
The brightness would clip whites into a bloom, or the film already has two big payoff beats.

## Original recipe (adapt to Syka native time and nodes)
Drive the card wrapper's filter brightness through a tw chain: 1.0 to 1.5 over 14 f E.in (the build), then 1.5 to 0.8 over 12 f E.out (the dip). On the pop frame, swap the locked art for the clean art in one frame (decided with fd), hidden inside the brightness pulse, never crossfading the two. Set brightness to 1 + 0.35 * hitPulse(t, 3, 6) and scale to 1 + 0.024 * hitPulse(t, 4, 4): a pulse, not a spring. During the dip, rotate the shackle -30 degrees about its hinge (transformOrigin at the hinge point) with E.out and lift it 4 px. Repeat it faster on a second card (a 7 f pop instead of 12 f) so the second read is snappier, and put a 'pop' or 'snap' event on each pop frame.

## Original timing
Build 14 f E.in to 1.5x. Dip 12 f E.out to 0.8x, with the shackle at -30 degrees. Pop 12 f (7 f on the repeat) with a hitPulse(t, 3, 6) brightness pulse and a 2.4% scale pulse. About 38 f in all.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
