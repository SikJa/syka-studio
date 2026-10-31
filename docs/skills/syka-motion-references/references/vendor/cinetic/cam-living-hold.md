# Living hold creep

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · cam-living-hold
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: camera; energy: calm; role: workhorse; formats: any

## Mechanism
Under every hold the frame keeps a barely visible push, pull or sideways drift, so no shot sits dead while the viewer reads.

## Use when
Any hold longer than about 30 f: reading a caption, watching a counter, a UI state sitting after an action, the end card.

## Avoid when
A designed freeze of at most 15 f on a silence, or a shot where a big camera move or a travelling cursor already supplies the life. Never stack a creep on top of a punch-in drift on the same axis.

## Original recipe (adapt to Syka native time and nodes)
Set the anchor camera's ax, ay on the focal element so the creep pivots there. Multiply k by breath(prog(f, holdStart, holdEnd, E.linear) * (1 - nextMove), amount), where amount = 0.0005 x the hold length in frames and nextMove is the next move's 0..1 progress, so the next move releases the creep with no velocity step. Push on proof and result shots, pull (negative amount) on busy or chaotic boards, and use a tiny creep on the end card. For type or a single card, drift sideways instead: with g = f - holdStart, sx = sx0 - v * (g - 20 * (1 - Math.exp(-g / 20))), which leaves the seam at zero velocity and reaches v after about 60 f. Keep every layer the camera carries static inside the one transform, so nothing stair-steps on the pixel grid during the creep.

## Original timing
Scale creep 0.04-0.07%/f (+2.4 to +4.2%/s), at most 0.1%/f in a 40-60 f tail after a big push. Pulls about -0.08%/f. End card 0.0125%/f. Lateral drift 0.3-0.5 px/f for UI and cards, 1.5-3 px/f for big display type. E.linear once at speed, with a 20 f exponential ease-in from a seam. Released over the next move's own ease.

Upstream evidence count: 5; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
