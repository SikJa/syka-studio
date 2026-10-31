# Genie launch from an icon

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ui-genie-launch-from-icon
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: ui_choreography; energy: medium; role: accent; formats: launch, feature, walkthrough

## Mechanism
A dock or home-screen icon flares open at its top into a curved funnel that keeps widening until it fills the frame, and the app's first screen is already sitting inside it.

## Use when
Opening an app, a document or a tool from its icon in a dock, launcher or home screen, as a playful product-native scene change.

## Avoid when
The product is never launched from an icon, or the film already has a genie (once is a gag, twice reads as a template).

## Original recipe (adapt to Syka native time and nodes)
Render the app's first screen full-frame above the current scene and clip it with clip-path: path(), rebuilt every frame from a few numbers. The bottom edge sits on the icon's base with width wb; the top edge is h above it with width wt. Each side is a quadratic curve whose control point is the bottom corner raised by 0.45 h, so the outline pinches like a funnel. Grow it in log space so it leaves the icon slowly and speeds up: h = lmix(iconH, H + 120, p) and wt = lmix(iconW, W + 240, p), with p = prog(f, a, a + 44, E.linear). Over the same 44 f, the top edge's centre drifts from the icon to the frame centre on E.smooth, which peaks mid-way, before the growth gets fast. In the last 24 f, with s = prog(f, a + 20, a + 44, E.smooth), the waist widens toward the top (wb = mix(iconW, wt, s)) and the bottom edge drops from the icon base to 60 px below the frame. With these numbers the fastest edge stays near 70-75 px/f on the final frames, under the motion-blur pass. Start the funnel 4 f after pressAt on the icon (the icon's tile darkens 10% on the press frame). Either keep the revealed screen still at its final size, or let it settle from 1.04 to 1 over the same 44 f on E.outSoft. On the first frame the path covers the whole frame, unmount the clip and the old scene, and start the app's first UI event (a caret, a typed greeting) on that frame, so the launch hands straight over to the product.

## Original timing
Press, then funnel from +4 f: 44 f in log space (about x1.06-1.08 per frame, E.linear progress). Centre drift over the same 44 f (E.smooth). Waist and bottom edge open over the last 24 f (E.smooth). Fastest edge ~70-75 px/f at the end. Optional content settle 1.04 to 1 over 44 f (E.outSoft). Clip removed on full cover; the next UI event starts on that frame.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
