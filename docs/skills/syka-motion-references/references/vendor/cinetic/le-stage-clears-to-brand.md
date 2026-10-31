# The product clears the stage

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · le-stage-clears-to-brand
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: logo_and_end_card; energy: any; role: workhorse; formats: launch, feature, walkthrough

## Mechanism
The last product element leaves (dropping out of frame, accelerating away, or bursting outward toward camera), and the brand, already waiting behind it, starts its reveal on the exact frame it is uncovered.

## Use when
Walkthroughs and feature films whose last shot is the product itself. The opening was a window or card entering, so the reverse bookends it. A crescendo of many screens that should give way to calm.

## Avoid when
The film's last beat is type, not product. A lockup that is already visible would be crossed by the exiting product. A burst with no build-up earlier to justify the energy.

## Original recipe (adapt to Syka native time and nodes)
Keep the brand layer (stage plus lockup) mounted under the product for the whole shot, so the exit uncovers it instead of cutting to it. Exit the product one of three ways. (1) Time-reverse its own entrance with progress = 1 - entrance(1 - t); for a window this is typically a ~1000 px drop over 44 f on E.smooth. (2) Float a lone card up from its drift over 25 f on E.in while it grows 1 -> 1.33. (3) Burst a card cluster outward: each card translates 300-450 px along its vector from the cluster centre and scales lmix(1, 3) over 20 f on E.in, and the card layer is removed on the frame its fastest card passes ~75 px/f. Start the brand reveal on the frame the product's edge clears the lockup's box, computed from the exit curve. Either the mark grows lmix(0.48, 1, prog(..., E.out)) over 68 f, or a letterspaced wordmark (0.08 em) fades up over 40 f on E.smooth with no scale.

## Original timing
Drop: 44 f on E.smooth (~1000 px, peak ~64 px/f, motion-blur pass on). Float-out: 25 f on E.in (5 -> 22 px/f, scale +33%). Burst: 20 f on E.in, cut at ~75 px/f. The brand reveal starts within 0-1 f of the clear frame. Mark growth: 68 f on E.out (edge speed ~17 px/f, no overshoot). Then hold 90-120 f under a 10-15% push (le-living-hold).

Upstream evidence count: 3; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
