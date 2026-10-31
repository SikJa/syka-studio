# Ghost suggestion accepted with a key

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · pd-ghost-suggestion-accept
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: product_demo; energy: calm; role: workhorse; formats: feature, walkthrough, launch

## Mechanism
As someone types, the product proposes the rest of the line as pale ghost text after the caret; a small key chip appears, the key is pressed, and the ghost text inks in left to right as the caret jumps to its end.

## Use when
An assistant that completes text, code, email or form fields inline: the moment the product does the work is one key away, and the cause (the key) and the effect (the ink) share a frame.

## Avoid when
The product generates whole answers rather than inline completions (stream the answer instead), or the suggestion runs past about two lines at readable size; never show more than two accepts in a row.

## Original recipe (adapt to Syka native time and nodes)
Type the user's prefix with TypeOn at a human 30 cps; 12 f after the last key, draw the suggestion as one span starting at the prefix's caretX from typeOn(), in the same font and baseline and in C.mute, appearing whole on one frame (or streaming at 2 characters per frame for a longer block), so nothing already typed reflows. Twelve px past its last glyph (or under the line end if that would cross the field edge), mount a key chip (a FONT.mono label at 0.6 em in a 6 px-radius box with a 1.5 px C.line border and a 3 px bottom edge) on spr(f, s, SPR.micro) from scale 0.8 with opacity over 6 f, and keep the 30-40 f wait alive with breath(t, 0.02) on the camera. On ACCEPT the chip presses with pressAt (translateY 2 px and its bottom edge 3 → 1 px, both times the press value), and on that frame a recolour front runs through the ghost text, k = fd(prog(f, ACCEPT − 1, ACCEPT + 10, E.linear) × n): each character behind the front switches from C.mute to C.accent on its frame and relaxes to C.ink over 12 f by its own age (mixColor), while the prefix caret is removed (caretOut = ACCEPT) and a caret appears at the suggestion's end on the same frame. The chip fades out over 8 f on E.smooth from ACCEPT + 4; in a multi-line block each line's front starts 3 f after the line above, and a rejection uses the same chip labelled Esc with the ghost text fading out over 8 f on E.smooth.

## Original timing
Prefix at 30 cps; ghost text 12 f after the last key, whole in 1 f (or 2 characters per frame); chip on SPR.micro with a 6 f fade; wait 30-40 f under a 2% breath; press 4 f down, 8 f recoil; recolour front 10 f per line (lines 3 f apart), accent relax 12 f; chip out over 8 f from ACCEPT + 4; read hold after acceptance 36-48 f.

Upstream evidence count: 0; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
