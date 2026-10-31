# Accent hit envelope

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · cl-accent-hit-envelope
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: color_and_light; energy: medium; role: accent; formats: feature, walkthrough, launch, loop

## Mechanism
On a press or an impact, the element floods with the accent and peaks for one frame with its label inverted, then either bleeds back like decaying light or stays as the new state.

## Use when
Primary-button clicks, send or confirm moments, and contact hits that turn an object into its new state.

## Avoid when
Secondary controls and hovers (save it for the decisive action), or when the accent already floods the ground.

## Original recipe (adapt to Syka native time and nodes)
Put a solid C.accent overlay inside the button, with the same corner radius. Drive its opacity with hitPulse(frame - cue, 10, 8): a fast rise, a one-frame peak, and an exponential release about twice as long as the attack. Switch the label to C.ink when the overlay passes 0.6, and change no scale (the cursor may dip 1 to 0.9 to 1 over 12 f). For an impact that changes state, swap the object's fill to the accent on the contact frame (decided with fd), add a flat C.white overlay at 0.8·hitPulse(t, 1, 2), apply squash(t) anchored at the contact edge, and leave the accent on. No ring blur and no outer halo.

## Original timing
Attack 10-12 f, a 1 f peak, then a release of 20-26 f (tau 8): an asymmetric 1:2 envelope. On an impact, the swap takes 1 f, the white flash about 4 f and the squash 8 f.

Upstream evidence count: 4; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
