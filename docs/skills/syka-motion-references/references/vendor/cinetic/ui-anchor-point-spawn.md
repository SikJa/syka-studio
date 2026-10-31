# Spawn from the anchor point

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ui-anchor-point-spawn
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: ui_choreography; energy: medium; role: workhorse; formats: walkthrough, feature, launch

## Mechanism
Menus, popovers, drop targets and detail cards scale out of the exact point that caused them, such as the cursor tip or a map pin, and collapse back into it.

## Use when
Any UI that opens from a click, or a drag target appearing: menus, popovers, dialogs, drop zones, cards from a map pin.

## Avoid when
The element enters from off-screen or is a full window (rise-in), or the trigger point is out of frame.

## Original recipe (adapt to Syka native time and nodes)
Set transform-origin to the trigger point in the element's own coordinates (cursor tip, pin base, the edge of the button) and scale with lmix from about 0.05, opacity reaching 1 within the first 4 f; the log-space scale keeps the far edge from jumping on frame 1. Small surfaces (menus, popovers, a card out of a pin): lmix(0.05, 1, prog(f, a, a + 12, E.out)), no overshoot, adding 2 f per extra 100 px of size, then a small camera reframe toward the surface starting 2 f later over 20-40 f on E.cam. Large surfaces (a drop target filling a panel): lmix(0.036, 1, prog(f, a, a + 48, E.smooth)), a flat C.accent fill with a 12 px radius, its icon and hint text fading in over the last 8 f; it collapses back into the point over 36 f on E.smooth. Keep the cursor (fx/Cursor.tsx) parked on the trigger during the spawn so cause and effect share one point.

## Original timing
Small: 12 f (lmix, E.out) from 0.05, opacity 4 f, far edge ~63 px/f for a 300 px menu; camera reframe from +2 f over 20-40 f (E.cam). Large: 48 f (lmix, E.smooth) from 0.036, hint over the last 8 f, collapse 36 f (E.smooth).

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
