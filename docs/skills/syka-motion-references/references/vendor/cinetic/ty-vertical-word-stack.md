# Vertical word stack

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ty-vertical-word-stack
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: typography_motion; energy: medium; role: workhorse; formats: vertical

## Mechanism
In a tall frame each new word lands on its own line under the last while the stack rises one line, so the newest word always sits on the optical centre.

## Use when
Vertical cut-downs where a horizontal line would be too small; speaking-pace statements on a phone-sized frame; one word per beat.

## Avoid when
16:9 masters (use ty-recentre-line-build); statements over 6 words; stacking two separate statements.

## Original recipe (adapt to Syka native time and nodes)
Line pitch 1.05x the font size (110-140 px statement type in 9:16), lines left- or centre-aligned inside safeBox() so the stack clears the feed zones. Word k lands at land_k: translateY +0.35 em -> 0 on arrive(prog(f, land_k, land_k + 18, E.out)), opacity 0 -> 1 over 6 f; the stack container moves up by the sum over k of pitch x spr(f, land_k, SPR.firm), peaking at about 11 px/f for a 150 px pitch. Lines more than two steps old fade out through a feathered top mask (mask-image transparent -> opaque over the top 0.8 pitch), so at most 3 words of one statement are on screen; the final word may arrive in the accent and relax to ink.

## Original timing
A word every 24-30 f; word rise 18 f E.out; stack step SPR.firm (97% in 27 f); at most 3 lines visible; final hold at least 36 f + 6 f per word with a 0.3 px/f drift.

Upstream evidence count: 0; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
