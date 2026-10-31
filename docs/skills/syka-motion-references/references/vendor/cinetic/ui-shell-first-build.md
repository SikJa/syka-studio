# Shell first, then contents, then the action

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ui-shell-first-build
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: ui_choreography; energy: medium; role: workhorse; formats: launch, feature, walkthrough, vertical

## Mechanism
The empty container is on screen first, its contents arrive left to right, the card unfolds downward in stages, and the primary button fills last as the clear call to act.

## Use when
The first appearance of any real product screen, especially dashboards, headers and forms whose reading order matters.

## Avoid when
The screen should feel already alive on the cut (enter it moving with a rise-in), or the shot is shorter than about 40 f.

## Original recipe (adapt to Syka native time and nodes)
Show the container (bar, card, window) at t0 with nothing inside; its children enter in DOM order at a 4 f stagger, each rising 6 px through arrive() with opacity 0 to 1 over 12 f on E.out, and media slots first appear as C.mist rounded rects that fill with their image over 8 f, 8 f apart. The primary action comes last: its background ramps from transparent to solid on E.linear over 16 f from +20 f, and its label colour inverts on a single frame at +28 f. To teach the hierarchy, unfold the card downward in stages with a clip-path inset on its bottom edge on E.smooth (header row first, then 36 f to reveal the stats row, then 24 f to the full card, the bottom edge travelling about 330 px), each stage's content starting only once its slot is 60% revealed. Headlines inside the UI are live text in the camera world, revealed per word with Words (6 f stagger), so they inherit the plane's perspective.

## Original timing
Children 4 f stagger, 12 f each (E.out), 6 px rise. Media fill 8 f, 8 f apart. Button fill 16 f (E.linear) from +20 f; label inverts at +28 f. Unfold 36 f then 24 f (E.smooth), content at 60% open. In-UI headline 6 f per word.

Upstream evidence count: 3; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
