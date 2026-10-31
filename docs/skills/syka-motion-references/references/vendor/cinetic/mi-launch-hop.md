# Launch hop that never lands

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · mi-launch-hop
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: micro_interaction; energy: medium; role: accent; formats: launch, feature, walkthrough

## Mechanism
A centred app icon hops up as if launching, hangs at the top for a beat and starts to fall, and the camera leaves before it lands, so the hop motivates the scene change.

## Use when
Opening the app or launching a feature should motivate the move to the next scene with a familiar OS gesture.

## Avoid when
The icon must come to rest in the same shot (then it needs a real landing), or several icons would hop in turn.

## Original recipe (adapt to Syka native time and nodes)
Chain the icon's translateY with tw: 0 to -77 px over 10 f E.outSoft, hold 4 f, then -77 to +20 px over 18 f E.contact (gravity, ending with velocity), with no squash. Scale a soft contact shadow from 1 to 0.85 and fade it as the icon rises. Start the scene change (a camera tilt-away, a whip or a cut) on frame 14, the first frame of the fall, so the landing never resolves on screen.

## Original timing
Rise 77 px in 10 f E.outSoft; hold 4 f at the top; fall 18 f E.contact; the camera leaves from frame 14; 32 f in all.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
