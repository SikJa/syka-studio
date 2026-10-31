# Toss into a bin with one rebound

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ui-discard-into-bin
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: ui_choreography; energy: high; role: signature; formats: launch, feature, vertical

## Mechanism
Icons or chips are thrown into a container that rises in to catch them, drop through its mouth and peek back out once before settling.

## Use when
A comic or decisive 'throw the old way away' beat: replacing old tools, clearing clutter, deleting the problem.

## Avoid when
Serious, calm or enterprise tone, or the film has already used its two spring landings.

## Original recipe (adapt to Syka native time and nodes)
Layer order, back to front: bin body, thrown items, bin front lip, with the items clipped by a clipPath at the mouth so they vanish inside; the bin rises 160 px on E.out over 24 f. Toss: each item rises about 260 px on E.out over 24 f (about 68 px/f on its first frame), hangs 3 f, then falls about 340 px on E.contact over 22 f while rotateZ goes to +-15 deg (sign from rand(i)) and x eases to the mouth on E.smooth, entering at no more than 70 px/f under the motion-blur pass. Chain variant: chips follow an SVG path into the bin, chip i at path.getPointAtLength(L*E.contact(prog(f, t0 + 5*i, t0 + 5*i + 60, E.linear))) rotated to the tangent (atan2 of a 1 px look-ahead), the element they trail squashed to a 6 px tall tail. Six frames after the last entry the contents peek back up about 24 px on spr(f, hit, SPR.land) and settle within 16 f, the rim takes squash(t), and a low 60 to 30 Hz thud lands on that frame; this counts as one of the film's two spring landings.

## Original timing
Bin rise 160 px, 24 f (E.out). Item rise ~260 px, 24 f (E.out); hang 3 f; fall ~340 px, 22 f (E.contact), <= 70 px/f; tilt +-15 deg. Chain: 60 f per chip (E.contact along the path), 5 f lag. Rebound at +6 f, ~24 px, SPR.land, settled in 16 f.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
