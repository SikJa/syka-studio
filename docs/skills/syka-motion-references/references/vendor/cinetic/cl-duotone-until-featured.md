# Duotone until featured

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · cl-duotone-until-featured
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: color_and_light; energy: medium; role: accent; formats: launch, feature, walkthrough

## Mechanism
Screenshots and photos sit in a two-tone grade until their beat. Then full colour opens out from the point of interaction, and the previous item returns to duotone.

## Use when
Grids of integrations, galleries, template pickers, and multi-cell layouts where one item at a time is the subject.

## Avoid when
Only one hero screenshot is on screen (nothing to contrast with), or the UI's colours are its selling point in every frame.

## Original recipe (adapt to Syka native time and nodes)
Give every non-featured media layer an SVG filter: feColorMatrix type saturate 0, then feComponentTransfer tables mapping shadows to C.ink and highlights to C.mist (or to a pale accent tint, mixColor(C.accent, C.paper, 0.85), for a branded duotone). On the featured item's beat, place the full-colour copy of the same image above it and reveal it through clip-path circle(r at x y), growing from the click or impact point to 150% on E.out, or swap it on the cut frame. When focus moves on, return the previous item to duotone by animating the matrix's saturate value from 1 to 0. Only one item is ever in full colour.

## Original timing
The colour iris takes 18 f on E.out from the interaction point. The return to duotone takes 20 f on E.smooth. A swap on a cut takes 0 f.

Upstream evidence count: 0; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
