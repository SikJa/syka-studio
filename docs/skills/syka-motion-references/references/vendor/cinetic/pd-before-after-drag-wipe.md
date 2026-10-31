# Before/after drag divider

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · pd-before-after-drag-wipe
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: product_demo; energy: medium; role: accent; formats: feature, launch, walkthrough

## Mechanism
The cursor grabs a vertical divider on the product and drags it across, wiping away the old state to reveal the new one in the same layout.

## Use when
Redesigns, image or audio cleanup, performance gains, any this-got-better claim with a visible difference.

## Avoid when
The two states differ in layout (the wipe then reads as a glitch); the difference is invisible at frame size; the film has no human gesture anywhere else.

## Original recipe (adapt to Syka native time and nodes)
Stack two renders of the same layout: before below, after above, clipped with clip-path inset(0 0 0 X px) where X is the divider's position; draw the divider as a 2 px C.white line (C.ink on paper) with a 40 px round handle holding two small chevrons. The cursor arrives on cursorArc over 36-48 f on E.out, presses the handle (pressAt) and drags it across the product panel on E.smooth over 60 f (≈ 1,100 px, peak ≈ 52 px/f). Optionally it pauses once at the midpoint for up to 24 f under a breath push so both states read side by side. Values that differ between the states change exactly where the divider passes them, because they sit on separate layers, so the halves are never crossfaded.

## Original timing
Cursor approach 36-48 f on E.out; press 4 f down, 8 f recoil; drag 60 f on E.smooth, or 36 f to the midpoint on E.glide (peak ≈ 46 px/f), a hold of ≤ 24 f, then 36 f on to the edge.

Upstream evidence count: 0; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
