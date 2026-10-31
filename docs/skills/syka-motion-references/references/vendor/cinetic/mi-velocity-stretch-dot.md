# Velocity-stretch dot

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · mi-velocity-stretch-dot
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: micro_interaction; energy: medium; role: signature; formats: feature, walkthrough, launch, loop

## Mechanism
A small round dot (a cursor or a list marker) stretches into a capsule along its motion in proportion to its speed, anchored at its trailing end, and shrinks back to a dot when it stops.

## Use when
A tiny element must lead the eye across a slab or down a list, and needs speed, direction and character.

## Avoid when
UI truth requires a standard system arrow, or several dots would stretch at once (the trick only reads once).

## Original recipe (adapt to Syka native time and nodes)
Compute the head H(f) from an eased path, clamped to its start position before the move. Compute the tail as a pure-function exponential follow: T(f) is the sum over i = 0..29 of 0.8^i * H(f - i), divided by the sum of 0.8^i, which gives a lag of about 4 f. Draw an SVG line from T to H with strokeLinecap round, strokeWidth equal to the dot diameter, a flat fill and no shadow. Size it at 3.3-5.3% of frame height for a cursor (C.white on dark), or 18-21 px for a list marker (C.accent). Marker mode: drop it in from the top edge over 31 f E.out, so it arrives as a long streak that shortens into the dot. Hop it 54 px to the next item over 22 f E.smooth on a 54 f cadence, with the active label mixing from C.mute to C.ink over 8 f around the hop midpoint. Exit by stretching it into a dash about four times the dot's length (about 84 px for a 21 px marker) over 17 f on E.smooth, then shoot it off with E.in. The stretch is the streak, so draw nothing behind it.

## Original timing
Tail weights 0.8^i over 30 f (a lag of about 4 f): length about rest + 4-5.5 f x speed, back to a dot in 16-20 f. Marker: drop 31 f E.out; hop 54 px in 22 f E.smooth every 54 f; label colour 8 f; exit: stretch to an ~84 px dash over 17 f (E.smooth), then off on E.in.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
