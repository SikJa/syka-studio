# Directional impact kick

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · cam-impact-kick
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: camera; energy: high; role: accent; formats: launch, sting, feature, vertical

## Mechanism
On a true impact (a card landing, a lock-in, a slam) the whole frame jolts a few pixels in the direction of the hit and pushes a hair closer, then settles within a fifth of a second.

## Use when
True landings and lock-ins: a heavy object slamming into a slot, or a statement locking together on a hit.

## Avoid when
Every beat or tick (that makes a shake, not a hit), soft UI arrivals, or mid camera move (it fights the move's ease).

## Original recipe (adapt to Syka native time and nodes)
On the impact cue c, add a decaying jolt to the anchor camera: sx += dir.x * 8 * hitPulse(f - c, 1, 4) and sy += dir.y * 8 * hitPulse(f - c, 1, 4), where dir is the unit vector of the incoming object's travel, and multiply k by 1 + 0.015 * hitPulse(f - c, 2, 5). Take c from the contact frame in src/lib/sync.ts so sound and picture peak together, pair it with squash() on the landing object, and never add roll. Use it at most 2-3 times per film, and only where something truly lands.

## Original timing
Jolt 6-10 px, attack 1 f, tau 4 f (gone in about 25 f). Push +1.5%, attack 2 f, tau 5 f. At most 2-3 per film.

Upstream evidence count: 0; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
