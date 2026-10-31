# One-element tell before the event

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · mi-pre-event-tell
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: micro_interaction; energy: calm; role: accent; formats: feature, walkthrough, launch, loop

## Mechanism
Just before a state change or a cut, exactly one small thing moves, such as a plus glyph turning 45 degrees into an x or an object slowly turning toward its target, while everything else holds.

## Use when
A repeated result cut, or a sudden 2-4 f event, needs anticipation so it reads as caused rather than random.

## Avoid when
Several things already move in the frame (the tell gets lost), or the yaw would leave the rest of the frame static for more than 48 f.

## Original recipe (adapt to Syka native time and nodes)
Plus mode: rotate the plus glyph 0 to 45 degrees with prog(f, cut - 16, cut - 6, E.smooth) so it finishes 6 f before the cut. Repeat it before every result cut so the viewer learns the tell. Yaw mode: rotateY the object 0 to 35 degrees over 40 f E.linear inside perspective 1200px. The camera tail creeps at most 0.1% scale per frame and nothing else changes; fire the event (a 2-4 f impact or a hard state change) on the frame the yaw ends. The tell is the motion of the shot, so keep it to one element and add no cursor.

## Original timing
Plus: 10 f E.smooth, finishing 6 f before the cut. Yaw: 40 f linear to 35 degrees, with the event on the next frame; camera creep at most 0.1% per frame.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
