# Isolating push into one item

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · cam-isolating-push
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: camera; energy: medium; role: workhorse; formats: feature, walkthrough, launch

## Mechanism
The camera pushes into one row, card or column while everything around it fades, dims or slides off the edges, picking a single thread out of a busy layout.

## Use when
Choosing one result from a list of parallel processes, moving from a typographic act into a UI close-up without a cut, or steering the eye to where the next action will happen.

## Avoid when
The item is still too small to read at 4x, or the surrounding layout carries information the viewer still needs.

## Original recipe (adapt to Syka native time and nodes)
Anchor the push on the chosen item and pick a preset. Dive: k x lmix(1, 4, prog(f, a, a + 80, E.smooth)) while sibling rows fade from 1 to 0 opacity over 20 f from a; as the push ends, the item's icon dims to 0.3 and the next state swaps in on a whole frame (fd), a zoom-through without a cut. Accelerate-through: k x lmix(1, 1.25, prog(f, a, a + 60, E.in)) while the surroundings fade to the background colour over 16 f, then cut or swap on the peak frame. Eject: k x lmix(1, 1.48, prog(f, a, a + 30, E.smooth)) and then +4% over 60 f on E.linear, the flanking words taking blurOut text blur up to 6 px once they pass 80% of the half-width on their way off frame. Gentle focus: wrap the side columns in RackFocus (t 0 -> 1, blur 8) and dim them to 0.6 opacity while the parent pushes x1.06 over 18 f on E.smooth.

## Original timing
Dive 80 f, x4 on E.smooth (peak about 5%/f), sibling fades 20 f, swap on the last frame. Accelerate-through 60 f, x1.25 on E.in, surround fade 16 f. Eject 30 f, x1.48 on E.smooth, then +4% over 60 f. Focus pull 18 f, x1.06, blur 8 px, opacity 0.6, running straight into the next move.

Upstream evidence count: 3; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
