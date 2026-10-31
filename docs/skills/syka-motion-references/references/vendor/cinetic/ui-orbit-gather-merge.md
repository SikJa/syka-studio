# Orbit gather and merge

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ui-orbit-gather-merge
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: ui_choreography; energy: medium; role: signature; formats: launch, feature, loop

## Mechanism
Tokens swing into orbit around a node, slow to a lazy spin, then accelerate one by one into a single exit point from which a line shoots out.

## Use when
Several inputs, funds or sources gather before one action (pooling, batching, syncing, sending) and the idea should be told by physics with no words.

## Avoid when
The tokens are UI cards carrying text (unreadable while orbiting), or the story has no single output point.

## Original recipe (adapt to Syka native time and nodes)
Place 4 tokens on a 95 px radius around the source node (above the node, below the exit line) and drive each angle in closed form: theta_i(f) = theta0 + 90*i - (132.5*(1 - exp(-f/10)) + 2*f) deg, a 13 deg/f swing (about 22 px/f of arc) that decays to a 2 deg/f spin within 30 f. Token 0 is there at f0; tokens 1-3 spawn at f10, f18 and f28, each scaling 0 to 1 over 10 f on E.out. Pick theta0 so each token is 90-120 deg short of the exit angle (3 o'clock) when its merge starts; token i then covers that remaining angle forward over 16 f on E.contact, landing at f72, f82 and f86 at under 60 px/f, its scale cutting to 0 on arrival while the exit node takes scale 1 + 0.08*hitPulse(t) and a tick. At f92 a line draws out of the exit point (pathLength 1, strokeDashoffset 1 to 0 over 12 f on E.out) and carries the story to the next diagram.

## Original timing
omega = 13.25*exp(-f/10) + 2 deg/f, radius 95 px at 1080p. Spawns f10/f18/f28, 10 f each (E.out). Merges 16 f each (E.contact), landing f72/f82/f86 at < 60 px/f; hitPulse(t, 2, 5) on the exit node. Exit line f92, 12 f (E.out). About 105 f in all.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
