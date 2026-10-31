# Time-boxed eased type-on

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ty-typeon-timeboxed
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: typography_motion; energy: medium; role: workhorse; formats: feature, walkthrough, launch, vertical

## Mechanism
Text types in with most of the line appearing in the first few frames, and every line, short or long, finishes in the same musical length.

## Use when
Prompts, search queries and names typed into the product; UI labels appearing while the camera trucks; keeping a run of typed beats on one musical length.

## Avoid when
Statements nobody would type; keystroke clicks on every glyph (let the music carry it); letter-by-letter reveals of a name whose prefixes spell another word.

## Original recipe (adapt to Syka native time and nodes)
Visible count n = fd(N x prog(f, s, s + 68, E.out)) for prompts and headlines (45% of the string by frame 6, the last letters trickle in), or E.linear at 22-45 characters/s for small mono UI labels; pre-fill the first word so frame 1 already shows text, and pre-solve the layout (left-anchored in a fixed centred box, or a pill sized to the final string) so nothing reflows. The caret is a 0.08 em x 1 em bar that rides the text while typing and blinks at 1 Hz (30 f on, 30 f off, decided with fd) only after completion, and is gone before the hold ends. When the line outgrows 88% of the frame width, translate the container by min(0, 0.88W - caretX), eased over 8 f per character, and fade the head out through a mask-image over the left 25%. To replace a typed line, turn the whole string accent for 6 f, swap it on one frame and retype the new one in 26 f.

## Original timing
Box 68 f per line whatever its length (26-32 f for a headline under 22 characters, 84 f for giant type); E.out count; mono labels E.linear 22-45 cps; caret blink 30/30 f after completion; caret-follow 8 f per character, head mask 25%; retype: 6 f accent, 1 f swap, 26 f retype. Hold at least 36 f + 6 f per word after the last glyph.

Upstream evidence count: 4; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
