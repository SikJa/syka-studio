# List narrows with each keystroke

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · pd-live-filter-narrows
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: product_demo; energy: medium; role: workhorse; formats: feature, walkthrough, launch

## Mechanism
A shortcut opens a command palette or search field, and as the query types the list answers every key: non-matching rows fold away, survivors slide up, matched letters ink in, and the highlight rides the top result until Enter.

## Use when
Search, command menus, filters and pickers: any product whose speed claim is 'type a few letters and it is there', proving instant results without a spinner.

## Avoid when
The rows are illegible at frame size (punch in first), or the query is long (past about 12 characters it becomes a typing beat); do not FLIP more than about ten rows at once.

## Original recipe (adapt to Syka native time and nodes)
Open with the shortcut if the product has one: two key chips (FONT.mono labels, 1.5 px C.line border, 3 px bottom edge) appear 4 f apart and press together with pressAt, and on the press frame the palette scales 0.96 → 1 about its top centre with opacity over 10 f on E.outSoft while the app behind racks to 8 px through RackFocus under a 20% C.ink veil over 12 f. Type the query with TypeOn at 30-40 cps and recompute the matches from the data on each key frame (typeFrames(), decided on fd(f)), so the list is a pure function of the characters typed: rows that stop matching fold from row height to 0 over 10 f on E.ui with their opacity gone in the first 6 f, and survivors FLIP to their new slots from the computed list layout over max(12, 0.14 × distance) f on E.ui, so no label passes 20 px/f. In every surviving label the matched characters switch to C.ink on the key frame while the rest drops to C.mute (colour only, never weight, so nothing reflows), and one shared highlight (C.mist, 8 px radius) always sits behind the top result and FLIPs to its new rect over 8 f on E.ui. On Enter (a single chip press) the chosen row takes a C.accent 12% tint for 6 f and the palette closes, scale 1 → 0.98 with opacity out over 8 f on E.smooth, while the result mounts underneath on the press frame.

## Original timing
Chips 4 f apart, press 4 f down + 8 f recoil; palette 10 f on E.outSoft, backdrop rack and veil 12 f; query 30-40 cps; row fold 10 f on E.ui (opacity 6 f); survivor FLIP max(12, 0.14 × px) f on E.ui; highlight 8 f on E.ui; 4-7 keys narrow 8-10 rows to 1-3; final list held 24-36 f under a 2% breath before Enter; close 8 f.

Upstream evidence count: 0; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
