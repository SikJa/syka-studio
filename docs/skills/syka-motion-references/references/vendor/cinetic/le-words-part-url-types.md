# Words part, URL types into the gap

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · le-words-part-url-types
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: logo_and_end_card; energy: calm; role: accent; formats: launch, feature, walkthrough

## Mechanism
The closing line splits at its middle, both halves slide outward and dim, the URL types letter by letter into the gap, and the flanks fade so the URL holds alone.

## Use when
The closing line is a two-word phrase or pun built around the product, and the CTA is a URL. Minimal, type-only films.

## Avoid when
Lines longer than ~4 words. Films with no typing anywhere else (it would add a new device at the very end). URLs too long for the gap to open within the safe width.

## Original recipe (adapt to Syka native time and nodes)
Set the closing line as two spans that meet at the centre. Split them apart by +/-(urlWidth/2 + 40 px) over 44 f on E.smooth, with colour mixColor(C.ink, C.mute, p) so they dim but stay legible. From 40% of the split, type the URL centred in the gap with TypeOn: 1 character per 4 f, head fade 4 f, caret hidden once done. After the last key, fade the flanks to 0 over 16 f on E.smooth. Keep the URL still on the card while the card pushes 10-15% on E.dolly; the mark then joins above it, or the URL becomes the lockup's secondary line.

## Original timing
Split: 44 f on E.smooth over 250-300 px (peak 20 px/f or less). URL starts at 40% of the split, 4 f per character. Flank fade: 16 f after the last key. URL readable and still for at least 102 f.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
