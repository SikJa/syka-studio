# Headline becomes the product input

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · pd-headline-becomes-input
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: product_demo; energy: medium; role: signature; formats: launch, feature, vertical

## Mechanism
Without a cut the headline turns into the product: a caret appears in the gap between two words, swells into a capsule and widens into the input bar that shoves the words aside, or the sentence inside a card dissolves while the card reshapes into the input.

## Use when
Bridging from message to demo in a type-led film; the product's core surface is an input, search or command bar.

## Avoid when
The product is not input-led; the headline has no natural gap; the bar would have to stay translucent over a busy backdrop (go straight to opaque).

## Original recipe (adapt to Syka native time and nodes)
Lay out [wordL][slot][wordR] from data, centred, and bind each word's x to the slot's edges (wordL's right edge = cx − slotW/2 − gap) so the line reflows with no separate tween. Grow the slot as a 3 px C.accent caret (height 0 → line height over 6 f on E.out), hold 8 f, thicken to a 36 px capsule over 14 f, then widen to ≈ 92% of frame on E.rest over 60 f (edge peak ≈ 50 px/f, motion blur on) while its fill goes straight to the opaque input colour; the flanking words ride the edges and, once they pass 20 px/f, fade on E.smooth with blurOut as they leave frame. Populate container-first: icons, a C.mute placeholder and the send button fade in left to right 4 f apart over 12 f each with a 6 px arrive() rise, and the primary button fills last on a 16 f linear ramp. If the sentence already sits in a card, exit its words 6 f apart (the out props of src/fx/Words.tsx), tween the card's height to the input's over 30 f on E.out and fade the placeholder in over 16 f.

## Original timing
Caret 6 f, hold 8 f, capsule 14 f, widen 60 f on E.rest (a short bar: 23 f in all on E.out); contents 12 f each at a 4 f stagger, button fill 16 f linear. Card variant: word exits 6 f apart, resize 30 f on E.out, placeholder 16 f.

Upstream evidence count: 3; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
