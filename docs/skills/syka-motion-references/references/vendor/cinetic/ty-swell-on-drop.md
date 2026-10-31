# Quiet type swells on the drop

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ty-swell-on-drop
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: typography_motion; energy: high; role: signature; formats: launch, sting, vertical

## Mechanism
A word appears small and low-contrast and waits through the build, then swells to hero size, with 90% of the growth landing exactly on the beat drop.

## Use when
A hero word or product name that should detonate on the drop after a quiet intro. The one appearance of the final wordmark when the music builds into the end. A single-word answer after a question beat.

## Avoid when
There is no real musical hit to land on. Words wide enough to swell past the safe area. Using it more than once per film. Stacking a separate scale punch or camera kick on the same hit.

## Original recipe (adapt to Syka native time and nodes)
Set the word at about 9% of the frame height, centred, in C.mute (or at 0.5 opacity on ink), and bring it in quietly: per-letter opacity pops 5-6 f apart decided with fd, or ty-typeon-timeboxed. Put the drop frame h on the music's downbeat, register it in src/sync.ts, and scale the group about its centre with k = lmix(1, 2.5, prog(f, h - 32, h + 22, E.glide)), so 90% of the log-scale growth lands on h and the rest settles over 22 f. Run color mixColor(C.mute, C.ink, prog(f, h - 32, h, E.smooth)) so size and contrast peak together. Drive the scale with transform, never font-size, and keep the starting width under about 420 px, so the outer edges peak near 17 px/f (21 px/f at 2.9x) and the word stays readable through the swell; render the blurred master for the frames above 12 px/f. After the settle, keep it alive with a 0.3 px/f drift or a cam-living-hold creep, or cut within 54 f.

## Original timing
Letters 5-6 f apart at 9% of the frame height. Swell over 54 f on E.glide, starting at h - 32 so 90% lands on h: scale 1 -> 2.5 (2.9 at most) in log space, with the outer edges of a 420 px word peaking at about 16.5 px/f around frame 17. Contrast goes C.mute -> ink over the 32 f before h. Hold at most 54 f after h, or 90-120 f if this is the final lockup's one appearance.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
