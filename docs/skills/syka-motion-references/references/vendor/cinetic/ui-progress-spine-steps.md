# Progress spine leads the steps

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ui-progress-spine-steps
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: ui_choreography; energy: calm; role: workhorse; formats: feature, walkthrough, launch, vertical

## Mechanism
A thin line grows down the side of a step list with a dot at its head. Each step appears as the head reaches it, works with a spinner and a typed detail line, then flips to done, and the list scrolls to keep the head in view until the line turns a rounded corner toward the result.

## Use when
An agent, build, deploy, import or onboarding process working through steps, where the point is visible progress toward one result.

## Avoid when
There are fewer than 3 steps (one status capsule says it), or the steps finish too fast to read (show the result with a count instead).

## Original recipe (adapt to Syka native time and nodes)
Build the spine as one SVG path: a vertical run down the list's left gutter, then optionally a 40 px-radius arc into a horizontal run toward the result card. Place the head, a flat 10 px dot in C.ink, at getPointAtLength(L(f)) (from @remotion/paths). L moves only between steps, over 40 f on E.rest per step pitch, and waits at each step for that step's work time from the data (machine-timed, 24-60 f). Draw the path twice: a 1.5 px C.line hairline for the whole route, and above it a 2 px C.ink stroke with pathLength 1 and strokeDashoffset = 1 - L / total, so the part already travelled is solid and the rest is a guide. Step row i appears on the frame the head reaches its y (pass_i): opacity prog(f, pass_i, pass_i + 12, E.smooth) with a 12 px rise through arrive(). While the head waits there, the row shows a dashed-ring spinner (one turn per 48 f) and TypeOn types its detail line at about 1.5 characters per frame. On the last frame of the wait (decided on fd), the spinner becomes a C.accent check that draws over 8 f on E.out, a 'Done' tag fades in over 8 f, and the head leaves on that same frame. Scroll the list container, not the camera, with a lagged follow written as a pure function: loop from the shot's first frame to f with c += (headY(i) - 0.4 x H - c) x 0.08, and add a 2 px/f drift, so the head sits near 40% of the frame height and the list never stops dead. At the corner the head turns first, and the horizontal follow inherits the lag as it carries the eye to the result at a constant 10-14 px/f.

## Original timing
Head travel 40 f per step (E.rest), about 10 px/f for a 120 px pitch; wait 24-60 f per step, taken from the data. Row reveal 12 f (E.smooth) with a 12 px rise. Spinner one turn per 48 f; detail line ~1.5 chars/f; check 8 f (E.out); tag 8 f. Scroll lag 0.08 per frame plus a 2 px/f drift, peak about 12.5 px/f. Corner radius 40 px; horizontal run 10-14 px/f.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
