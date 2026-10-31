# Flick scroll lands the target

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · pd-flick-scroll-lands-target
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: product_demo; energy: medium; role: workhorse; formats: any

## Mechanism
A list or page scrolls like a trackpad flick, entering already fast or ramping up briefly, then glides on an exponential tail until the target row rests at its reading position.

## Use when
Showing volume (many results, a long page, a feed), or moving down a form to its next section with a human feel.

## Avoid when
The viewer must read during the move; the list is shorter than two screens; it would be the third scroll in a row.

## Original recipe (adapt to Syka native time and nodes)
On a cut, start at peak speed with inertia(f, cut, v0, 0.943) from src/lib/anim.ts (v0 ≈ 54 px/f: travel ≈ 920 px, readable after ≈ 49 f, within 0.5 px after its settle). Inside a shot, ramp first: position = vmax·t³/(3·tp²) for t < tp, then vmax·tp/3 + inertia(f, s + tp, vmax, d).x after tp, with decay d 0.93-0.98. Solve vmax = D / (tp/3 + tau), tau = −1/ln d, so the target lands about 15% from the top (a section heading) or at centre, and cap vmax at 60 px/f. Drive text through total · arrive(x / total, 0.98) so the slow tail does not tick, keep the camera itself crisp, and let the motion-blur pass streak the rows above 12 px/f; rows are not meant to be read until they drop below 3 px/f.

## Original timing
Cut entry: v0 54 px/f, decay 0.943 (tau 17 f), ≈ 76 f to rest. In-shot: ramp tp 28-40 f, vmax 35-60 px/f, tail decay 0.93 for a form section, up to 0.98 for a long volume reel (≈ 277 f for ≈ 2,600 px); readable below 3 px/f.

Upstream evidence count: 3; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
