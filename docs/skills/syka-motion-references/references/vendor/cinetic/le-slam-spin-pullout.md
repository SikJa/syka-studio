# Dark slam, spin and brighten

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · le-slam-spin-pullout
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: logo_and_end_card; energy: high; role: signature; formats: launch, sting

## Mechanism
After a near-still beat, giant low-contrast arms of the mark sweep over the frame, and the mark rushes back to logo size while spinning into place and brightening to full contrast.

## Use when
The finale of a high-energy film, where the single biggest motion spike follows the single biggest stillness. Radially symmetric or rotational marks (asterisks, petals, rings).

## Avoid when
Marks with an obvious up direction that look wrong at -70 deg (lettermarks). Calm films. Films that already used a spin or a fast zoom-out seam.

## Original recipe (adapt to Syka native time and nodes)
Hold the card before it (the URL or last line) almost still, drifting at most 0.3 px/f, and end that hold with a designed freeze of at most 15 f on silence. Then start the mark at full speed with no ease-in, centred on the frame. Scale s = lmix(12, 1, prog(f, a, a+66, E.outSoft)); rotation tw(f, a, a+60, -70, 0, E.outSoft) degrees; fill mixColor(C.ink2, C.white, p*p) with p = 1 - ln(s)/ln(12). The fastest frames are then dark grey on a C.ink stage and cannot strobe, and full contrast arrives only as the mark slows. Blur the previous text out underneath (blurOut over 10 f), and keep the motion-blur pass on while the log rate is above 0.05/f (about the first 18 f).

## Original timing
66 f. Log rate 0.17/f at f0, 0.10 at f10, 0.04 at f20. Spin 5.2 deg/f at the start, 2.8 deg/f by f10, at rest by f60. Fill 31% of the way to white at f10, 70% at f20, 97% at f40. Preceded by a near-still hold of 60-90 f that ends in a freeze of at most 15 f.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
