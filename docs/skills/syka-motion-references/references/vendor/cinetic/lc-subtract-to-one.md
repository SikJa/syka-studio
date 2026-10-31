# Subtract to the one

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · lc-subtract-to-one
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: layout_and_composition; energy: medium; role: workhorse; formats: launch, feature, walkthrough

## Mechanism
A busy board loses its elements one by one until a single survivor remains, which either re-centres or stays exactly where it was while the world around it dims.

## Use when
Isolating the deliverable, the found result or the keyword before entering its world; turning a crowded problem state into one focus.

## Avoid when
The removed elements are themselves the message (show them first), or the survivor is small enough to float lost in an empty frame (push in after isolating it).

## Original recipe (adapt to Syka native time and nodes)
Staccato version: keep an array of tiles and an index that drops by one at keyframes 5-7 f apart, decided with fd(). Recompute the centred flex layout for each state with no tween, so the survivors jump to their new centred positions on each removal, and hold the last one for 17 f with a +0.5% scale drift. Graded version: duplicate the survivor into a top layer at identical coordinates, fade every neighbour over 12 f on E.smooth, then darken the stage plate from C.paper to C.ink with mixColor over 10 f on E.in, leaving the survivor crisp in place. Words in a line leave in reading order, each lifting 12 px and fading over 4 f on E.in, 3 f apart; if the survivor must end centred, slide it home with spr(f, s, SPR.soft) once the others are gone.

## Original timing
Staccato: a removal every 5-7 f; last survivor held 17 f. Graded: neighbours fade over 12 f, world dims over 10 f, hold 30 f. Word exits 4 f each, 3 f apart (a line clears in about 12 f). Re-centre 20-40 f on SPR.soft.

Upstream evidence count: 4; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
