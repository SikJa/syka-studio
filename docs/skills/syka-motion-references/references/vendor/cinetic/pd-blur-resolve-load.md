# Generated view resolves from soft

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · pd-blur-resolve-load
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: product_demo; energy: medium; role: accent; formats: launch, feature, walkthrough, loop

## Mechanism
A freshly generated window or row appears as a soft, out-of-focus shape over a flat placeholder plate and snaps into crisp UI in about a third of a second.

## Use when
An AI or build step produces a result and it should read as just arrived, without a spinner.

## Avoid when
The UI was already on screen (use a state change); more than two resolves in one sequence (it becomes a fog filter); type so small that 12 f of softness hurts legibility.

## Original recipe (adapt to Syka native time and nodes)
Mount the finished UI over a flat placeholder plate (C.mist, or C.accent at 12% opacity: one hue only). Render the UI through RackFocus (src/fx/RackFocus.tsx) with blur 20 px and t = 1 − p, p = prog(f, s, s + 20, E.out); fade its opacity 0.6 → 1 and scale it 1.03 → 1 on the same p so the focus pull rides a move, and fade the plate out over the same 20 f on E.smooth. For a list, insert rows one at a time: width 60% → 100% with RackFocus 6 → 0 px over 12 f, siblings pushed down one row over 10 f on E.ui, rows 34-40 f apart; inside an unfolding card, start a row's rack only once 60% of its height is revealed. t must reach 0 by the end, so text lands fully sharp.

## Original timing
Window: 20 f on E.out (blur 20 → 0 px, opacity 0.6 → 1, scale 1.03 → 1), plate fade 20 f on E.smooth. Rows: 12 f each, push-down 10 f on E.ui, cadence 34-40 f. Card stats row: 12 f, starting once 60% of it is revealed.

Upstream evidence count: 3; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
