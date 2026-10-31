# In-place word light-up on beats

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ty-inplace-light-up-beats
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: typography_motion; energy: calm; role: workhorse; formats: launch, feature, walkthrough, vertical

## Mechanism
The finished line is laid out from the start and its words light up in place, chunk by chunk on the beat, with the last word held back.

## Use when
Titles and walkthrough captions over a moving camera; lines with an inline glyph or partner wordmark that must not shift; music-led films where each chunk can sit on a beat.

## Avoid when
High-energy acts that need motion in the type itself; lines over 6 words (it turns into a slide).

## Original recipe (adapt to Syka native time and nodes)
Lay out the final centred line once; every word is a span at its final position with opacity 0, so nothing ever reflows. Group the words into 2-3 chunks that start on beat frames, 6 f apart within a chunk; each word's opacity is tw(f, s, s + 5, 0, 0.75, E.linear) then rises to 1 over the next 40 f on E.outSoft (fast attack, slow brightening tail). Hierarchy without a second colour: keywords at weight 600, connectors at 400 held at 0.55 until the last chunk lands and then raised to 1 over 12 f; the final word or qualifier arrives a full beat late, and a qualifier may sit tucked under the line's right edge at 0.35x size. Across a film, shorten the per-word stagger from 24 f on the title to about 6 f on later captions, because viewers learn the pattern; exit the whole line at once.

## Original timing
Attack 5 f to 0.75, tail 40 f E.outSoft to 1; 6 f within a chunk, chunks on beats; last token +24-34 f; connectors 0.55 -> 1 over 12 f; title stagger 24 f shrinking to 5-6 f; exit all words together over 26 f E.smooth. If the camera is locked, add a 0.3 px/f line drift.

Upstream evidence count: 4; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
