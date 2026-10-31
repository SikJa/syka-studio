# Library

Use this catalog before selecting or making a reusable file. References define the style;
bundled files apply it. Keep one-off project media with its project.

## Components and shared values

| File | Use | Notes |
| --- | --- | --- |
| `assets/components/tokens.ts` | Share default color, type, spacing, and safe-area values | Keep it in sync with `design.md`; override values in the project copy, not here |
| `assets/components/title-card.tsx` | Add a title and optional qualifier | Follow title and subtitle limits in `design.md` |
| `assets/components/lower-third.tsx` | Add a name and detail over footage | Keep both lines inside the text safe area |
| `assets/components/callout.tsx` | Add a short label and value | Use it for one fact, not a paragraph |
| `assets/components/media-grid.tsx` | Place one, two, or four media sources | A two-up layout stacks in portrait and sits side by side otherwise |

Components do not own a `<scene>`. Read the matching source for its inputs and copy only the
files the project needs.

## Compositions

| File | Use | Format | Required inputs |
| --- | --- | --- | --- |
| `assets/compositions/product-demo.tsx` | A single capture with a lower third | 9:16 | `videoSrc`, `name`, `detail` |
| `assets/compositions/product-tour.tsx` | Full frame to two-up to four-up and back | 16:9 by default; may use 9:16 or 1:1 | Four media sources, `name`, `detail` |
| `assets/compositions/end-card.tsx` | A plain end card | 9:16 | `title`, `cta` |

Compositions own `<scene>`, timing, and editable inputs. They are starting points, not a second
component system.


## Select media

Use catalog entries and filenames to shortlist likely matches. Inspect those candidates first,
and widen the search only when needed.

## Add to the library

Add a reusable item once it has a clear repeated use. Give a component one job and a small
input set. Add a composition when the scene flow repeats.
