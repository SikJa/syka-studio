# Reveal by subtraction

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · tr-subtract-reveal
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: transition; energy: medium; role: workhorse; formats: launch, feature, walkthrough, sting, loop

## Mechanism
The clutter in front of the hero flies off toward the frame edges or shrinks away, uncovering a hero that was already sitting at its final size behind it.

## Use when
Ending a busy montage on the one stat, card or word. Walkthroughs that change app areas through the product's own window behaviour.

## Avoid when
The hero is not ready behind the clutter (it must never pop in), or the clutter is readable content the viewer has not finished.

## Original recipe (adapt to Syka native time and nodes)
Layer order: the hero at the bottom, static, already at its final size and position; the clutter above it. Each clutter item moves along the vector from the hero's centre through its own centre, its distance scaled by (1 + index × 0.1), on E.contact over 30 f. Set its travel to twice its distance to clear the frame, which keeps it under about 75 px/f until it is gone; keep that clearing distance ≤ 750 px by starting big cards near the edges. Window variant: the current window shrinks into the corner where the cursor sits, with transform-origin on that corner and k = lmix(1, 0.05, prog(f, 0, 40, E.contact)). Its opacity goes to 0 over the last 6 f, and the next panel's entrance starts 4 f after it vanishes. Staccato variant: remove one item every 5-7 f on hard steps (fd), re-centring the survivors instantly, until one remains, held 17 f.

## Original timing
Scatter: 30 f on E.contact; items clear the frame by about frame 24; stagger 0-2 f; the hero stays static throughout. Window minimize: 40 f on E.contact in log scale (far corner ≤ 75 px/f), fading over the last 6 f; next entrance 4 f later. Staccato: one removal every 5-7 f, final hold 17 f.

Upstream evidence count: 4; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
