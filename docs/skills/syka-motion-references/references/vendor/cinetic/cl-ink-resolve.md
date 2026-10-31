# Ink resolve on arrival

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · cl-ink-resolve
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: color_and_light; energy: any; role: workhorse; formats: any

## Mechanism
Text never simply fades in: it arrives pale (or dim on a dark stage) and darkens or brightens to full ink as it settles.

## Use when
Every headline and caption reveal, especially over textured or busy backgrounds where an opacity fade alone looks washed out.

## Avoid when
Numbers that must read instantly on a cut (land them at full ink), or type that already sits inside a colour-band fill.

## Original recipe (adapt to Syka native time and nodes)
For each word or line, mix its colour from a pale tone to the ink with mixColor from src/lib/color.ts (interpolateColors stair-steps), while opacity goes from 0.3-0.4 to 1. On paper, go from mixColor(C.ink, C.paper, 0.65), or a pale accent tint mixColor(C.accent, C.paper, 0.8), to C.ink; on a dark stage, go from C.mute to C.white. Pair it with a short rise inside an overflow-hidden line mask (translateY 100% to 0 through arrive(), or at most 60 px), with words staggered and no blur on slow rises; src/fx/Words.tsx can carry the motion while you apply the colour per word. Connector words ('on', 'and', 'the') reach half strength in 2 f and finish over the next 6-12 f, so the nouns read first.

## Original timing
Colour takes 12-16 f per word on E.out (a headline-scale darkening may run 40 f). The rise takes 20 f, peaking under 20 px/f. Stagger words 8 f apart (4-10). Connector words go 0 to 0.5 in 2 f, then to 1 over 6-12 f.

Upstream evidence count: 5; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
