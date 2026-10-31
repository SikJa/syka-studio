# Headline over a ghost of the UI

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · lc-headline-over-ghost-ui
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: layout_and_composition; energy: calm; role: accent; formats: launch, feature, walkthrough

## Mechanism
A headline inks in from light grey to near-black while a faint copy of the product interface sits behind it, then the UI resolves to full strength as the headline leaves.

## Use when
Setting up a demo during a statement, so the move into the product needs no transition; a claim that names the product area about to be shown.

## Avoid when
High-contrast UIs whose ghost would muddy the type, or UI text at the same scale as the headline sitting directly behind it.

## Original recipe (adapt to Syka native time and nodes)
Use two layers: the product UI (a full-frame capture or live component) at opacity 0.15, and the headline centred on top of it. Ink the headline from C.mute to C.ink through mixColor on prog(f, a, a + 40, E.outSoft) (on a dark stage, C.mute to C.white). As the headline exits (Words with out, or a 16 f fade on E.smooth), raise the UI's opacity from 0.15 to 1 over 60 f on E.smooth with a slow scale from 1.03 to 1.0 on the same curve, so the next shot is already composed. If the UI is busy, defocus the ghost with RackFocus (t = 1, blur 10) and rack it sharp as it resolves.

## Original timing
Ink resolve 40 f. Ghost UI at 10-20% opacity under the headline; it resolves to 100% over 60 f, starting when the headline's exit begins.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
