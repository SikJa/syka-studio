# Travelling thread object

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ps-continuity-thread
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: pacing_structure; energy: high; role: signature; formats: launch, feature

## Mechanism
One small accent object (a dot, a packet or a streak) recurs across shots and acts, carrying the idea from problem to feature to feature as a single causal chain.

## Use when
Abstract or concept-led launch films whose beats are visually disconnected, and stories about value or data travelling.

## Avoid when
Plain UI walkthroughs where a cursor already guides the eye, since two guides compete.

## Original recipe (adapt to Syka native time and nodes)
Build one Thread component: a round head 2-3% of frame height plus a tapered tail whose length scales with speed (tail = clamp(v * 1.5, 0, 240) px). Each scene drives it along a path (SVG getPointAtLength) with a speed curve that is always fast: E.contact into an impact or E.out into the distance. Across a cut it re-enters from the same screen side and at the same angle it left by, and it hands off by becoming the next scene's element (a check, a pin, a button fill), with squash() on contact. The full look surrounds the head with a bloom halo and shifts its tint on each beat (one beat goes violet). Use 3-5 appearances over 9-15 s at the same size every time.

## Original timing
3-5 appearances of 20-60 f each; head 2-3% of frame height; travel 20-60 px/f with true motion blur; contact squash over about 8 f; hitPulse(t, 2, 5) on the struck element.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
