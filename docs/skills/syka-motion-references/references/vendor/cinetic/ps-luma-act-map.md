# Light and dark as chapters

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ps-luma-act-map
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: pacing_structure; energy: any; role: workhorse; formats: launch, feature, walkthrough

## Mechanism
Acts are planned by stage polarity, dark for the abstract or problem beats and light for the product, so chapter changes read without any title cards.

## Use when
Films with distinct problem/solution or prompt/result halves, and 20-60 s pieces that need a rhythm at the scale of whole acts.

## Avoid when
Very short stings, and brands locked to a single stage colour.

## Original recipe (adapt to Syka native time and nodes)
Add a LUMA map beside ACT in src/timeline.ts ('dark' or 'light' per act) and two stage token sets in src/brand/tokens.ts (dark at value 0.10-0.30, light at 0.85-0.95; the accent colour stays the same). Pick one plan. Alternation: about 50/50 dark and light, flipping at each ask/answer change. Arc: dark open, mixed middle, light product finish. Flips land on downbeats, 3-5 per film, and never use the same device twice in a row: an inverse hard cut, an inverse match cut on a shared icon, an iris from a glyph (20 f E.inOut), a bleach to white (26 f E.smooth), or a theme flip during a move (6 f). An optional second channel is a single-hue brand wash (one Background component with intensity 0-1) that shows only on brand beats: it rises from the bottom edge (translateY 40% to 0, 50 f E.out) and drains in 8 f E.in.

## Original timing
3-5 flips per film, each on b(n); iris 20 f E.inOut; bleach 26 f E.smooth; theme flip during a move 6 f; wash rise 50 f E.out, drain 8 f E.in.

Upstream evidence count: 5; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
