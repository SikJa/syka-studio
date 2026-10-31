# Rolling band flood

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · cl-rolling-band-flood
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: color_and_light; energy: medium; role: signature; formats: launch, feature

## Mechanism
A light frame fills with the brand colour as soft horizontal bands of it roll upward and grow opaque. The text tints and dissolves into it, and the film arrives on its end-card field without a cut.

## Use when
Closing a light product act into the end card, or returning to the brand world after the last UI beat (a success state, a published page) without a hard cut.

## Avoid when
Dark films, where the flood reads as fog over black. Also avoid it a second time in the same film, and before an end card whose ground is not the flood's hue.

## Original recipe (adapt to Syka native time and nodes)
Over the last product frame, add a full-frame overlay holding a strip three frames tall: a linear-gradient(to bottom) that repeats six soft tonal bands of one hue (mixColor(C.accent, C.paper, 0.7), then 0.45, then 0.2, then C.accent, then back up). Make each band about half the frame height, with its stops blending over about 10% of the band. Drive the strip's translateY from 0 to -1 frame height on E.linear, so the bands roll up at constant speed. Drive its opacity with p * p, where p = prog(f, a, a + 60, E.linear), so the colour arrives late and decisively (quarter strength at the halfway point). Mix the foreground text to mixColor(C.accent, C.ink, 0.4) over the first 12 f, then fade it from 1 to 0 over f12-f40 on E.smooth, so the colour absorbs it rather than covering it. End on the end-card field, with the same bands slowing to a 0.3 px/f drift, and let the lockup appear on it afterwards. Bake the strip once with scripts/dither-gradient.py (space oklab) so the soft bands do not contour. In full colour, the flood runs through several hues.

## Original timing
60 f in total. The bands roll one frame height on E.linear (about 18 px/f at 1080p), and the opacity follows p^2 over the same 60 f. The text tints over 12 f and fades over f12-f40 on E.smooth. Frame mean luma goes from about 250 to 215: a light-to-mid flood, not a polarity flip. The bands then ease to a 0.3 px/f drift for the end card's 90-120 f.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
