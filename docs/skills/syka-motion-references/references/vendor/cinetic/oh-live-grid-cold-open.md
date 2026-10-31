# Four live cells from frame 2

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · oh-live-grid-cold-open
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: opening_hook; energy: high; role: signature; formats: loop, launch, feature

## Mechanism
There is no title. The film opens on a flush 2x2 grid where every cell is already mid-action (a line assembling, a counter ticking, an object orbiting, a pin dropping), so from its first frames the frame reads as one living system.

## Use when
A hero or social loop that must show several features at once, or a launch whose first second has to prove breadth.

## Avoid when
The story needs one idea at a time, a single-message sting, or a 9:16 frame where the cells would shrink below about 540 px wide.

## Original recipe (adapt to Syka native time and nodes)
Root AbsoluteFill with a CSS grid (grid-template 1fr 1fr / 1fr 1fr, gap 0); every cell is overflow:hidden on the same stage colour (C.ink), so the seams disappear, with its content on the cell's own optical centre at 50-90% of the cell's width. Render each cell's scene at full 1920x1080 inside a wrapper with scale(0.5) and transformOrigin '0 0', so type keeps its native sizing and a cell can later go full-frame sharp. Wrap each cell's composition in Remotion <Loop durationInFrames={P}> with mutually awkward periods so the four never repeat in sync, and start each cell's first arrival by frame 2-6 on its own E.out curve with no shared global ease: for example a line converging with SPR.word, a Roll counter driven by countSteps(..., E.out), and an orbit whose angular speed decays as w = 11.25*e^(-t/10) + 2 deg/f, with satellites spawning on f10, f18 and f28. Only the one story element in each cell (pin, payoff word, button) gets C.accent; everything else stays greyscale. Merge every cell's cut frames into one list and nudge apart any two that fall within 6 f, and use no per-event SFX: one continuous groove carries the sound.

## Original timing
First arrivals on f2, f2, f2 and f6 (no cell later than f8). Typical entrances: a type lockup settles in 18 f on E.out, a counter finishes in 28 f. Loop periods 260 / 462 / 244 / 428 f. Something changes somewhere about every 20 f (longest gap about 62 f). Cells 960x540 at 1080p.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
