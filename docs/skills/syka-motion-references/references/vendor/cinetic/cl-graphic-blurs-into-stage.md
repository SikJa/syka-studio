# Graphic softens into the stage

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · cl-graphic-blurs-into-stage
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: color_and_light; energy: calm; role: accent; formats: launch, sting, loop

## Mechanism
A crisp graphic that has just finished its move, such as a wall of bars or a stripe field, loses its edges, widens and keeps drifting until it has become the soft backdrop for the next title, with no cut.

## Use when
After a graphic build (a bar wall, a stripe or tile field, a filled pattern), when the next beat is a title or the end-card mark and needs a backdrop born from what was just on screen.

## Avoid when
The graphic carries data the viewer still needs to read, or it is a UI act where the stage should stay flat. When no graphic build comes before the title, use cl-living-stage directly.

## Original recipe (adapt to Syka native time and nodes)
Keep the graphic's own elements mounted after their build and render them through src/fx/RackFocus (render = the bar group, blur 48, mid on). Drive t from 0 to 1 over 72 f on E.smooth. RackFocus crossfades a sharp copy and a copy at constant blur, so the softening does not step the way an animated filter: blur() does. On the same progress, widen each element (scaleX 1 to 1.5 about its centre) so the gaps close, and mix the whole field 25% toward the stage colour so its contrast drops under the type to come. Fill every element with a vertical gradient between two adjacent steps of the film's one-hue ramp (cl-one-hue-light-ramp). Slide each element's background-position-y at its own speed, 0.3 + 0.5 x rand(i) percent per frame, so the bands shift tone at different rates and the field never freezes once it is soft. Bring the next foreground in from frame 36 of the soften, when the stripes no longer read as objects. If banding shows, add 1-2% feTurbulence noise over the field, or bake a matching still with scripts/dither-gradient.py. In full colour, the field shifts through several hues as it softens.

## Original timing
The soften takes 72 f on E.smooth (RackFocus t from 0 to 1, blur 48 px at 1080p). The widen from 1 to 1.5 and the 25% contrast drop run on the same curve. Each element's gradient drifts at 0.3-0.8% per frame on E.linear and keeps drifting for 60-120 f under the next element. The next foreground enters from frame 36.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
