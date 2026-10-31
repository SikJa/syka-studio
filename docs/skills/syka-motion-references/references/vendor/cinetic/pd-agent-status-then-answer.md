# Agent status beat, then streamed answer

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · pd-agent-status-then-answer
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: product_demo; energy: calm; role: workhorse; formats: launch, feature, walkthrough, vertical

## Mechanism
The product's tiny working status is shown at hero size, as a black capsule with a spinner and a typed label or as bare headline type, holds for a beat with a looping ellipsis or shimmer, then dissolves as the answer streams in.

## Use when
An AI or agent product needs its invisible work made visible, and a moment of anticipation before the payoff.

## Avoid when
The product is not autonomous; the hold would run past about 74 f; a second status beat in the same film.

## Original recipe (adapt to Syka native time and nodes)
Build the status as a capsule (height ≈ 8.4% of frame, border-radius 999 px, C.ink fill, an 8-dot spinner stepping 45° every 6 f, label typed with TypeOn) or as bare type at 72-100 px with a clock or spinner glyph at cap height, its trailing word arriving in C.accent and relaxing to ink with mixColor over 24 f. Keep the hold alive with a looping ellipsis '.'.repeat(1 + (Math.floor(fd(f) / 16) % 3)) and a one-hue shimmer (background-clip: text over three lightness stops of the label grey, band ≈ 120 px, position linear in f), while the camera settles 1.62 → 1 with lmix over 56 f on E.outSoft. Dissolve the status over 12 f on E.smooth, then stream the answer with TypeOn at about 60 cps, the newest three characters at 0.3/0.6/0.85 opacity and each new character in the accent relaxing to ink over 12 f. When the status itself is the payoff, type it, hold 30 f and dim it to C.mute over 12 f instead of streaming.

## Original timing
Label types in about 30 f (40 f at headline size); hold 60-74 f with the ellipsis stepping every 16 f and one shimmer sweep per 60 f (≈ 20 px/f); camera 1.62 → 1 over 56 f on E.outSoft; dissolve 12 f; stream ≈ 1 character per frame (41 characters in about 42 f); payoff variant: hold 30 f, dim 12 f.

Upstream evidence count: 3; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
