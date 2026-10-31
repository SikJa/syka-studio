# Score arranged to the acts

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ps-score-mapped-to-acts
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: pacing_structure; energy: any; role: signature; formats: launch, feature

## Mechanism
The music's arrangement tells the story's structure: a sparse filtered intro, the drop on the first product frame, a breakdown for the calm act, a return for the proof, a final hit on the climax and the logo in silence.

## Use when
20-60 s launch films with clear acts, when the score is generated or its stems can be edited.

## Avoid when
A supplied track with a fixed structure (retime the picture to its bars instead), and 3-6 s stings.

## Original recipe (adapt to Syka native time and nodes)
Cut the picture first, then write audio/score.json sections bar-aligned to each ACT. Start with an intro of sparse layers (no sub, no kick, filtered pad and plucks, wide) that sounds at intent from frame 0 and builds about 10 dB. Put the drop on the first product shot (a drops entry on that act's downbeat, sub 8-12 f before the cut, kick on the cut frame). Run groove or drive for the proof, a breakdown (layers {drums: 0}) for the calmest act, a return on the next act's downbeat, a hit on the climax burst, and a hold with the lockup in silence. Hard cuts inside sections snap to onsets within ±4 f, act seams fall within ±4 f of the section change, and on the big drop the picture may lead the downbeat by up to 8 f.

## Original timing
Intro 120-160 f; the drop and its cut within 1 f (or the picture leads by up to 8 f); cuts within ±4 f of onsets; breakdown 2-4 bars; the final hit's tail reaches -60 dB in about 35-55 f.

Upstream evidence count: 4; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
