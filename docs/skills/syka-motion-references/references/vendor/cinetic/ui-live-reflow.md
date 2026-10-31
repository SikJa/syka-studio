# Container resizes, content reflows

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ui-live-reflow
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: ui_choreography; energy: medium; role: workhorse; formats: feature, walkthrough, launch

## Mechanism
A card or window changes size because its content or the user changes it, growing as typed text wraps or narrowing as an edge is dragged, while everything inside reflows to the new width.

## Use when
Typing into an input, responsive layouts, resizable panels: any moment where the point is that the UI adapts.

## Avoid when
The size change is a change of role, such as a button becoming a panel (use a container morph), or text must be read during the resize.

## Original recipe (adapt to Syka native time and nodes)
Make layout a pure function of the container's current width: measure text with measureTracked or inkBox, derive line breaks and block positions from that width, and evaluate typed text on fd(f) so the substring and the line count change on whole frames only. Content-driven: as the prompt starts, the input card widens from 67% to 77% of frame width over 24 f on E.outSoft (about 18 px/f per edge, centred so both edges move), and each newly wrapped line adds one line height over 12 f on E.out. User-driven: the cursor grabs a window's right edge and drags it 300-400 px inward on E.contact over 40 f, stopping dead like a real release with no settle, while the left edge follows at 15% of the right edge's speed so the window re-centres and the cursor trails the edge by 1 f. When the width crosses a breakpoint, compute both layouts and FLIP every block to its new slot over 16-24 f on E.ui (fastest block under 70 px/f) instead of crossfading the two layouts.

## Original timing
Widen 67% to 77% FW over 24 f (E.outSoft); +1 line per wrap over 12 f (E.out). Drag 300-400 px over 40 f (E.contact), ends near 40 px/f, hard stop; breakpoint FLIP 16-24 f (E.ui); then a 0.3 px/f push-out.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
