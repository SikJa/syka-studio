# Constant-speed bar sweep with lit caps

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · dn-bar-sweep-lit-caps
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: data_and_numbers; energy: medium; role: workhorse; formats: launch, feature, loop, walkthrough

## Mechanism
A row of bars grows in a wave that travels at constant speed; each bar eases up on its own and flashes a bright cap that relaxes to the resting tone.

## Use when
Volume, activity or histogram data streaming in; an opening equaliser or skyline that hints at growth.

## Avoid when
Bars that must be compared precisely, since the wave delays reading; fewer than 6 bars.

## Original recipe (adapt to Syka native time and nodes)
Bar i starts at at + 1.6i, a linear wave travelling at bar pitch / 1.6 px per frame (about 25 px/f at 1080p). It grows with height = h_i * prog(frame, start_i, start_i + 12, E.out) from a bottom anchor; make the grow last at least 0.09 x the bar height in px so the top edge never passes 70 px/f. A 3 px cap on each bar arrives in C.accent and relaxes to the bar's resting tone over 20 f after the bar lands (mixColor, cap opacity 1 to 0.6), because the accent means 'just landed'. For a centre-out symmetric wall, use tr-stepped-column-fill instead.

## Original timing
1.6 f per bar (~25 px/f wave). Each bar 12 f on E.out (at least 0.09 x its height in px). Cap relaxes over 20 f.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
