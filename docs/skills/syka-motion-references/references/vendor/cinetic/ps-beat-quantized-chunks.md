# Phrase chunks on the beat

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ps-beat-quantized-chunks
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: pacing_structure; energy: medium; role: workhorse; formats: launch, feature, sting, vertical

## Mechanism
A line arrives in two or three chunks split by meaning, each landing exactly on the next beat, so the reading rhythm is performed by the track.

## Use when
Statement lines over music with a clear pulse, launch openers, and 3-7 word claims.

## Avoid when
No music or a free-time score, and sentences of more than 8 words.

## Original recipe (adapt to Syka native time and nodes)
Split the copy into 2-3 chunks by meaning (subject | object | qualifier). Chunk k starts at b(bar, beat + k) minus half its first word's rise, so the rise's 50% frame lands on the beat. Words inside a chunk follow 4 f apart, each on a baseline line-mask rise (an overflow-hidden line box, translateY 100% to 0 on E.out with arrive()). For a calmer build, use one beat per word with a blur-to-focus reveal: opacity 0 to 1 over 8 f, blurIn from 8 px across 18 f, a 13 px rise over 28 f on E.out, plus a 1 px/f line drift. Hold the finished line for at least 36 f + 6 f per word.

## Original timing
One beat per chunk (30 f at 120 BPM); 4 f word stagger inside a chunk; masked rise 6-8 f E.out, stretched to 10-12 f for words over 60 px tall so legible glyphs stay under 20 px/f; calm variant 20-22 f per word.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
