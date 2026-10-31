# Stepped column fill

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · tr-stepped-column-fill
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: transition; energy: medium; role: accent; formats: sting, launch, loop

## Mechanism
Columns rise from the bottom edge in a stepped pyramid centred under the hero, spreading outward until they close into one solid field that becomes the next stage behind it.

## Use when
Marks built from bars, steps or pixels; data and analytics products, where the columns read as a chart; stings and loop intros that change the stage colour behind a held hero.

## Avoid when
As a general scene change between unrelated shots (it reads as a preset blinds wipe), behind small readable type, or more than once per film.

## Original recipe (adapt to Syka native time and nodes)
Split the frame into N equal columns with no gutters, layered below the hero: 12-16 at 1920 px, or the hero's own grid unit so they line up with the bars or pixels of a mark. Column i starts d_i = |i − c| · 2 f after the first, where c is the column under the hero's centre. It rises from the bottom edge with height = H · prog(f, s + d_i, s + d_i + 40, E.smooth), so the tops form a stepped pyramid that widens outward. Fill each column with the next act's stage colour; in its full look every column carries a multi-hue vertical ramp. The columns are flat mask edges on a flat fill with nothing textured on them, so their tops may peak near 76 px/f. The hero keeps a living-hold creep throughout. Where the field rises behind it, draw a second copy of the hero in the opposite tone clipped to the union of the column rects (built by the same geometry function), so the hero flips tone exactly where a column stands behind it, with no fade. On the frame the outermost column fills, swap the column layer for one plate of that colour and land that frame on a downbeat. The hero answers it with scale 1 + 0.02 · hitPulse(f − close, 2, 5), or with its next build step.

## Original timing
Each column rises over 40 f on E.smooth (tops peak at about 76 px/f at 1080p). Stagger 2 f per column outward from the centre (7 steps for 14-15 columns), about 54 f in all. The field closes on a downbeat and swaps to one flat plate on the same frame. Hero pulse: attack 2 f, tau 5 f.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
