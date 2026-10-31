# One grade across mixed media

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · tx-mixed-media-grade
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: texture_and_finish; energy: medium; role: workhorse; formats: launch, feature, loop

## Mechanism
Desaturated photography, matte grey 3D, flat vector maps and line diagrams cut freely against each other without clashing, because every medium shares one dark value range and only the hero prop carries the accent.

## Use when
Films that must combine photos, renders, maps, diagrams and UI, especially grid or bento layouts with several media on screen at once.

## Avoid when
Light, pastel or colourful brands; single-medium films; hero product photography that must keep its true colour.

## Original recipe (adapt to Syka native time and nodes)
Normalise each medium before it enters a shot: photos get `filter: grayscale(1) brightness(0.65) contrast(1.05)`; 3D or clay renders use matte grey materials (base around 40% grey, no coloured speculars) with C.accent on the hero prop only; vector maps fill land at C.ink plus OKLCH 0.03-0.04 lightness with 1.5 px borders at 15-25% white; line diagrams draw in white at 60-80% with the accent on the one active path. Check that every medium's mean luma lands within 8-25% and that nothing except the accent exceeds OKLCH chroma 0.03, then hard-cut or swap media inside a shot or grid cell on beats. The accent keeps the same single meaning in every medium.

## Original timing
Swap media inside a shot or cell every 48-90 f, on beats; hard cuts between media need no transition because the value range already matches.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
