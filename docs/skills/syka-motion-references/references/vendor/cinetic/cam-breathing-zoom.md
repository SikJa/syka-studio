# Breathing zoom between interactions

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · cam-breathing-zoom
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: camera; energy: calm; role: workhorse; formats: launch, feature, walkthrough

## Mechanism
After a reveal the camera slowly pulls back, coasts through a stop and turns smoothly into a slow push that lands on the next interaction, so the frame breathes across a whole act.

## Use when
Dashboard, analytics or table acts of 4-10 s with several interactions in one framing, where cutting would cost orientation.

## Avoid when
Shots shorter than about 90 f, acts that already move pose to pose with big pushes, or a scrolling feed (a zoom on a moving list reads as wobble).

## Original recipe (adapt to Syka native time and nodes)
Drive only k, from a keyframed zoom rate rather than from poses: rate(i) = interpolate(i, [s0, s0 + 72, s0 + 108, s0 + 168], [-0.0025, 0, 0.0014, 0.0011], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) with linear interpolation, and k = k0 * Math.exp(sum of rate(i) for i = s0..f), computed in a pure loop every frame with no state kept between renders. Put ax, ay on the element the next interaction touches, so the zoom pivots on it and it holds its screen position. Keyframe the rate so it crosses zero rather than resting there: |rate| may stay under 0.0002 for no more than 12 f. Close the act with a short exhale under the final hold: k x lmix(1, 0.94, prog(f, T, T + 60, E.out)).

## Original timing
Pull after a reveal: -0.25%/f falling to 0 over 72 f (about -9% total). Push into the next interaction: 0 rising to +0.14%/f over 36 f, about +6% within 60 f of the zero crossing; table and list acts run +0.03 to +0.17%/f (about +6.6% total). Rate keyframes 36-90 f apart, linear. Exhale x0.94 over 60 f on E.out.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
