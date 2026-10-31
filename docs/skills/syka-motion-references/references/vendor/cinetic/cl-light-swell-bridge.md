# Light swell bridge into the hero

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · cl-light-swell-bridge
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: color_and_light; energy: high; role: signature; formats: launch, sting

## Mechanism
Light swells around a small panel until the frame is bright, the film cuts on the brightest frame to the hero card sitting in the same light, and that light slowly exhales back to dark.

## Use when
Releasing a dark section into the hero card or title: the biggest reveal in a dark film.

## Avoid when
Light-mode films, or a second time in the same film.

## Original recipe (adapt to Syka native time and nodes)
Shot A: a radial gradient centred on the panel with four stops (stage, dark tint, mid, light tint), whose radii grow at 12-25 px/f on E.linear so mean frame luma climbs about 2.25 levels per frame (from 15 to about 78); cut on a downbeat at the peak. Shot B opens on the identical gradient with the hero title already in place, then pulls the stops back inward so luma falls from about 112 to 43, handing off to the next dark shot. Put the cut on an act boundary so it stays crisp.

## Original timing
The swell takes 28 f on E.linear. Cut at the peak, on a downbeat. The exhale takes 86 f on E.smooth (a fade-out never runs on an expo-out).

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
