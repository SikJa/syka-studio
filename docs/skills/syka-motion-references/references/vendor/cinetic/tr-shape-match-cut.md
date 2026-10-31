# Shape match cut

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · tr-shape-match-cut
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: transition; energy: medium; role: workhorse; formats: any

## Mechanism
The hero shape leaves one shot at a known point and size, and the next shot opens on a matching shape (the mark, the flat UI, the real object) on the same point, so the object's identity carries across a change of world.

## Use when
Turning a problem shape into the answer, a device mockup into the bare UI, or a physical object into the mark.

## Avoid when
The silhouettes differ (round against tall), so the match cannot be seen. Use a dot relay or a container morph instead.

## Original recipe (adapt to Syka native time and nodes)
Record the outgoing shape's centre and size on its last frame (toScreen from src/lib/camera.ts, or inkBox from src/lib/measure.ts for type). Open the incoming act with the matching shape centred there within ±20 px, at 0.57-1.3x that size. Keep motion on both sides. The outgoing shape shrinks 2-4% over its last 4 f on E.in (or a coin turns face-on, rotateY 90 → 10 deg over 22 f on E.out). The incoming shape keeps going, for example k = lmix(0.57, 1, prog(f, 0, 18, E.out)), with no overshoot. Match colour, corner radius and stroke weight so only the medium changes (device screen to flat UI, coin emblem to logotype, circle to app icon), and hold the result 12-30 f before it moves on.

## Original timing
Cut in 0 f. Centre offset ≤ 20 px. Scale ratio 0.57-1.3x. Incoming settle 18 f on E.out, with half the change done in about 2 f. Outgoing pre-cut shrink 4 f on E.in. Hold 12-30 f.

Upstream evidence count: 4; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
