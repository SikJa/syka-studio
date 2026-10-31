# Fit-to-content follow

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · cam-fit-bounds-follow
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: camera; energy: calm; role: workhorse; formats: feature, walkthrough, launch, vertical

## Mechanism
As a route, graph or plan builds, the camera widens just enough to keep every piece that matters in frame, so the shot opens close on the first node and ends on the whole structure.

## Use when
Pipelines, agent plans, org charts, dependency or network graphs and routes that build piece by piece, where the first node needs close-up legibility and the payoff is the whole shape.

## Avoid when
The finished structure already fits one comfortable framing, a single moving lead is the whole story (cam-lead-follow), or the full structure cannot fit with 24 px labels (split it into chapters with cuts instead).

## Original recipe (adapt to Syka native time and nodes)
Each frame, collect the world boxes that must stay visible: the origin, every item revealed so far (with its half-size) and the travelling head if there is one, its box stretched ahead along its direction of travel by 18% of the frame converted to world px at the current k. Turn their bounding box plus a 12% frame margin into a target shot: ax, ay at the box centre, sx, sy at frame centre (or shifted off the caption band), and k = min((W - 2 x SAFE.x) / boxW, (H - 2 x SAFE.y) / boxH), clamped between the opening k and a floor that keeps the smallest label at TYPE.ui size (24 px) on screen; when the floor binds, let the oldest items leave the frame rather than shrinking type. Smooth it as a pure function of the frame: loop i from the shot's first frame to f, keep lnT = min(lnT, ln kTarget(i)) so the zoom never pumps back in while the set grows, and step c += (target - c) x 0.07 for ax, ay and ln k, clamping each step to 1.2% of zoom and 12 px of screen travel, then feed exp(c.lnk) to the anchor camera so the widening keeps an even pace in log space. When the structure is complete, either hold the full fit as the payoff under a cam-living-hold pull or punch in on the destination with lc(FOLLOW, DEST, prog(f, e, e + 54, E.cam)).

## Original timing
Follow coefficient 0.06-0.08 per frame (time constant 12-16 f); zoom at most 1.2%/f, centre at most 12 px/f on screen (--blur if the corners ever pass 12 px/f). Margin 12% of the frame, 18% lead on the head's side. Nodes 20-40 f apart give a steady widening rather than steps. Closing punch-in 48-60 f on E.cam, or a hold with a -0.08%/f pull.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
