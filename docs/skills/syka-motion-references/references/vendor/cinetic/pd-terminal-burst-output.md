# Command runs, output prints in bursts

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · pd-terminal-burst-output
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: product_demo; energy: medium; role: workhorse; formats: feature, walkthrough, launch

## Mechanism
A command is typed at human speed and entered; the terminal answers machine-fast, printing whole lines in uneven bursts with a stepping spinner and a progress bar, and ends on a single success line.

## Use when
Developer tools, CLIs, infrastructure and build products, where the contrast between a human-typed command and machine-fast output is the speed claim.

## Avoid when
The audience is not technical, or the output itself must be read line by line (show the result screen instead); never type the output.

## Original recipe (adapt to Syka native time and nodes)
Set the terminal in FONT.mono at no less than TYPE.ui size, in a C.ink2 window with a 1.5 px edge, with every line laid out from data on a fixed line height, and keep breath(t, 0.02) on the camera for the whole run. Type the command with TypeOn at a human 30 cps with fade 0 (keys appear whole), hold the caret 10 f, then enter on a quiet tick. Output never types: each line appears whole on its own frame from a hand-written schedule of uneven bursts (for example 3 lines on consecutive frames, a 14 f gap, 5 lines 2 f apart, a 22 f gap), decided on fd(f), with the newest line in C.white and older ones relaxing to C.mute over 24 f; once text reaches the bottom row, each burst scrolls the content up by its total height as one move over max(6, 0.14 × distance) f on E.ui, so text never passes 20 px/f. A working line steps the four-glyph ASCII spinner (bar, slash, dash, backslash) every 4 f beside a text progress bar whose filled cells advance on fd(prog(f, a, a + 60, E.smooth) × cells), and the run ends on one success line whose check mark and key word arrive in C.accent and stay, followed by a fresh prompt with the caret blinking 30 f on, 30 f off.

## Original timing
Command at 30 cps, caret hold 10 f; bursts of 2-6 lines 1-2 f apart with 10-24 f gaps (40-80 lines in 120-180 f reads machine-fast); line relax 24 f; burst scroll max(6, 0.14 × px) f on E.ui; spinner step 4 f; progress bar 60 f on E.smooth; success line held 48-60 f under the breath with the caret blinking 30/30.

Upstream evidence count: 0; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
