# Theme flip mid-move

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · cl-theme-flip-in-motion
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: color_and_light; energy: high; role: signature; formats: feature, launch, walkthrough

## Mechanism
In the middle of a camera fly-over, the dark page and stage flash to their light versions, top first, and the motion never pauses.

## Use when
Products with dark and light modes, or as the single dark-to-light act transition of a film.

## Avoid when
The camera is static (the flip turns into a plain crossfade), or the light version would not match the dark one pixel for pixel.

## Original recipe (adapt to Syka native time and nodes)
Render dark and light versions of the same page as two identical layers on the same moving plane, inside one world container driven by src/lib/camera.ts so they share every transform. Reveal the light layer through mask-image: linear-gradient(to bottom, black X%, transparent X+30%), with X running from -30% to 100%, so the top bands lead by about 2 f. On the same span, swap the stage from the C.ink grid to the C.paper studio. Keep the camera at cruise speed through the flip: it shows theme support and doubles as the film's dark-to-light act change.

## Original timing
6 f in total, with the mask edge on E.linear (frame luma goes about 40, 140, 205, 235). The top leads by 2 f. Leave the camera's own easing untouched.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
