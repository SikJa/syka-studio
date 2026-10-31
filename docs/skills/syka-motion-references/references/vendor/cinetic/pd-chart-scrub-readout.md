# Scrub a chart with a live readout

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · pd-chart-scrub-readout
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: product_demo; energy: calm; role: workhorse; formats: feature, walkthrough, launch

## Mechanism
The cursor glides across a chart; a hairline and a dot ride the series beneath it and a small readout shows the date and value at that point, stepping from data point to data point until it lands on the one that makes the claim.

## Use when
Analytics, finance, health or monitoring products whose value is reading any point in history; a calm interaction beat after a fast one.

## Avoid when
The chart has no point worth landing on, or the readout is illegible at the framing (punch in to 1.6-2x first); never scrub faster than the readout can be read.

## Original recipe (adapt to Syka native time and nodes)
Build the chart from data in one SVG and make the scrub a pure function of the cursor's x: move src/fx/Cursor.tsx along a shallow cursorArc (bow 0.05) on E.smooth at 6-10 px/f, and take the active point i as the data point nearest that x, decided on fd(f). Layer back to front: series, a 1.5 px C.line hairline at point i's x, a 6 px solid dot on the series at point i with a 2 px ring in the stage colour, the readout, then the cursor; the hairline and dot snap from point to point as i changes (use 40 or more points so each snap is small; with sparse data let the hairline follow the cursor x and snap only the dot and value). The readout is a small card (8 px radius, C.ink on paper or C.white on ink) with a FONT.mono date in C.mute above the value in tabular figures; it rides along the plot's top edge at the cursor's x, clamped inside the plot so it never flips sides, and its value changes through Roll fed one step per index change (roll 8) so digits roll instead of cutting. The hairline and readout fade in over 6 f as the cursor crosses into the plot, and the scrub ends on the point that carries the claim, where the dot pulses at scale 1 + 0.25 · hitPulse(f − LAND, 2, 6) and the value arrives in C.accent and relaxes to C.ink over 24 f.

## Original timing
Scrub 90-150 f on E.smooth at 6-10 px/f (the readout never moves faster than the cursor); hairline and readout in over 6 f; value roll 8 f per index change; landing pulse attack 2 f, tau 6; accent relax 24 f; hold on the landing point 36-48 f under a 2% breath.

Upstream evidence count: 0; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
