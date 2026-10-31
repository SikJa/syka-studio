# Shape handoff: pill becomes the icon

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · mi-shape-handoff-morph
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: micro_interaction; energy: medium; role: signature; formats: launch, feature, walkthrough, sting

## Mechanism
A labelled capsule empties its text, then collapses at a fixed height into a square tile or circle that becomes the next thing (the app icon, a loader or a dock slot), so the object never disappears, it changes role.

## Use when
A thinking state, prompt or button should hand off to the product identity, or to its new place in the interface, in one continuous take.

## Avoid when
The target shape has nothing to do with the source (the continuity feels arbitrary), or the shot needs a hard cut for rhythm.

## Original recipe (adapt to Syka native time and nodes)
One div owns the shape and tweens width, height and borderRadius, with its content centred. Empty the label first. Either backspace from the end (one character every 1-2 f, with fd) or delete from both ends at once (text.slice(k, n - k), k + 1 every 5 f), with the pill width hugging the measured text plus padding over 8 f E.out per step. Then collapse the width down to the height about the centre over max(40, e/7) f on E.inOut, where e is each edge's travel in px (half the width lost), so each edge peaks under about 55 px/f (E.inOut peaks at 7.7x its mean speed). Take the radius from 999 to 22% of the side for a tile, or to 50% for a circle. Then do one of three things: loop a 3x3 pixel-dot loader inside it (one dot step every 6 f); raise an arrow glyph into the circle through overflow hidden (translateY 100% to 0 over 14 f E.out); or tween the tile to a dock-slot rect over 20 f E.out while the dock mounts behind it and sibling icons scale in on SPR.micro at a 6 f stagger. Close with a 1 + 0.05 * hitPulse(t, 3, 5) scale pulse just before the cut.

## Original timing
Backspace 1 character every 1-2 f (pairs every 5 f, width hug 8 f E.out). Collapse max(40, edge travel / 7) f on E.inOut at a fixed height (each edge under about 55 px/f). Dock variant 20 f E.out plus SPR.micro siblings at 6 f. The loader holds about 72 f.

Upstream evidence count: 3; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
