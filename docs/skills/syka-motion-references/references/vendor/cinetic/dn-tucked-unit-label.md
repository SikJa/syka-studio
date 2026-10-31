# Tucked unit under the last digits

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · dn-tucked-unit-label
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: data_and_numbers; energy: calm; role: accent; formats: any

## Mechanism
A small lowercase unit word fades in right-aligned under a big number's last digits, its top overlapping the numeral's baseline, so number and unit read as one mark.

## Use when
A hero figure needs its unit (views, users, ms) without a second line pushing the layout down.

## Avoid when
The unit is longer than one short word; numbers ending in narrow digits (1, 7) that leave no room to tuck under.

## Original recipe (adapt to Syka native time and nodes)
Set the unit at 0.35x the numeral's font size in the film's one sans (weight 450, C.mute or the stage's secondary ink). Align its right edge with the numeral's right edge (measureTracked, minus the last glyph's trailing tracking) and its top with the numeral baseline minus 0.3x the label's line height, so it tucks under the last two digits. Fade it in over 19 f on E.smooth with a 4 px rise through arrive, starting at least 12 f after the number settles so the figure reads first. It then holds with the number under the shot's breath.

## Original timing
Starts at least 12 f after the number settles (36 f is a good default). Opacity over 19 f on E.smooth with a 4 px rise via arrive. Label at 0.35x the numeral size, overlapping its baseline by 30% of the label height.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
