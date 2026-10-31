# Music hole, then slam on the cut

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ps-music-hole-slam
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: pacing_structure; energy: high; role: workhorse; formats: launch, feature, vertical

## Mechanism
The low end, or the whole bed, vanishes for a fraction of a second under a key statement, then slams back on the exact frame of a picture event.

## Use when
Statement cards, key claims and the hero cut in any film with a groove bed.

## Avoid when
Calm brands with no drums, or more than one hole every 8 bars, where it stops working as an accent.

## Original recipe (adapt to Syka native time and nodes)
For a single statement, add a score.json drops entry ({at, silence: '1/8', suck: 0.2}) so the bed sucks down and stops 12-24 f before at. Then choose one of two placements. Either at is the cut itself, so the slam lands on the cut, or the statement card cuts in 3-12 f inside the silence and at is the next 8th, about 15-17 f after the cut. For a whole line, give its bar a section with layers {drums: 0, bass: 0} so only the pad holds, and put the next picture event (a cut, a mask click, a reveal) on the return downbeat within ±1 f. Keep the card's own sound tiny, and use 2-4 holes per minute, the deepest before the hero cut.

## Original timing
Hole 12-24 f for one statement or 2-4 beats for a line; the bed drops 10-20 dB or the sub goes fully silent; re-entry on a downbeat within ±1 f of a picture event; 2-4 holes per minute.

Upstream evidence count: 5; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
