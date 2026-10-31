# Zoom-out hop between areas

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · cam-zoom-out-hop
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: camera; energy: medium; role: workhorse; formats: walkthrough, feature, launch

## Mechanism
To travel between two distant parts of one product, the camera eases back as it sets off, crosses at a wider framing that shows where it is going, and pushes back in as it arrives.

## Use when
Single-take and walkthrough films moving between two areas of one surface more than about a frame width apart (sidebar to canvas, one dashboard panel to another), where the viewer should see how they relate.

## Avoid when
Areas less than about a frame width apart (cam-reframe-to-subject), a cursor that should lead the move (cam-cursor-whip-orbit), or a wide view that is cluttered or unfinished, since the hop shows it.

## Original recipe (adapt to Syka native time and nodes)
Keyframe Shots A and B at the same k on the two areas, blend cam = lc(A, B, prog(f, a, a + N, E.smooth)), then multiply cam.k by dip(prog(f, a, a + N, E.linear), depth) from src/lib/camera.ts. Driving the dip on linear time instead of on the pan's eased progress is the point: the pull-back starts before the pan gathers speed and the push-in finishes after it slows, so the widest framing coincides with the fastest travel and the frame edge peaks 28-40% lower than the same pan without the hop. Set depth = clamp(1 - 0.7 x W / (A.k x D), 0.15, 0.45), where D is the world distance between the anchors, so both areas share the frame at mid-move, and size N = A.k x D / 34 frames at depth 0.45 (A.k x D / 25 for a shallow 0.15-0.25 hop, interpolated between) to keep the edge under about 60 px/f. Start B's caption in the last 25% of the move and render with --blur.

## Original timing
Pan on E.smooth over N = A.k x D / 34 f at depth 0.45, or A.k x D / 25 at 0.15-0.25: about 76 f for 2,600 px at k = 1, 106 f for 1,800 px at k = 2, 72 f for 1,800 px at k = 1. Dip on linear time, depth 0.15-0.45, its zoom rate peaking at 1-2.6%/f a quarter of the way in and out. Frame edge at most about 60 px/f. Beyond about 120 f, cut instead (cam-offframe-whip-relay or cam-punch-in-insert).

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
