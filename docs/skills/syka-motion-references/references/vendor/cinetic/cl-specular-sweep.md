# Specular sweep

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · cl-specular-sweep
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: color_and_light; energy: calm; role: workhorse; formats: launch, sting, feature, loop

## Mechanism
A soft bright band glides once across a settled number, word or logo face, so the element looks locked and made of a real material without moving.

## Use when
A final number, price or logo that has landed and must hold attention through a still beat, or loading and generating labels.

## Avoid when
The element is still moving, or you would need more than one sweep in the shot (it turns into decoration).

## Original recipe (adapt to Syka native time and nodes)
Duplicate the settled text or mark and fill the duplicate with linear-gradient(100deg, transparent 0, C.white at 35% alpha 50%, transparent 100%). Make the band about 40% of the text height wide (about 30% of the width for a logo glyph, with peak opacity up to 0.9), clip it to the glyphs with background-clip: text or an SVG mask, and use mix-blend-mode: screen on dark stages. Drive the band's x from -20% to 120% of the element width on E.smooth, so its speed peaks mid-sweep, starting 6-10 f after the element lands. For a looping working state, use a light-grey label with a 120 px lighter band whose background-position is (frame % 60) / 60 on E.linear, and stop it on the frame the state resolves. Keep the sheen inside the glyphs, with no blur or halo outside them.

## Original timing
A one-shot sweep takes 36 f on E.smooth (about 16 px/f mid-sweep, peaking near 26 px/f). A logo glint brightens over 9 f, holds about 11 f and is clear by 36 f. The loop has a 60 f period on E.linear and is held for up to about 74 f before the result.

Upstream evidence count: 4; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
