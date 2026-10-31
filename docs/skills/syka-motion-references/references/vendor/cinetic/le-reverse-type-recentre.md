# Name types backwards, group stays centred

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · le-reverse-type-recentre
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: logo_and_end_card; energy: calm; role: accent; formats: launch, feature, sting, vertical

## Mechanism
The name appears from its last letter to its first while the mark is pushed outward, so the lockup grows out of the mark's edge and stays centred on every frame.

## Use when
Agent, assistant or persona products whose mark is an avatar or a disc. Names of 4-12 characters. A centred lockup that must never jump.

## Avoid when
Two-word names whose second word makes no sense on its own first. Right-to-left scripts (it becomes an ordinary type-on). The headline already used a typewriter.

## Original recipe (adapt to Syka native time and nodes)
Lay out [mark][gap][name], with every character laid out from the start and untyped characters at opacity 0. Measure each character's advance with measureTracked. Character i of n shows from frame t0 + 3.5 * (n-1-i), decided on fd, with a 4 f opacity ramp on E.ui, so the name grows leftward from its last letter. Keep the group centred without stepping: markLeft = cx - (markW + gap + ws(f))/2, where ws(f) = sum of adv_k * spr(f, t_k, SPR.firm) over the characters revealed so far. That is one critically damped spring per character, which glides the mark outward as each letter lands. If the story device is a dot, let it become the mark in place first: fill mixColor(C.mist, C.ink, p) over 12 f on E.smooth, with the glyph inside fading in over the last 4 f.

## Original timing
3.5 f per character (10 characters in 36 f), each fading in over 4 f on E.ui. Each width step eases on SPR.firm (no overshoot, ~20 f to settle). The mark travels ~270 px at 7-8 px/f on average. Dot-to-mark darkening takes 12 f. The lockup settles ~20 f after the last character, then holds 90-120 f under a 10-15% push (le-living-hold).

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
