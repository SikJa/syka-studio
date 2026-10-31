# Animated line re-break

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ty-line-rebreak-glide
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: typography_motion; energy: medium; role: workhorse; formats: launch, feature, walkthrough

## Mechanism
A centred one-line statement re-breaks into a two-line stack, or back, with every word gliding from its old slot to its new one, so the layout changes without a cut or a jump.

## Use when
An inserted icon or a longer word makes a centred line too wide. A headline must stack to free half the frame for a product shot. Returning a stacked headline to a single line for the payoff.

## Avoid when
Lines over about 7 words. Re-breaks that carry the hero word far from where it was being read (keep it as the still anchor). More than one re-break per statement. Vertical formats, where a stack is already the default layout.

## Original recipe (adapt to Syka native time and nodes)
Pre-solve both layouts with measureTracked and baselineOf. Layout A is one centred line; layout B is two centred lines at pitch = lead x size, the block centred on the same point, optionally at a smaller size s_B. Store each word's centre in both. Move each word i as one FLIP: p_i = prog(f, s + 2i, s + 2i + D_i, E.glide), with D_i = clamp(0.15 x travel_i, 30, 48) f; x = mix(xA_i, xB_i, p_i); scale = lmix(1, s_B / s_A, p_i). Give y its own curve, mix(yA_i, yB_i, arrive(prog(f, s + 2i - 4, s + 2i - 4 + D_i, E.outSoft))), so words that change rows drop first and slide second and never pass through a neighbour. Keep travel under 320 px per word: E.glide peaks at about 3x its mean speed, so D = 0.15 x travel holds readable words near 20 px/f (render the blurred master). If a word would travel further, split the line differently or cut. When an insert causes the re-break (an icon popping into a gap), start it 6 f after the insert lands; once settled, drift the block at 0.3 px/f.

## Original timing
Per word, D = 0.15 x travel, clamped to 30-48 f, on E.glide (peak about 20 px/f, near 30% of the move). y leads x by 4 f on E.outSoft through arrive. Stagger 2 f in the reading order of the new layout. Travel at most 320 px. Starts 6 f after a causing insert. Settled drift 0.3 px/f.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
