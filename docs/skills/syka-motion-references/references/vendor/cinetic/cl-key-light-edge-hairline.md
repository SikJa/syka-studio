# Key-light edge hairline

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · cl-key-light-edge-hairline
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: color_and_light; energy: calm; role: workhorse; formats: launch, feature, walkthrough, sting

## Mechanism
Every card, device bezel and bevelled shape on a dark stage carries a hairline edge that is bright on the side facing one fixed key light and fades to nothing on the far side, so surfaces separate from black without shadows or halos.

## Use when
Dark UI films with flat cards, panels, device bezels or bevelled brand shapes on near-black, where a drop shadow disappears and a glow is off-limits.

## Avoid when
Light-mode shots, where a white hairline vanishes on paper. Also avoid it on cards that already carry cl-rim-light-sweep's travelling streak, and on layouts so dense that every lit edge turns the frame into wireframe noise.

## Original recipe (adapt to Syka native time and nodes)
Declare one light direction for the whole film in brand/tokens.ts (LIGHT = 135, meaning light from the top-left, the same key light cl-tilt-linked-sheen assumes). Give each surface an edge layer above its content: position absolute, inset 0, border-radius inherit, padding 1.5 px, background linear-gradient(calc(LIGHT - rotateZ) deg, rgba(255,255,255,0.40) 0%, rgba(255,255,255,0.10) 35%, transparent 65%), masked to a ring with mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0) and mask-composite: exclude (-webkit-mask-composite: xor). Recompute the angle every frame as LIGHT minus the object's own rotateZ, so the lit edge stays on the light's side while the object turns. Add box-shadow inset 0 1px 0 rgba(255,255,255,0.06) as a top inner highlight. In 3D, multiply the lit-edge alpha by clamp(1 + 0.04 x degrees tilted toward the light, 0.6, 1.4), so an edge brightens as it turns into the light. For bevelled decorative shapes drawn in SVG (stars, tiles, extruded marks), stroke each facet edge at 1 px with a linearGradient in gradientUnits='userSpaceOnUse' running along the light vector (white at 40% fading to 0), and keep facet fills within 2-4% luma of the stage. Use no blur and no outer halo. On light stages, replace the hairline with a 1.5 px C.white top edge and a C.line bottom edge.

## Original timing
Static styling with no clock of its own: it rides every entrance and move of its surface. Lit-edge alpha is 0.40 at the light corner, 0.10 at 35% of the gradient line and 0 by 65%. The inner top highlight is 0.06. The angle is recomputed every frame as LIGHT - rotateZ. Tilt gain is 0.04 per degree, clamped to 0.6-1.4x. On a tilt resolve (for example rotateX 25 deg to 0 over 68 f on E.out), the edge brightness settles on the same curve.

Upstream evidence count: 3; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
