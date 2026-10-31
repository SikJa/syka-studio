# Send as a ghosted handoff

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · mi-send-ghost-handoff
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: micro_interaction; energy: calm; role: workhorse; formats: feature, walkthrough, vertical

## Mechanism
On send, the composer's text drifts up and fades away while the same content appears above as a posted message, briefly overlapping the old text, instead of flying between containers.

## Use when
A message, prompt or post is submitted and the result appears elsewhere in the same frame; this is calmer and cheaper than a flight.

## Avoid when
The journey itself is the point (show the flight), or the move would serve as a transition between shots, where a crossfade is never the default.

## Original recipe (adapt to Syka native time and nodes)
From the send press, fade the composer text over 12 f using q = prog(f, send, send + 12, E.smooth): opacity 1 - q, translateY -12 * depart(q) px, and blur blurOut(q, 4), so it only softens once it is moving. Starting 4 f after the press, bring the posted bubble in at its final place over 18 f, with opacity on E.smooth and translateY 12 to 0 px through arrive(prog(..., E.out)). Empty the composer on frame +12 and bring its placeholder back over 8 f. Pair it with the press envelope on the send button.

## Original timing
Composer out over 12 f E.smooth (-12 px, blur up to 4 px). Bubble in over 18 f from +4 f (12 to 0 px, E.out with arrive). 8 f of overlap; placeholder back over 8 f.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
