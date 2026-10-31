# Reading-order word exit

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ty-reading-order-exit
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: typography_motion; energy: any; role: workhorse; formats: any

## Mechanism
Words leave one by one in reading order, each lifting a few pixels and vanishing, until only the hero element is left on screen.

## Use when
Isolating a hero word or object before a match cut or zoom; clearing a statement gently before a calmer UI moment; mirroring a word-by-word entry.

## Avoid when
Walkthrough captions just before a camera move: fade the whole caption at once over 26 f on E.smooth and finish 0-56 f before the move starts; exits that would hurry a payoff line.

## Original recipe (adapt to Syka native time and nodes)
For each word except the hero, o_i = out + 4i and q = prog(f, o_i, o_i + 10, E.in): translateY = -depart(q) x 0.12 em, opacity = 1 - prog(f, o_i, o_i + 10, E.smooth) (never fade on E.in, which pops), blur = blurOut(q, 4). The hero word, icon or pill stays put, and the next move (zoom, match cut) starts from it within 6 f of the last word clearing. Loosen variant for a calm handoff: words drift apart vertically by sign_i x (10 + 10 x rand(i)) px with a rotation of +-2 degrees, fade toward the ground colour first (mixColor(C.ink, C.mist)) and then to 0, over 20 f on E.smooth, 6 f apart.

## Original timing
Per word 10 f, lift 0.12 em (about 14 px), stagger 4 f (2-6), a 5-word line clears in about 26 f; loosen variant 20 f per word, 6 f apart, about 32-44 f in all.

Upstream evidence count: 3; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
