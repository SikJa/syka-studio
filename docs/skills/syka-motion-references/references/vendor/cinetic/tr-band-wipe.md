# Band wipe

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · tr-band-wipe
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: transition; energy: medium; role: accent; formats: feature, launch, walkthrough, loop

## Mechanism
A band crosses a region (snapping up, lingering, then whipping off, or sweeping across a chart) and the content changes along its edge: the old state is erased under it and the new state draws in its wake.

## Use when
Swapping a data series, a filter result or a big-type card in place, when a control's tap should visibly cause the change.

## Avoid when
Applied to whole scenes again and again (it becomes a preset wipe), or when the band would cross text the viewer has not finished reading.

## Original recipe (adapt to Syka native time and nodes)
Clip both states to the region and drive one band position b(f). The old state stays clipped to the side the band has not reached (clip-path: inset(0 0 0 b px)), and the new state draws in behind it (a line chart's stroke-dashoffset follows b). In the full look the band is a luminous light core falling off through a warm hue, screen-blended over the content. Sweep profile: a 368 px band crosses a chart at a constant 60-70 px/f (prog with E.linear, about 27 f for a 1400 px chart plus the band), starting 2 f after the control that caused it (a tab) lands, never easing out, until the chart edge cuts it off. Hang-time profile, for a full-frame band behind giant type: the bottom edge goes from 81% to 66% of frame height over 6 f on E.out, 66% to 53% over 20 f at constant speed, and 53% to 0 over 16 f on E.contact. In the hang-time profile the band's edges are flat mask edges, so they may pass 80 px/f; nothing textured rides on them.

## Original timing
Sweep: 368 px band at a constant 60-70 px/f (about 27 f across a 1400 px chart), starting 2 f after the cause. Hang-time: 6 f (E.out) + 20 f (constant speed) + 16 f (E.contact) = 42 f. The new state draws in within 6-10 f after the band passes.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
