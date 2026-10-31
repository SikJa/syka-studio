# Badge count bump

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · mi-badge-count-bump
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: micro_interaction; energy: medium; role: accent; formats: feature, walkthrough, loop, vertical

## Mechanism
A notification badge or counter chip ticks up: the digit rolls to the next value while the badge gives a small pulse, once per increment.

## Use when
Incoming activity (messages, leads, approvals) should register as small, countable events on the UI.

## Avoid when
The count is the hero number of the shot (use a full counter), or increments would come faster than about one per 12 f.

## Original recipe (adapt to Syka native time and nodes)
Draw the badge as a pill (C.accent fill, C.white tabular-nums digit) with the digit in an overflow-hidden slot. On each increment frame c, roll the old digit up and out and the new one in from below, one line height of travel over 8 f, with arrive(prog(f, c, c + 8, E.out)). Pulse the badge scale to 1 + 0.12 * hitPulse(f - c, 2, 5), and retween its width over 8 f E.out when the digit count changes (9 to 10). The badge first appears from its icon's corner (transformOrigin there) on SPR.micro. Space increments unevenly, at least 12 f apart, with a 'tick' of weight 0.3 on each.

## Original timing
Digit roll 8 f E.out; pulse hitPulse(t, 2, 5) x 0.12; width 8 f E.out; first appearance on SPR.micro; increments at least 12 f apart, uneven.

Upstream evidence count: 0; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
