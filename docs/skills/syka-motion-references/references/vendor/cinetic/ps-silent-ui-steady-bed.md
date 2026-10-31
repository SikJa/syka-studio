# Silent UI over a steady bed

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ps-silent-ui-steady-bed
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: pacing_structure; energy: high; role: workhorse; formats: loop, feature, vertical, walkthrough

## Mechanism
In dense, fast-changing sequences the interface makes no sound of its own, with no per-key or per-event effects, and a steady groove carries all the energy.

## Use when
Loops, grids, speed-typed prompts, counters, and any sequence with more than 3 events per second.

## Avoid when
Sparse, calm films where each event deserves its own tuned sound, and the payoff moment.

## Original recipe (adapt to Syka native time and nodes)
When visible events exceed about 3 per second (multi-cell loops, speed-typed prompts, counters), set the score.json typing style to off or muted and emit no key or tick events for them in src/sync.ts. Let the section's hats and kick carry the rhythm (style groove or drive, low end in mono). Allow at most one soft tick per word or label: high-passed above 2-3 kHz, 18-24 dB under the bed, 40-80 ms decay, with ±2 dB and ±80 cents of variation seeded by rand(). Save 6-8 accent ticks per 45 s for real clicks, and keep cuts on the 8th grid, where the hats already sound.

## Original timing
No per-character sounds; at most 1 tick per word; 6-8 accent ticks per 45 s; ticks 5-15 ms attack, 40-80 ms decay, 18-24 dB under the bed.

Upstream evidence count: 3; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
