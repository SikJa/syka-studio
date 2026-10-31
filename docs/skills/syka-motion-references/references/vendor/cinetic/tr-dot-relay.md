# Collapse to a dot relay

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · tr-dot-relay
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: transition; energy: medium; role: signature; formats: launch, feature, sting

## Mechanism
The hero collapses into one small dot, or the whole world shrinks into it. The dot, the only thing that survives, opens into the next object: a check ring, an avatar, the mark.

## Use when
Submit, send, process, receive: actions that mean 'this went in and came out as that'. Also the film's signature device when the mark contains a dot.

## Avoid when
The dot would blink out or change size or colour at the seam, or the film already has an implosion seam.

## Original recipe (adapt to Syka native time and nodes)
Collapse the hero (a card, a prompt box, or the detached dot of an i) to a 24-52 px dot: width and height go to the dot size and border-radius to 50%, over 4 f on E.in when it feeds a cut, or 16 f on E.out when it snaps and holds. To take the world with it, start 15 f later and scale the world group with k = lmix(1, 0.03, prog(f, s, s + 24, E.contact)) about the dot centre, over the next stage colour. Its corner radius grows to 50% and its mask edge is feathered 40 px; unmount it once it is smaller than the dot. The dot stays at full opacity through the seam (one absolute-frame function, or a hard cut that holds it on the same screen point). Then it opens into the next object: a check ring (stroke-dashoffset 1 → 0 and scale 0.6 → 1 over 8 f on E.out, its label 4 f later), an avatar disc (fill ramps paper → ink linearly over 12 f, icon fading in over the last 4 f), or the mark.

## Original timing
Collapse: 4 f (E.in, into a cut) or 16 f (E.out, snap and hold). World shrink: 24 f on E.contact for a dot near centre (edges ≤ 66 px/f), or 40 f for a dot near a corner, starting 15 f after the collapse. Reopen over 8-12 f. Any device rotation that follows settles over 28 f on E.out.

Upstream evidence count: 3; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
