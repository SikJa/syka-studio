# Lockup keeps building through the hold

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · le-living-hold
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: logo_and_end_card; energy: calm; role: workhorse; formats: any

## Mechanism
Once resolved, the lockup never freezes: the card slowly pushes in (or exhales back), the tracking tightens a touch and the stage dims, so the last 1.5-2 s read as intentional rather than stalled.

## Use when
Every lockup and URL hold, and any card that must sit for more than 48 f.

## Avoid when
A designed freeze of at most 15 f on a silence (then stop everything, the push included). Loops whose hold must end at the frame-0 scale (ease the push back down instead).

## Original recipe (adapt to Syka native time and nodes)
Wrap the whole end card in one camera transform and push it about the lockup's optical centre with k = lmix(1, 1.15, prog(f, resolve, end, E.dolly)), a 10-20% push. Under that, tighten the name's letter-spacing from +0.03-0.06 em to its token track over 46 f on E.out, starting at its resolve. For a calm close, use the exhale instead: k = lmix(1, 0.9, prog(f, resolve, resolve + 120, E.out)) while only the stage dims to 35% over 36 f on E.smooth. The lockup stays at full strength to the last frame, because the last frame is the poster and never fades to black.

## Original timing
Hold 90-120 f (1.5-2.0 s, never more than ~150 f). Push 10-20% over the hold on E.dolly. Tracking: 46 f on E.out. Exhale: 10% over 120 f on E.out, with a 36 f stage dim. Tail of at least 60 f after the last event, inside the hold.

Upstream evidence count: 4; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
