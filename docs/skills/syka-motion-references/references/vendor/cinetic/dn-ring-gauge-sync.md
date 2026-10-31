# Ring gauge filling with its centre number

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · dn-ring-gauge-sync
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: data_and_numbers; energy: calm; role: workhorse; formats: any

## Mechanism
A circular gauge sweeps to its value while the number at its centre counts on the same progress, and the ring's end cap leads the eye around.

## Use when
Percentages, scores, completion and utilisation; status pills and KPI tiles.

## Avoid when
Values that aren't parts of a whole; more than 3 concentric rings.

## Original recipe (adapt to Syka native time and nodes)
Draw an SVG circle rotated -90deg over a C.line track ring, with pathLength={1}, strokeLinecap round and strokeDasharray `${v} 1`, where v = target * prog(frame, at, at + N, E.outSoft) and N = max(48, 0.48 x radius x target) frames, which keeps the end cap at or under 60 px/f (48 f covers a 160 px ring up to 63%; a full 160 px ring needs 77 f). The centre figure is Math.round(100 * v) on fd(frame), in tabular figures with a tucked % at 0.4x size. The arc arrives in C.accent and relaxes to the ink tone over 20 f after landing; for nested rings, stagger them 6 f apart with stagger() so the group lands within 30 f.

## Original timing
Fill over N = max(48, 0.48 x radius x target) f on E.outSoft (48 f for most gauges, 77 f for a full 160 px ring). Centre count on the same progress. Accent relaxes over 20 f after landing. Nested rings 6 f apart.

Upstream evidence count: 0; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
