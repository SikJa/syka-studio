# Brushed micro-streaks

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · tx-brushed-micro-streaks
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: texture_and_finish; energy: calm; role: accent; formats: launch, feature, sting

## Mechanism
Fine directional streaks and a satin grain across a hero object's face make it read as machined material instead of flat vector.

## Use when
Hero objects shown big enough for micro detail (coins, cards, devices, extruded marks); hardware and finance brands with a physical metaphor.

## Avoid when
Small or minified objects, where 1 px streaks alias and crawl; soft, friendly brands; flat UI.

## Original recipe (adapt to Syka native time and nodes)
Bake a brushed texture PNG offline at 2x the hero's on-screen size: seeded noise stretched along one axis (numpy noise, then a 1-D box blur 60-200 px long, normalised to sigma about 6 levels around mid-grey) so streaks are 1-2 px wide. Apply it as a child of the object inside its transform, masked to the face (`maskImage` of the face shape), blend overlay at opacity 0.06-0.10; a CSS `repeating-linear-gradient(90deg, rgba(255,255,255,.04) 0 1px, transparent 1px 3px)` is the quick version for a face that never scales down. As the object turns, slide the texture's backgroundPosition along the streak axis in proportion to its rotation so the satin seems to catch the light.

## Original timing
Constant while the object is at hero scale (at least 30% of frame height); fade it out over 10-14 f on E.smooth before the object shrinks below that.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
