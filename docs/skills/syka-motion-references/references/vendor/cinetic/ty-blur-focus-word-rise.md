# Blur-to-focus word rise

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ty-blur-focus-word-rise
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: typography_motion; energy: calm; role: workhorse; formats: launch, feature, walkthrough, vertical

## Mechanism
Words materialise one per beat out of a soft blur, rising a few pixels and darkening to full ink as they sharpen.

## Use when
Calm, premium statements that keep pace with a voice-over or a slow bed; the opening line of a quiet film; light grounds.

## Avoid when
High-energy acts or dense beats (the stagger is too slow); pale type on a pale ground (under 4.5:1); any blur left on readable text for more than 6 f.

## Original recipe (adapt to Syka native time and nodes)
Use src/fx/Words.tsx with stagger 20, dur 28, rise 0.11 (em) and blur 8: each word fades in, rises through arrive(p) and sharpens through blurIn(p, 8), so the blur is gone by frame 4 while the word is still moving and half transparent. Pass wordStyle to resolve colour as well: color = mixColor(C.mist, C.ink, p) on paper (C.mute -> C.white on ink), so a word reads pale and soft first, crisp and dark on landing. Give the whole line a 0.5 px/f translateX drift on E.linear so it never freezes, and start the first word while the camera is still decelerating so reveal and settle read as one gesture. For a URL, start the path segment 8-12 f after the domain.

## Original timing
Per word 28 f E.out; opacity 8 f; blur 8 -> 0 px, clear by frame 4; rise 13 px at 120 px type (peak about 3 px/f); stagger 20-22 f (one word per beat at 160-180 BPM); line drift 0.5 px/f.

Upstream evidence count: 3; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
