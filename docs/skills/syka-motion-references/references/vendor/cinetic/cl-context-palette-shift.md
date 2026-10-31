# Palette shift as context cue

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · cl-context-palette-shift
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: color_and_light; energy: medium; role: workhorse; formats: launch, feature, walkthrough

## Mechanism
The world's colour changes behind a steady foreground, for a whole act or for one beat, to say 'new context' or 'this is the moment' without words.

## Use when
Act changes without title cards, entering another app's world, or flagging the key moment (the user's prompt, the reveal).

## Avoid when
The foreground is moving at the same time (the cue gets lost), or the film is shorter than two acts.

## Original recipe (adapt to Syka native time and nodes)
Keep two or three token sets keyed by act in brand/tokens.ts: for example, a loud act on C.paper with C.ink and C.accent, a technical process act in pure neutral greys, and a calm product act in pale tints of one hue with the accent withdrawn. Read colours through a palette(act) helper so a whole act switches at once, on a hard cut or hidden inside a zoom-through. For a single beat, park the hero (card, composer, device) and shift only the backdrop. Drive one blurred backdrop layer's filter brightness() and saturate() so its luma rises about 100 levels over 42 f on E.smooth, or step it on the cut into the hero beat and step back on the next wide. The hero never moves during the shift, so the eye stays parked.

## Original timing
Act switches happen in 0 f on a cut. A neutral process act can be as short as 74 f. A backdrop shift takes 42 f on E.smooth. A hero-beat backdrop holds for up to about 300 f before stepping back.

Upstream evidence count: 4; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
