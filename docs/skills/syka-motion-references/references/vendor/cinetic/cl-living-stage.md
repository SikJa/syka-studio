# Living gradient stage

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · cl-living-stage
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: color_and_light; energy: calm; role: accent; formats: any

## Mechanism
Behind static cards the background never freezes: soft pools of colour at the corners breathe in brightness or drift slowly, like light through water.

## Use when
Holds, end cards and statement cards that would otherwise sit still for more than 48 f.

## Avoid when
Busy UI shots where any background motion competes, or films built on a hard flat-stage look. Behind a product window or readable type, where soft pools read as a generic gradient backdrop or as haze; light stages, where they read as smudges. A flat stage with one tonal step is the stronger default.

## Original recipe (adapt to Syka native time and nodes)
Start from a C.ink base with two or three huge pools (radius 55-60% of the frame, for example one centred at 85% 15% and one at 10% 95%) in dark tints of one allowed hue (never violet, warm brown or a multi-hue mesh), each baked once as an RGBA PNG with scripts/dither-gradient.py rather than drawn as a CSS radial-gradient under a live blur(), which bands at 8 bits and costs render time. Breathe mode: each pool's opacity moves between 0.85 and 1.0 on sin(2π·frame/162), the second half a period out of phase, with no translation (about ±15% luma). Drift mode: 4-5 pools, each centre moving ±6% of the frame on sine loops of 360-660 f at different phases, with opacity ±8%. The pools light the stage, never an element: none sits centred behind type or a card. Let the film's global 1.5-2% grain sit over it, and give the stage an intensity prop (0-1) so brand beats (open, tagline, end card) raise it while UI beats sit on flat C.ink.

## Original timing
The breathe period is 162 f. Drift loops run 360-660 f, at under 1 px/f. On brand beats the stage rises over 50 f on E.out (translateY +40% to 0) and drains to flat in 8 f.

Upstream evidence count: 7; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
