# Machine on the grid, hands off it

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ps-machine-grid-human-gaps
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: pacing_structure; energy: medium; role: workhorse; formats: walkthrough, feature, launch

## Mechanism
Work the product does (rows inserting, items stacking, text streaming) ticks on a strict metronome, while what a person does (moving the cursor, flipping toggles, clicking) arrives on uneven, deliberating gaps, so the viewer can feel who is acting.

## Use when
Product demos where a person gives an instruction and the product or an agent responds, walkthroughs that mix input with generated output, and any sequence where automation should feel tireless next to a human.

## Avoid when
Pure type films or brand stings with no user in the story; polyrhythm grids, which run their own clocks; musical montages where every event must land on the beat.

## Original recipe (adapt to Syka native time and nodes)
Tag every scheduled event in src/timeline.ts with who performs it: SYS for work the product does (rows inserting, items stacking, text streaming, status steps) and USER for what a person does (cursor travel, clicks, toggles, drags). SYS start frames come from b() on a fixed step: 15 f (an 8th at 120 BPM) for inserts, or 16ths via b(bar, beat, sub) for bursts. Every SYS instance uses the same curve and duration (for example a 12 f E.ui reveal) at a constant or ratcheting rate. Streamed text uses TypeOn with cps at 25-40 characters per second, or one fixed time box, and never jitters. USER start frames come from a hand-written list of uneven gaps, with at least 2x between the shortest and longest gap and no two neighbouring gaps within 15% of each other ([0, 4, 19, 37] f for four toggles, or gaps of 10, 26 and 14 f). Cursor travel runs through cursorArc (bow 0.15-0.25) on E.glide and lasts max(14, D / 20) f for a trip of D px, which keeps its peak under 60 px/f. A dwell of 6-18 f, chosen per instance with rand(seed), separates arrival from the press, and pressAt drives the click. Only the decisive press of each scene lands on a beat (±1 f); the rest of the user layer stays off the grid. Sound follows the same split: each SYS insert gets one soft tick so the metronome is heard (dropped once inserts pass about 3 per second over a bed), and USER actions stay silent except the decisive click.

## Original timing
SYS: one event every 15 f (an 8th at 120 BPM), or every 7-8 f (16ths) in bursts; identical 12 f E.ui reveals; streams at 25-40 characters per second. USER: gaps such as 4, 15 and 18 f, or 10, 26 and 14 f; cursor travel max(14, D/20) f on E.glide, peak under 60 px/f, with motion blur above 12 px/f; dwell 6-18 f; press 12 f via pressAt; the decisive press on the beat ±1 f.

Upstream evidence count: 3; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
