# Macro number scramble, one-frame snap-out

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · oh-macro-scramble-snap-out
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: opening_hook; energy: high; role: signature; formats: launch, sting, feature, vertical

## Mechanism
Huge digits fill and overflow the frame, re-rolling every frame. On one frame the view cuts back to the whole figure, which rolls into the final metric and holds: the number is the hook before any brand appears.

## Use when
The strongest proof is one metric (users, hours saved, uptime) and the film earns attention with the outcome before the brand.

## Avoid when
There is no credible or impressive number, or the tone is calm and premium.

## Original recipe (adapt to Syka native time and nodes)
Lay out the final figure once with typeStyle('display') (tabular figures, fixed group separator) at a size where the whole string spans about 0.9 W, and draw each digit column as a Roll-style strip whose mask stays 1.6 lines tall during the macro phase, so outgoing digits stack and overflow vertically. Macro phase: scale the wrapper to 1.22 about the frame centre and, on every whole frame (fd), give 1-2 columns a new digit from rand(`${seed}:${fd(frame)}`). Snap: on a single frame decided with fd (so the motion-blur sub-samples agree), cut the scale to 1.0 with no tween, clip the masks to one line and lock the columns left to right 3 f apart until the final string is forced; then hold on breath (scale +0.065%/f) with no glints or sparkles, and keep the brand out until the end lockup. Sound: five dry glitch ticks inside the first 0.6 s, then the bed drops at least 30 dB within one frame on the lock frame and stays silent through the hold; reuse the identical tick cluster under the closing sting as a bookend.

## Original timing
Macro 29 f; snap 1 f at f29; settle 12 f; final string forced from f41 (0.68 s); hold 72 f with only the scale drift. Ticks at about 0.17, 0.23, 0.31, 0.36 and 0.40 s.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
