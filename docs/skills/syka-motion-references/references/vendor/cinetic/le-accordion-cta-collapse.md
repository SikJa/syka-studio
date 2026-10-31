# CTA line closes its gaps

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · le-accordion-cta-collapse
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: logo_and_end_card; energy: calm; role: accent; formats: launch, feature, walkthrough

## Mechanism
The end line starts with exaggerated spaces between its words, which close as the line settles centred; the last word, often the URL, travels farthest, so the eye ends there.

## Use when
A one-line CTA (a sentence plus a URL) after a large type beat. Type-led films whose last beat is a phrase locking together.

## Avoid when
Lines that wrap to two rows. Films that already closed a word gap earlier. Vertical frames where the stretched line would exceed the safe width.

## Original recipe (adapt to Syka native time and nodes)
Lay the final line out centred. Give word i a start offset off_i = 70 + 80 * i px (capped at 290 px) in the direction of travel, so the last word travels farthest. Drive each word as x_i = finalX_i + off_i - inertia(f, a, off_i/14.6, 0.934).x: a pure exponential close with tau = 14.6 f and no overshoot (horizontal moves need no arrive). Enter on a hard cut from a larger line whose total width matches this line's stretched width. Optionally keep the URL soft for 8 f after it stops, then resolve it over 14 f with RackFocus, so focus is the last thing to settle.

## Original timing
tau = 14.6 f: 55% closed in 10 f, 95% by 44 f. The last word starts at no more than 20 px/f and only slows from there. Gaps of ~150/115/80 px close to a normal word space (~0.25 em). URL focus: soft for 8 f, resolved over 14 f.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
