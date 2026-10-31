# Travelling tone band fill

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · cl-tone-band-fill
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: color_and_light; energy: medium; role: accent; formats: launch, sting, feature

## Mechanism
A word, URL or logo mark fills through a band of colour (dark, then accent, then light) that sweeps across it and settles on the final ink.

## Use when
Hero words, the URL card, or a logo mark that should introduce the accent before it fills the frame.

## Avoid when
Small UI text, or type that is still moving (the band and the motion fight).

## Original recipe (adapt to Syka native time and nodes)
Text: set background to linear-gradient(90deg, final ink 0 35%, light accent tint 50%, C.accent 65%, stage colour 80%) at background-size 300%, with background-clip: text and color: transparent, and animate background-position from 100% to 0%. For a domain plus path, delay the path span. For accent words in a tagline, step each letter from ink to C.accent with a 2 f stagger after the line lands. Mark: use the mark as an SVG mask over a tall gradient rect, reveal the fill bottom-up with clip-path from inset(100% 0 0 0) to inset(0), then translateY the rect by one gradient period so the tone scrolls and settles on solid accent, just before the colour floods the frame. The type itself stays still; only the fill travels.

## Original timing
A word sweep takes 32 f on E.smooth (the front peaks at about 25 px/f). A URL takes 42 f, easing into the final ink on E.out, with the path lagging 8-12 f. A mark wipe takes 8 f on E.linear, then the tone scrolls for 36 f on E.smooth. Letters stagger 2 f.

Upstream evidence count: 3; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
