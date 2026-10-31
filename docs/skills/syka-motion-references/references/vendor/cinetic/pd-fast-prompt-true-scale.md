# Fast prompt at true scale

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · pd-fast-prompt-true-scale
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: product_demo; energy: medium; role: workhorse; formats: launch, feature, walkthrough, vertical

## Mechanism
The real prompt bar fills with a long, honest instruction in about a second at full legible size, the card growing as lines wrap, then the text is sent up into a chat bubble.

## Use when
An AI, search or command product whose real input is the story; showing a real task without a dull typing wait.

## Avoid when
The prompt runs past about 100 characters (cut it); a human-paced beat is the point (use 30 cps with human rhythm); the product is not input-driven.

## Original recipe (adapt to Syka native time and nodes)
Type with TypeOn (src/fx/TypeOn.tsx), either time-boxed (dur 68, ease E.linear, so prompts of any length finish in 68 f and every ask beat keeps its length) or at a fixed 50-72 cps; pre-fill the first word so frame 1 already shows text, and draw the newest three characters at 0.3/0.6/0.85 opacity, each arriving in C.accent and relaxing to ink over 12 f. Grow the card from the measured text box: width ≈ 67% → 77% of frame over the first 24 f, then one line height over 12 f on E.out at each wrap, decided on fd(f). Keep the frame alive with breath(t, 0.025) from src/lib/camera.ts on the camera; the caret is solid while typing and blinks 16 f on / 16 f off only once done. On the send press the composer text fades out over 12 f while the bubble rises 12-20 px through arrive() and fades in over 16-18 f, starting 4 f later.

## Original timing
Time box 68 f, or 50-72 cps (0.8-1.2 characters per frame); card width 24 f, +1 line per wrap in 12 f on E.out; read hold after typing at least 36 f + 6 f per word, kept alive by the breath; send: 12 f out, bubble 16-18 f in with a 4 f offset.

Upstream evidence count: 3; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
