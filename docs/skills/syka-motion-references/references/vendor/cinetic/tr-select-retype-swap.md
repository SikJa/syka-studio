# Select and retype swap

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · tr-select-retype-swap
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: transition; energy: calm; role: accent; formats: launch, feature, walkthrough, vertical

## Mechanism
A finished headline is selected like text in an editor, the highlight holds for a beat, and on one frame the selection is replaced by a caret that types the next line in the same place.

## Use when
Products where text is the medium (editors, prompts, writing and AI tools); correcting a claim, where the assumption is selected and overwritten by the answer; two or three headline swaps that should feel authored.

## Avoid when
The product has nothing to do with text, lines run past about 40 characters (the typing outlasts the read), or the swap repeats more than three times in a row and turns into a typing demo.

## Original recipe (adapt to Syka native time and nodes)
Set both lines left-aligned in the same font, size and baseline, with line A rendered as per-character spans. The selection is a highlight rect 1.15 em tall from the ascender line: C.ink on paper with the covered glyphs switched to C.paper, or C.white with C.ink glyphs on an ink stage. Its left edge jumps one word leftward every 2-3 f, from the last word to the first, decided with fd and placed from measureTracked prefix widths; for a select-all it covers the line in one frame. The caret sits solid at its left edge. Hold the selection 10-12 f. Then, on one fd frame, remove line A and the highlight together, leave the caret at the line start and put one tick on that frame. Type line B with TypeOn from the same frame (2 f per character on E.type, head fade 4 f, caret blinking once idle). For a centred line, offset it by (full width − typed width)/2, using typeOn().followX through a 6-10 f lag. If the new line's last word is the beat that lands, give it the accent and relax it to ink over 12 f through charStyle.

## Original timing
Selection 2-3 f per word (or a 1 f select-all), hold 10-12 f, replace on 1 f. Line B types at 2 f per character on E.type (a 20-character line in 40 f), and the caret blinks 30 f on, 30 f off once idle. About 60-75 f in all for a five-word, 20-character pair.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
