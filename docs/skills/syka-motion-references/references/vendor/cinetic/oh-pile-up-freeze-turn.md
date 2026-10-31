# Problem pile-up, freeze, turn

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · oh-pile-up-freeze-turn
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: opening_hook; energy: high; role: workhorse; formats: launch, feature, vertical

## Mechanism
The film opens inside the problem: cards, alerts or rows pile in faster and faster while a counter climbs, the picture freezes for a breath of true silence, and the turn hits on the downbeat.

## Use when
Problem-first launches whose pain is volume: notifications, tickets, tabs, invoices.

## Avoid when
The pain is not about quantity, the brand film is calm, or the film already uses its one freeze elsewhere.

## Original recipe (adapt to Syka native time and nodes)
Frame 0 already holds 2-3 overlapping cards. Arrival k comes gap_k = max(4, 14 * 0.88^k) frames after the previous one, so the pile accelerates, and each card rises from +40 px on SPR.firm with opacity over 8 f on E.smooth and a slight rotation of rand(k) * 6 - 3 deg. A corner counter climbs with Roll and countSteps(..., E.in) while the camera's k is multiplied by breath(prog(f, 0, end, E.in), 0.04). At peak density comes a designed freeze of at most 15 f, with the picture held and the bed and every tail cut dead; then the turn lands on the next downbeat b(...): the pile implodes on E.in, or the frame cuts to the answer. Sound: one soft tick per card, each 1 dB louder than the last, ending in the silence.

## Original timing
14 arrivals in about 100 f (gaps 14, 12, 11, 9.5, 8.4 ... down to 4 f); freeze of 15 f at most; turn on the next downbeat.

Upstream evidence count: 0; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
