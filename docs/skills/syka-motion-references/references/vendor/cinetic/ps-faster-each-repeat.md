# Each repeat runs faster

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ps-faster-each-repeat
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: pacing_structure; energy: medium; role: workhorse; formats: any

## Mechanism
The first instance of a repeated action plays at full length, the second runs about 40% quicker, and later ones are implied or ratchet faster still.

## Use when
Repeated unlocks, card reveals, list items, word deletes, and captions that recur across a film.

## Avoid when
Items that each need a full read, and the first instance, which must teach the pattern at full length.

## Original recipe (adapt to Syka native time and nodes)
Give the repeated component a duration parameter: dur_k = max(minDur, base * 0.6^k) for k = 0, 1, 2, and so on. It is the same curve compressed, so an E.out rise stays E.out. Show two full instances, then cut away or batch the rest. For lists, swaps and deletes, schedule start frames from shrinking gaps and pick the visible state with fd(frame). Across a film, the caption word stagger in src/fx/Words.tsx can fall the same way from the title to the last feature. Bind a repeat run with one low pad swell under the whole run (attack 6-9 f, release over about 84 f), with one tick per step growing by about 1 dB each time.

## Original timing
Second instance at 0.6x length (for example a rise of 12 f becomes 7 f), starting about 46 f after the first. Ratchet gaps 26, 14, 12, 8, 8, 4, 4 f. Caption word stagger falling from 24 f on the title to 5 f on late captions.

Upstream evidence count: 3; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
