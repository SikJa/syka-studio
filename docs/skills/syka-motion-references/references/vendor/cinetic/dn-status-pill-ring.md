# Process-status pill with ring progress

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · dn-status-pill-ring
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: data_and_numbers; energy: calm; role: accent; formats: walkthrough, feature, launch

## Mechanism
A compact capsule shows where a process stands in one glance: a live dot, a mono step label, a ring filled to the current percentage, the step count and a grey date.

## Use when
Proving that a real, structured process exists (pipeline, build, delivery) as an overlay on process footage.

## Avoid when
The step and percentage aren't true to the story; frames that already carry a headline, which the pill would compete with.

## Original recipe (adapt to Syka native time and nodes)
Draw a rounded rect (radius 25% of its height) in C.ink2 with a 1.5 px C.line hairline border. Left to right, place an 8 px accent dot, a mono uppercase label (FONT.mono, 24 px at 1080p, tracking 0.15 em), an SVG ring (r 14 px, 3 px stroke, pathLength 1, strokeDasharray `${p} 1` over a C.line track), primary text at weight 500 ('Step 5/6 · Motion') and a C.mute date line. Animate it rather than parking it: the capsule rises 24 px on SPR.firm with opacity over 10 f on E.smooth; from the landing, the ring fills from 4/6 to 5/6 over 30 f on E.out, and the step digit rolls 4 to 5 through Roll on the fill's 50% frame. On the roll frame the dot pulses once, scale 1 + 0.4 * hitPulse(t, 2, 8).

## Original timing
Arrival on SPR.firm (~24 f to settle). Ring fill 30 f on E.out. Step roll 14 f. Dot pulse: attack 2 f, tau 8 f. Visible 46-90 f.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
