# Story object becomes the mark

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · le-device-becomes-mark
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: logo_and_end_card; energy: any; role: workhorse; formats: any

## Mechanism
The film's last object (a dot, circle, coin or pill) ends at exactly the mark's screen position and size, and the mark replaces it by a hard cut or an in-place morph, so the logo arrives as the answer to the story.

## Use when
Every film that has a story device: the default way to arrive at the mark, especially as the device's third and final use.

## Avoid when
There is no recurring object (a mark forced out of an unrelated shape reads as a pun). The object's shape and the mark's disagree (a square into a circle needs a morph, never a cut).

## Original recipe (adapt to Syka native time and nodes)
Compute the mark's final rect first (placeMark). Drive the story object so its last frame lands on that rect, or on 0.57 of it for the cut-and-grow ending, with matched centre, size, radius and colour. Examples: a coin turning rotateY 90 -> 10 deg on E.outSoft while it rises 20% of H; a word deleting from both ends (slice(k, n - k), k + 1 every 5 f) while its pill hugs the text down to a circle; a pill whose width collapses to the icon's rounded square (Morph on E.inOut). Then either hard-cut to the flat mark at exactly the object's last position and size (0.57 of the rect) and grow it lmix(0.57, 1, prog(f, cut, cut + 18, E.out)) about its centre, with half the growth in the first 2 f and no overshoot. Or finish in place: the dot's fill darkens to the mark's ink (mixColor over 12 f on E.smooth) and its glyph fades in over the last 4 f. Nothing may blink, double or change style across the seam, not even for one frame.

## Original timing
Coin flip: 22 f on E.outSoft. Two-ended delete: 5 f per letter pair, pill width eased 4 f per step on E.ui. Pill-to-square morph: 30-40 f on E.inOut. Cut pop: 18 f on E.out (0.57 -> 1). In-place darkening: 12 f. Then hold ~20 f before the name follows.

Upstream evidence count: 4; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
