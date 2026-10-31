# Scaled-echo extrusion

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ty-scaled-echo-extrusion
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: typography_motion; energy: medium; role: accent; formats: launch, sting, feature

## Mechanism
A hero title carries two or three faint copies scaled out behind it, a short depth extrusion that compresses as the title lands and then holds.

## Use when
A product name or a hero title of one to three words that needs weight in a flat sans. A giant cropped word that needs physical depth. A title card between two energetic acts.

## Avoid when
Body copy or lines over 3 words (the copies tangle inside the counters). Low-contrast stages, where the copies turn to haze. Blur, glow, bevels or drop shadows on the copies. A film that already uses the motion-trail echo of the word slams: pick one echo device.

## Original recipe (adapt to Syka native time and nodes)
Stack k = 3, 2, 1 copies of the same text behind the title, with the title on top. Give copy k transform scale(1 + step x k) about a vanishing point, opacity 0.55, 0.35 and 0.2 for k = 1, 2, 3, and color mixColor(C.ink, stage colour, 0.5) (C.white mixed toward the stage on ink). Arrival: step = mix(0.03, 0.012, prog(f, land - 2, land + 20, E.out)), so the extrusion collapses inward as the title lands. Put the vanishing point on the text centre for a straight-on echo, or 0.3 W to one side or below it for a directional depth. Keep the hold alive by sliding the vanishing point about 40 px across the text over the hold, opposite to a 0.3 px/f line drift, so the echoes shift like real depth. Solid-block variant for a giant cropped word: 8-12 copies translated (k x 1 px, k x 1.5 px) behind the face, each a step darker (mixColor toward C.ink by k / 12), with no blur, bevel or shadow.

## Original timing
Converge over 22 f on E.out (step 0.03 -> 0.012; outer copy edges stay under 7 px/f on a 500 px title). Copy opacity 0.55 / 0.35 / 0.2. Hold the whole card (36-60 f) with a vanishing-point slide of about 40 px on E.linear and a line drift of 0.3 px/f. The solid-block variant uses 8-12 one-pixel steps that do not animate relative to the face; the card still drifts at 0.3 px/f.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
