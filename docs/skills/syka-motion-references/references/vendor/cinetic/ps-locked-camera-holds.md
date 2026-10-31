# Camera locks, the interface performs

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ps-locked-camera-holds
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: pacing_structure; energy: calm; role: workhorse; formats: walkthrough, feature, launch

## Mechanism
After each move the camera stops dead, and for a 1-4 s read only the caption, the cursor and one micro-interaction move.

## Use when
Dense product UI that must be read, walkthroughs, and films where every move should feel deliberate because it contrasts with stillness.

## Avoid when
Kinetic type or fast montages where a dead camera reads as a stalled player, or holds with nothing in the UI to animate.

## Original recipe (adapt to Syka native time and nodes)
Between poses, blend with lc(A, B, E.cam(p)) from src/lib/camera.ts. At each pose, hold the Shot exactly: no breath(), scale constant, 0.0 px/f. Schedule events from the move's end so that no gap between visible changes exceeds 40 f: the UI action at moveEnd - 10 f, the caption word reveal (src/fx/Words.tsx) at moveEnd - 0.25 * moveDuration, cursor travel (src/fx/Cursor.tsx) on E.glide. Ambient life lives only in the background, for example a single-hue wash breathing ±3% opacity on a 240 f sine. The caption leaves as one block, opacity on E.smooth over 26-28 f with no stagger, and is gone 0-56 f before the next move starts.

## Original timing
Holds 60-240 f (median about 150 f) at exactly 0 px/f; an in-frame event at least every 40 f; moves between holds 56-108 f E.cam; caption exit 26-28 f E.smooth, ending 0-56 f before the next move.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
