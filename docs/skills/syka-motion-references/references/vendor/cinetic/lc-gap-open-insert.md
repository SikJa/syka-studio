# Words part for an inserted object

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · lc-gap-open-insert
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: layout_and_composition; energy: medium; role: workhorse; formats: launch, feature, sting

## Mechanism
Inside a finished line, the words slide apart to open a gap and an object pops into it (an icon, a photo, a token, or a caret that grows into a container), so the sentence becomes a frame for the object.

## Use when
Making a sentence about the object literally contain it (a product photo in a claim, a lock icon beside 'private', a prompt box between two words); morphing a headline into the first UI element of the next scene.

## Avoid when
Long lines whose parted words would leave the frame unintentionally, or an object that needs more room than a word gap can give (use a push-aside or a cut).

## Original recipe (adapt to Syka native time and nodes)
Split the line into a left group, a slot and a right group. Animate the slot width w(f) from 0 to the object's width on prog(f, a, a + 16, E.glide), and move the groups with transforms (left translateX -w/2, right +w/2 for a centred line) rather than by reflowing flex widths. Pop the object into the slot once the gap is 70% open: scale 0 to 1 on spr(f, b, SPR.micro), with no overshoot. Container variant: a hairline caret grows to cap height, thickens into a capsule, then widens into the next UI element, pushing the words aside. Hold at least 14 f; to make the object the next scene, accelerate the groups apart on E.in over 16 f (faded, with blurOut) while the object scales up into the next shot's rect.

## Original timing
Gap opens over 16 f on E.glide, which keeps a 200 px gap under 20 px/f per side. Object pop 6 f on SPR.micro. Hold 14-60 f. Exit: words 16 f on E.in, object scale-up 8-20 f into the cut. Caret variant: grow 6 f, hold 8 f, thicken 14 f, widen 24-62 f.

Upstream evidence count: 5; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
