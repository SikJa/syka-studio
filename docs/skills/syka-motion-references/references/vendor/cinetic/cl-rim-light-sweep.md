# Rim streak on card edges

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · cl-rim-light-sweep
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: color_and_light; energy: calm; role: accent; formats: feature, launch, walkthrough

## Mechanism
A bright streak travels along a dark card's border while its edges carry a faint lit rim, separating it from a black stage without a drop shadow.

## Use when
Flat dark UI cards floating on pure black that need depth and separation without tilting or shadows.

## Avoid when
Light-mode UI (use a soft neutral shadow instead), or several cards on screen at once (the streaks compete).

## Original recipe (adapt to Syka native time and nodes)
Fill the card with C.ink2 on a C.ink stage and give it a 1 px border of C.white at 8% alpha. Above it, place an SVG rect of the same size and radius with pathLength=1, a 1-2 px stroke of C.accent or C.white, strokeDasharray '0.12 0.88' and strokeDashoffset driven by the frame, so a 120 px segment runs along the top edge or around the whole perimeter. For the whole UI act, breathe the static rim's opacity between 0.6 and 0.8 on sin(2π·frame/180). For a brand that supplies glow, add soft box-shadow halos in a different colour on each of three sides.

## Original timing
The streak crosses one edge in 20-30 f on E.linear. The rim breathes ±20% over 180 f and stays on for the whole UI act.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
