# Centre-out line unmask

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ty-centre-out-unmask
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: typography_motion; energy: calm; role: workhorse; formats: feature, walkthrough, launch, loop

## Mechanism
A short line opens from its own centre outward behind a soft-edged mask while the letters stay perfectly still, so a result or status reads as unveiled rather than flown in.

## Use when
A result, status or confirmation line under a centred icon ('Published', 'Connected'). A hero word inside a pill that has just formed. A calm sub-line under a headline that has already landed.

## Avoid when
Lines over about 40 characters (the edges take too long to reach the ends). Left-aligned layouts (wipe from the left edge instead). Text that is also moving, where the mask fights the glyph motion. Headlines that need energy.

## Original recipe (adapt to Syka native time and nodes)
Lay out the final centred line, get its width w from measureTracked, and keep every glyph static. Reveal it with a horizontal mask on the line box: o = w x prog(f, s, s + 18, E.out), and mask-image: linear-gradient(90deg, transparent (50% - o/2 - 20px), #000 (50% - o/2), #000 (50% + o/2), transparent (50% + o/2 + 20px)), computed in px each frame, so both edges travel outward with a 20 px feather (a hard clip-path: inset(0 calc(50% - o/2)) is fine inside a pill). Over the same window, run opacity 0.6 -> 1 and letter-spacing +0.04 em -> the token's tracking on E.out, so the line tightens as it opens. Set it under a centred icon or check that has just landed, starting 4-6 f after the icon's landing frame; for a second line, open it 6 f after the first. Keep the hold alive with a drift of at most 0.3 px/f, and exit with the whole line over 12 f on E.smooth or with ty-reading-order-exit.

## Original timing
Unmask over 18 f on E.out (31% of each half-width opens on frame 1), with a 20 px feather. Opacity 0.6 -> 1 and tracking +0.04 em -> token over the same 18 f. Starts 4-6 f after the icon lands; a second line follows at +6 f. Hold at least 36 f + 6 f per word, drifting at most 0.3 px/f. Exit over 12 f on E.smooth.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
