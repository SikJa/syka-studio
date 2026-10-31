# Lens list scroll

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ui-lens-list-scroll
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: ui_choreography; energy: medium; role: workhorse; formats: launch, feature, loop, vertical

## Mechanism
A list scrolls with momentum past an invisible lens line, and each item's size, tint or tilt depends on its distance from that line, like a phone picker, a rolodex cylinder or a smile-shaped arc.

## Use when
Choosing among options, showing many screens as one continuous surface, or a playful list of choices that read one at a time.

## Avoid when
Items must be read while moving fast, or a plain scroll says it more simply.

## Original recipe (adapt to Syka native time and nodes)
Drive one offset s(f) for the whole list: a flicked picker uses s = D*(1 - (1 - p)^4) with p = prog(f, a, a + 120, E.linear) and D about 900 px (30 px/f at the start, under 20 px/f after 15 f, cut while it still drifts near 2 px/f, or land on an option with spr(f, a, SPR.detent)); a rolodex uses E.inOut over 90 f for about 480 px (peak about 41 px/f). Per item compute d, its distance from the lens line along the path, and map it: flat picker, scale = 1.2 - 0.35*min(|d|/375, 1) with text colour mixColor(C.ink, C.mute, min(|d|/375, 1)); cylinder, theta = d/R with R = 1.4*H, rotateX(theta) and translateZ(-(1 - cos theta)*R) under perspective 1600 px; smile arc, x = cx + R*sin(theta), y = cy + R*cos(theta) and rotate(-theta) with R = 1750 px and the centre about 790 px above the frame. Give each card a soft shadow; the depth comes from the geometry, never from translucent panels.

## Original timing
Picker: 120 f quartic momentum, D ~900 px, 30 px/f start, < 20 px/f from f15, ~2 px/f at the cut; focus scale 1.2 to 0.85 across 375 px; optional SPR.detent landing. Cylinder: 90 f (E.inOut), ~480 px, peak ~41 px/f, R = 1.4H, perspective 1600 px. Arc: R 1750 px.

Upstream evidence count: 3; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
