# Cursor into a field, two-stage push, typed provocation

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · oh-cursor-search-push
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: opening_hook; energy: medium; role: accent; formats: launch, feature, walkthrough

## Mechanism
A small search pill sits still on a dark stage; a text cursor drifts in, the camera pushes in twice to a macro framing, and a provocative query types into the field before any brand appears.

## Use when
AI, search or command products, or any opener whose hook is a question the product answers.

## Avoid when
The product has no input field, the film's camera grammar is flat, or the query runs past about 40 characters (the macro framing cannot hold it).

## Original recipe (adapt to Syka native time and nodes)
Lay out the pill as world content under the anchor camera (camera(lc(A, B, t)) from src/lib/camera.ts), anchored on the caret. An I-beam SVG, placed by transform only as Cursor is, is already travelling on frame 0: it arrives on cursorArc (bow 0.2) over 30 f on E.glide, with a soft offset shadow (a copy blurred 6 px at 35% black, offset about a quarter of its height). The camera holds for the first 24 f, then push 1 takes k from 1 to 2.16 over 42 f on E.cam and push 2 from 2.16 to 7.2 over 44 f on E.glide (lc mixes k in log space, so the zoom rate stays even). Start TypeOn (cps 30) at about 60% of push 2 and feed typeOn's followX into the camera anchor through a 6-10 f lag so the camera tracks the caret without stepping; size the pill so one character advances at most 40 px on screen at 7.2x, which keeps the caret-following scroll of the typed text under 20 px/f. Draw no halo around the pill. Sound: micro ticks only (2-6 ms bursts high-passed above 4 kHz, at most one per word, 18-24 dB under the bed, with 20% seeded jitter in timing and gain), muted once the drums enter.

## Original timing
Camera still for 24 f while the cursor flies in from frame 0 (30 f on E.glide); push 1 42 f (f24-66, peak 0.077 ln k per frame); push 2 44 f (f66-110, peak 0.082 ln k per frame); 7.2x in total over 88 f; typing from about f92 at 30 characters/s, each character at most 40 px wide on screen.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
