# Silence as the default bed

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ps-silence-first-sound
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: pacing_structure; energy: calm; role: signature; formats: sting, feature, vertical

## Mechanism
There is no running music: most of the film is true silence, sound appears only on decisive events, one low swell carries the single reveal act, and the audio cuts dead on the frame a key value lands.

## Use when
Short stings and feature spots under about 15 s, calm or premium tones, number and unlock reveals, and films with fewer than about one decisive event per second.

## Avoid when
Launch films and walkthroughs over about 20 s, dense sequences with more than about 3 visible events per second (use a steady bed instead), briefs that supply a music track, or feeds where the brief asks for high energy.

## Original recipe (adapt to Syka native time and nodes)
Leave the sections array in audio/score.json empty, since bars outside every section get no music, and build the soundtrack only from src/sync.ts events, each tied to a decisive picture event. Open on a tick cluster whose first onset sits on frame 0 (five tick events at +0, 4, 8, 11 and 14 f under the opening mechanic). Give each appearance cut one centred tick (pan 0, weight 0.35, 1-3 f after the cut), and let a run of removals multiply the weight by 1.26 per tick so the run gets louder as the edit speeds up. The only sustained sound is one low pad under the reveal act: a section with style breakdown, layers {drums: 0, arp: 0, bells: 0, bass: 0} and level about 0.5 spanning that act, a swell event that peaks on the first reveal, and a one-bar tail section after it so the pad rings out instead of stopping. On each resolution frame (a number lands, a polarity cut), schedule nothing after the last tick so the sound stops within a frame, and put one bell there at weight 0.15 with pitch 'D8' as a faint high shimmer. Close by repeating the opening cluster at the same spacing under the stinger, then let the lockup's single land ring into silence over a slow push. The picture never sits still longer than 48 f, any designed freeze also gets a silences entry, and master.lufs is -16.

## Original timing
At least 50% of the runtime silent, in gaps of 30-96 f between sound clusters. Opening cluster: 5 ticks over 14 f from frame 0. Reveal pad: on from the act's first frame, swell peak on the first reveal, about 42 f of plateau, about 84 f of ring-out. Sound stops within 1 f of each resolution; the shimmer bell (weight 0.15) fades over about 54 f. Removal ticks rise about 2 dB each. Lockup hold 90-120 f in silence after its single land, under a push of at least 10% across the hold.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
