# One camera journey across one surface

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ps-single-camera-journey
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: pacing_structure; energy: calm; role: signature; formats: walkthrough, feature, launch

## Mechanism
Every product state lives on one large surface and the film is a single camera path between poses; scene changes are pushes, pulls, orbits, whips and the interface's own window actions.

## Use when
Walkthroughs of a single app, features where spatial orientation matters, and calm, premium product films.

## Avoid when
Multi-app or abstract stories, and films under 10 s.

## Original recipe (adapt to Syka native time and nodes)
Lay out every UI state on one world container and keyframe 12-17 Shot poses (src/lib/camera.ts). Between poses, blend with lc(A, B, E.cam(p)) over 56-108 f, using E.inOut for at most one or two whips. At each pose the camera holds dead still while the UI acts (see locked holds). Move between product areas with the product's own behaviour instead of cuts: a window minimizing into a corner (20-22 f E.in), a bottom sheet (52 f E.out), a popover scaling from the cursor point (8-12 f), a modal (26 f). Chain them as exit, 4 f gap, entrance. Keep camera roll at or under 11 degrees on orbits, and give moves over 12 px/f the motion-blur pass.

## Original timing
0 cuts; about 3 moves per 10 s; moves 42-108 f E.cam; holds 18-252 f (median setup about 170 f); window actions 8-52 f.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
