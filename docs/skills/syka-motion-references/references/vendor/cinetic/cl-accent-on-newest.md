# Accent on the newest arrival

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · cl-accent-on-newest
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: color_and_light; energy: medium; role: workhorse; formats: feature, walkthrough, launch, vertical

## Mechanism
Whatever just arrived (a typed character, a snapped word, a generated pill) wears the accent for a moment and then settles to neutral, so a short coloured wake leads the eye.

## Use when
Prompts typing, statements building word by word, AI-generated items appearing, or any build where the newest piece should lead.

## Avoid when
The accent already means something else in the shot (a focus ring or a pressed button), or long paragraphs where the wake becomes noise.

## Original recipe (adapt to Syka native time and nodes)
Store each item's birth frame. Type-on: give each glyph span colour = mixColor(C.accent, C.white or C.ink, clamp((frame - birth) / 12)); at 1-1.7 chars/f this leaves a wake of 10-20 characters behind the caret. Word builds work as either a wave or a step. Wave: each word is grey for 4 f, accent at about 8 f and ink by 16-20 f, on E.out. Step: the word that snapped last holds the accent (fd(frame) >= snap[i] && fd(frame) < snap[i+1]), and the final word keeps it until 1 frame before the cut. Objects (generated pills, pins, cards, an end-card icon): stack an accent-tinted duplicate clipped to the shape (mix-blend-mode: color) and fade it from 1 to 0 on E.out. Use one accent hue only: no multi-stop hue cycle, no bloom, no text-shadow.

## Original timing
Glyph decay takes 12-16 f on E.linear. A word wave takes 16-20 f per word with an 8-12 f stagger. A step holds 16-20 f per word. An object's tint resolves over 20-40 f on E.out.

Upstream evidence count: 6; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
