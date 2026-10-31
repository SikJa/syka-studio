# Mark slides aside, name follows

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · le-mark-slide-name-follow
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: logo_and_end_card; energy: medium; role: workhorse; formats: launch, feature, sting, walkthrough, vertical

## Mechanism
The centred mark glides sideways, shrinking if it was hero-sized, to open its slot, and the name resolves beside it just before the mark stops, so the lockup forms in one gesture.

## Use when
Any end card whose mark is already on screen (it was the story device or the hero) and the name still has to arrive. The default lockup build.

## Avoid when
The mark has not been seen yet (give it its own beat first). The film already used a slide-to-make-room for the product. Long names that would push the slide past ~400 px (stack vertically instead).

## Original recipe (adapt to Syka native time and nodes)
Lay the finished lockup out first: LOCKUP token with mark height = the name's cap height, gap = 0.25-0.4x the mark height, and the name's width from measureTracked. Then slide the mark from frame centre to its lockup slot with x = tw(f, a, a+D, 0, -(nameW + gap)/2, E.smooth). If it was larger as a hero, scale it lmix(heroK, 1, same progress) with heroK about 1.6. Start the name when the slide passes 55-60% of its progress. As one block: opacity on E.smooth, blurIn(p, 10), translateX +30 -> 0 on E.out. Per letter: the same over 16 f at a 3 f stagger, with colour mixColor(C.mute, C.ink, p) so letters arrive grey and settle to ink. From the name's resolve, tighten its letter-spacing from +0.04 em to the TYPE.display track over 46 f on E.out; this hands into the hold's push. For a round mark, add roll: rotate = -(dx / r) * 180/pi degrees, so it rolls without slipping and stops exactly when x does. In 9:16, stack instead: the mark rises by (nameH + gap)/2 and the name rises in under it with MaskRise.

## Original timing
Slide: 36 f for up to ~250 px (E.smooth peaks ~20 px/f), 60 f for ~350 px (~17 px/f). Motion-blur pass on the mark whenever it moves faster than 12 px/f. Name starts at 0.55-0.6 x D: a block takes 14 f; letters take 16 f each at a 3 f stagger (10 letters inside ~43 f). Tracking: 46 f on E.out. Lockup resolved by about D + 20 f, then hold 90-120 f.

Upstream evidence count: 4; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
