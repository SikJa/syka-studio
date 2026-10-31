# Oner through a morph chain

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ps-oner-morph-chain
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: pacing_structure; energy: medium; role: signature; formats: launch, feature, walkthrough

## Mechanism
The whole film plays as one continuous shot, every new scene growing out of an object already on screen, with no hard cuts at all.

## Use when
Multi-step workflows and multi-app stories, or any film where the viewer should never have to re-orient.

## Avoid when
Films that use polarity cuts as punctuation, or footage-based shots that cannot share elements.

## Original recipe (adapt to Syka native time and nodes)
List one handoff object per beat boundary: a word gap, a box, a dot, a button, an icon, a card or a pill. At each boundary, duplicate the handoff element onto a top layer and swap the world beneath it: blur it 0 to 12 px while fading it to 40% opacity over the next scene's stage colour, swap, then clear the blur, so the luminance never dips toward black. Then interpolate the element's box (x, y, width, height, radius) from its old slot to the next scene's anchor: 5 f on E.in to break it loose, then 10-16 f of E.out geometry, all inside one global camera group (src/lib/camera.ts). Allow at most one masked cut, hidden behind a 3-6 f blur dip at a motion peak.

## Original timing
About 3.6 morphs per 10 s; beats median 72-144 f, minimum 23-34 f, maximum 194-410 f; each morph 5 f E.in plus 10-16 f E.out; world swap 10-14 f under the held element.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
