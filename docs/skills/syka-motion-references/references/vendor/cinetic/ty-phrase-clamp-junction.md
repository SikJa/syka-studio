# Phrase clamp at a junction

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ty-phrase-clamp-junction
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: typography_motion; energy: medium; role: signature; formats: launch, feature, sting, vertical

## Mechanism
Two halves of a phrase arrive from opposite directions and lock on one baseline at a fixed junction, like a clamp closing.

## Use when
A two-part claim whose halves mean more together (subject + promise, problem + fix); the payoff line; a junction that a slot roller will reuse.

## Avoid when
Lines over 5 words or halves of very unequal length; more than once per film; the end lockup.

## Original recipe (adapt to Syka native time and nodes)
Fix a junction (x about 48% of the frame, on the shared baseline): the first half is right-aligned to it and the second half left-aligned, both measured with measureTracked so the junction gap is exactly one word space. Vertical default: hold the first half alone for 1 f at +64 px (the pre-pose), then translateY +64 -> 0 on arrive(p), p = prog(f, s, s + 18, E.out), while each word of the second half drops -40 -> 0 the same way, word i starting at s + 2i; give every piece opacity 0 -> 1 over 3 f and blurIn(p, 8), because frame 1 moves about 20 px/f. Horizontal snap: the line cuts in at full strength with each half 35 px out from the junction, closes to 0.75 of the word space over 10 f on E.out, then eases back to the true gap over 18 f on E.outSoft (the one designed undershoot, never closing the space); calm variant: a 1.7x gap closes to 1x over 80 f on E.outSoft. Put the lock on a beat and give it one 1.5% scale punch with hitPulse(t, 1, 4).

## Original timing
Vertical: 18 f E.out, 64 px and 40 px travel (peak 19.7 and 12.3 px/f on frame 1), 2 f word stagger, 1 f pre-pose, opacity 3 f. Snap: 35 px per side over 10 f E.out (about 20 px/f on frame 1) to 0.75 of the gap, back over 18 f E.outSoft. Calm close: 80 f E.outSoft. Hold the locked line at least 54 f with a 0.3 px/f drift.

Upstream evidence count: 3; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
