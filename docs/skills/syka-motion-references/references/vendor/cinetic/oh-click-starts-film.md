# A click starts the film

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · oh-click-starts-film
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: opening_hook; energy: medium; role: accent; formats: feature, walkthrough, vertical

## Mechanism
From frame 0 a cursor is already travelling toward the one button on an otherwise bare stage; it presses, and the button floods open into the first scene.

## Use when
UI walkthroughs and feature films where a single action is the product ('one click to ...').

## Avoid when
Products that act on their own, or films where the cursor never returns after the hook (it breaks continuity).

## Original recipe (adapt to Syka native time and nodes)
C.paper stage with a single button (the product's primary action) slightly below centre. Cursor follows cursorArc(a, b, prog(f, -6, 18, E.glide), 0.2), so frame 0 is already mid-path because the clock starts 6 f before the shot. pressAt(f, 22) drives the cursor's press, and the button dips by 1 - 0.03 * hitPulse(f - 22, 2, 5). Iris starts at the press frame minus 1 (24 f, E.out in log space) from the button's centre and reveals the first scene inside it. Put the click SFX 0-1 f before the press frame, with nothing before it.

## Original timing
Cursor arrives f18; press f22 (4 f down, 8 f recoil); iris f21-45; first scene live from f45.

Upstream evidence count: 0; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
