# Accent ground for claims only

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · cl-accent-claim-grounds
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: color_and_light; energy: medium; role: signature; formats: launch, feature, sting, vertical

## Mechanism
Narrative shots sit on the neutral stage, other claims flip to the opposite neutral, and the single full-bleed accent ground is saved for the hero claim or the closing card, so colour works as punctuation.

## Use when
Films with a few big statements that must feel louder than the walkthrough around them, and endings that need to feel conclusive.

## Avoid when
The accent fails contrast as a ground for display type, or the film has no distinct claims (a pure UI tour).

## Original recipe (adapt to Syka native time and nodes)
Use two ground tokens (C.paper or C.ink, and C.accent) and one ink. Tag each shot 'story' or 'claim' in timeline.ts. The accent floods the frame once per film: give the full-bleed accent ground to the one hero claim (about 72 f) or to the closing card, and set every other claim on the opposite neutral stage (C.ink after C.paper, or the reverse) with the accent only on its one key word, so accent pixels stay near 8% across the film. Switch grounds on hard cuts; elsewhere the accent appears only as a one-word highlight or a soft single-hue wash that previews the flood. Let the accent ground arrive as a radial flood. Layer order: the accent ground; a disc of radius 640 px whose fill steps mixColor(C.accent, C.paper, 0.75), then 0.4, then 0; a 60 px ring of mixColor(C.accent, C.ink, 0.1) at r 600 px, which appears with the last step and stays for the shot to frame the hero word; then the type.

## Original timing
Grounds swap on cut frames. The radial flood takes 6 f, with tint steps on f0, f2 and f4 decided with fd(). The ring stays from f4 to the end of the shot. Claim shots run 60-120 f each.

Upstream evidence count: 4; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
