# Edit with the product's own UI

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · pd-ui-native-transitions
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: product_demo; energy: medium; role: workhorse; formats: walkthrough, feature, launch

## Mechanism
Instead of cuts, the film moves between product areas the way the app does: a window recedes to a corner, a sheet slides up, a popover pops from its anchor, a button or card unfolds into a full panel.

## Use when
Walkthroughs across several product areas; any film where each transition can also demonstrate how the product navigates.

## Avoid when
A purely conceptual or type-led film; desktop chrome that is not part of the brand world; more than one native transition every 3 s (it starts to feel like a screen recording).

## Original recipe (adapt to Syka native time and nodes)
Model the app as stacked layers in one scene, park the cursor on the control that would trigger each change 6 f before the press, and use the matching native behaviour instead of a cut. Minimize: transform-origin at the trigger corner, scale 1 → 0.7 on E.in over 22 f while opacity falls 1 → 0 over its last 12 f on E.smooth (the far corner is mostly gone before it passes 60 px/f), with the next layer 4 f later. Sheet: translateY 100% → 0 of the window over 52 f on E.glide, clipped to the window. Popover: scale 0.5 → 1 from the trigger point over 12 f on E.outSoft with opacity over its first 4 f, then a 20-40 f camera reframe starting 2 f later. Launch: the sidebar glides left 31% of frame width over 96 f on E.smooth while the main canvas mounts whole on the trigger frame and its greeting starts typing on that frame. Unfold: one element interpolates rect and border-radius from the button or card to the full panel over 28 f on E.rest (longer for a big panel: at least edge travel / 20 f, so no edge passes about 70 px/f) and its title FLIPs to the header slot (scale 1 → 0.6), flying faded whenever it moves faster than 20 px/f; the old content fades out over the first 12 f, the panel content fades in 8 f after the morph peaks, and the stage behind dims over 24 f (a RackFocus at 40 px for a blurred desktop).

## Original timing
Generic chain: exit on E.in 22 f, gap 4 f, entrance on E.out 52 f. Minimize 22 f; sheet 52 f (peak ≈ 50 px/f); popover 12 f plus a 20-40 f reframe; launch slide 96 f (peak ≈ 18 px/f); unfold 28 f on E.rest (at least edge travel / 20 f), content in 8 f after the peak, stage dim 24 f.

Upstream evidence count: 5; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
