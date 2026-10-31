# Visual guide

Define color, type, imagery, layout, safe areas, and captions. Use `video.md` for motion and sound, `voice.md` for words, and `library.md` for reusable files.

Scale every pixel value below from a short edge of 1080.

## Visual principles

- Build structure with scale, weight, spacing, and luminance.
- Keep the frame near-achromatic. Use color only when it carries meaning.
- Show the subject clearly. Do not decorate over controls or content the viewer must read.
- Prefer one clear focal point to several equal points.

## Color

Default to this dark, neutral palette.

| Role | Value |
| --- | --- |
| Background | `#000000` |
| Surface | `#161616` |
| Text | `#F8F8F8` |
| Text, secondary | `#A4A4A4` |

The palette has no accent of its own. When the piece needs one, take it from the subject: a
color already present in its footage, interface, or supplied material. Use one accent per piece,
on at most one element per shot, and never for a title or a large fill. Beside captured UI, avoid
an accent that reads as one of that interface's states, such as red for an error.

Invert the palette for a piece whose footage is predominantly light. Place text on a plain
background or surface color. Do not rely on a shadow or stroke for contrast.

## Typography

Default to `Geist`, with `Geist Mono` for code and figures. Any one clean sans-serif family may
replace it when the subject suggests another; keep to one family plus its mono companion. Do not
use italic.

| Role | Size | Weight | Copy limit |
| --- | ---: | ---: | ---: |
| Title | 96 | 600 | 32 characters |
| Subtitle | 60 | 400 | 64 characters |
| Lower-third name | 48 | 500 | 28 characters |
| Lower-third detail | 30 | 400 | 40 characters |
| Label | 24 | 500 | 16 characters |

Sizes and weights are starting points; keep their order and rough ratios when adjusting them.
Rewrite copy that exceeds a limit instead of shrinking the type. Confirm that the chosen fonts
are available before final output; no font files are bundled.

## Captured imagery

- Show real product UI rather than a reconstruction or recolor.
- Use `contain` when viewers must read the whole interface.
- Use `cover` only when the crop cannot hide a control, label, or result needed for the point.
- Keep captures sharp and at their native aspect ratio.
- Use a plain surface around captures instead of stretching them to fill a frame.

## Layout and aspect ratios

Use a margin of 64 and a gap of 40. Use other spacing in multiples of 8: 16 between a label and
value, 24 between lines in one block, and 40 between separate blocks.

Use a corner radius of 24 on framed media panels. Do not round full-frame media.

Left-align copy and anchor it low. Center copy only when it stands alone on a plain background.
Use at most two text elements in one shot: a primary line and its qualifier.

Use these media forms:

- **Full frame:** one view or one dominant subject.
- **Two-up:** two states, inputs, speakers, or before-and-after views.
- **Four-up:** a set of equal details that remain legible at delivery size.

Keep two-up panels square when the source allows it. Place them side by side in 16:9 and 1:1,
and stack them in 9:16. Use a centered 2×2 grid for four-up. Use
`assets/components/media-grid.tsx` for the tested geometry.

### 9:16 text safe area

At 1080×1920, keep readable content inside `x 64–900`, `y 200–1520`. The right 180 is the platform action rail and the bottom 400 is the caption reserve. Graphics may cross these bounds; text may not.

## Captions

Use `stark` for 9:16 output and `cascade` for other ratios. Pass no `colors`; neither preset
exposes color slots. On 9:16, do not add another bottom offset to the preset.

A preset carries its own legibility. Never put a band, plate, or gradient behind captions. When one
does not read over the footage, change the preset or its `verticalAlign` or `offsetY`; if it still does not read,
that is the answer for that stretch, not a reason to dim the picture.
