# Reactive reframe

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · cam-reframe-to-subject
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: camera; energy: calm; role: workhorse; formats: walkthrough, feature, launch

## Mechanism
When something new appears (a popover, a result, the hero icon), the camera glides a few hundred pixels and pushes in slightly until it sits where the eye wants it.

## Use when
After any UI event that changes what matters on screen, or after a punch-in that left the hero off-centre.

## Avoid when
Every small UI change (keep it for the ones that matter), or an element that already appears near frame centre (a move under 40 px reads as a twitch).

## Original recipe (adapt to Syka native time and nodes)
On the event cue c, blend from the current camera into a reframed Shot: cam = lc(CURRENT, REFRAMED, prog(f, c + 4, c + 4 + N, E.glide)). REFRAMED puts ax, ay on the new element's centre and sx, sy at frame centre (or offset to leave room for its caption), with k = CURRENT.k x 1.05-1.23. Starting 4 f after the element begins to appear lets the content lead and the camera follow. The element arrives on its own curve; a popover, for example, scales 0.05 -> 1 from the click point over 10 f on E.out, its opacity rising over the first 4 f. To centre a hero after a punch-in, use the same blend over 22 f with position and k on one curve, so the subject arrives on a long tail.

## Original timing
Popover reframe: starts 4 f after the pop, settles in 20-40 f on E.glide, k x1.05. Hero centring: 22 f on E.glide, 150-350 px of travel, peak about 22 px/f at 31% of the move, k 1.0 -> 1.23.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
