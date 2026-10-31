# Hero icon becomes the inline glyph

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · lc-hero-flips-to-inline-glyph
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: layout_and_composition; energy: medium; role: accent; formats: launch, feature, sting

## Mechanism
The centred hero icon shrinks and travels into a slot at the start of, or inside, a sentence, and the words of the claim spill out of it, so the icon becomes a word.

## Use when
Bridging from a hero object to a claim about it: an icon becoming the bullet of its benefit, a mark becoming the subject of a sentence, a feature glyph leading a metric line.

## Avoid when
Detailed icons that will not read at cap height (50-90 px), or sentences long enough to wrap.

## Original recipe (adapt to Syka native time and nodes)
Lay out the final line first with an empty inline slot one cap height square (inkBox gives the cap height, measureTracked the widths), and read the slot's rect. FLIP the hero from its centred rect to that rect with translate and scale on prog(f, a, a + 26, E.smooth), with motion blur while it exceeds 12 px/f; for extra life add a wobble of rotateY = sin(pi p) * 25 deg and rotateX = -sin(pi p) * 15 deg under perspective(800px). The words start behind the icon in z and spill outward: each word's translateX runs from -24 px to 0 over 14 f on E.out while its opacity rises and its colour moves from C.mute to C.ink through mixColor over 12 f. The first word starts 2 f after the icon lands and the rest follow 4 f apart; then the line drifts at 0.5 px/f.

## Original timing
Icon travel 22-30 f on E.smooth, scaling to about 0.42 (cap height). Words at icon landing + 2, + 6 and + 10 f, each a 14 f slide of 24 px with a 12 f colour resolve. Residual drift 0.5-1 px/f.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
