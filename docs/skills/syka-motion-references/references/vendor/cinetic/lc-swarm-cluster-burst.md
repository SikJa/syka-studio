# Swarm, cluster and burst reveal

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · lc-swarm-cluster-burst
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: layout_and_composition; energy: high; role: signature; formats: launch, sting

## Mechanism
About twenty cards or screenshots fly in from every edge, swirl, pack into a dense overlapping cluster that slowly swells, then blow outward past the camera to uncover a hero object that was waiting behind them.

## Use when
A crescendo near the end that proves breadth (many apps, templates, outputs) and clears the stage for the lockup or a hero stat; the film's single biggest motion spike.

## Avoid when
Calm or minimal films, more than once per film, or when the cards' content has to be read (nothing in the swarm is legible). If it reveals the lockup, the lockup still holds only 1.5-2.0 s.

## Original recipe (adapt to Syka native time and nodes)
Place the hero (lockup, stat card, product) centred at z 0, already at final size, with N = 16-24 cards above it. Give card i a slot in a packed cluster (a grid jittered by rand(i): up to 40 px and 6 deg, overlapping, larger cards higher in z) and a unit radial vector from the centre through that slot. Fly-in: set the card's offset along its vector to total - inertia(f, s_i, 56, 0.95).x, so it starts about 1090 px out and coasts into its slot, with start frames spread by stagger(i, N, 24, E.out). Over the next 60 f the slots rotate about the centre by an angle that decays from 24 deg to 0 on E.outSoft (the swirl), contract to 73% spread over 32 f on E.out, and then the whole cluster scales up linearly by 0.2% per frame. Burst: each card travels along its vector by d(n) = 3n^2 px for n <= 12, then 432 + 72(n - 12), with scale 1 + 2(n/24)^3 under a true motion-blur pass, so the hero is uncovered in about 18 f.

## Original timing
Fly-in 28-40 f, entering at 56 px/f and decaying. Swirl 60 f. Converge 32 f (cluster width 1474 to 1076 px at 1080p). Build 104 f at +0.2%/f, E.linear. Burst 24 f, peaking at 72 px/f with motion blur; the last cards clear by f24, then hold the hero. Shorter scatter-only version: cards leave on E.in over 22 f, with travel scaled by (1 + 0.1 * index).

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
