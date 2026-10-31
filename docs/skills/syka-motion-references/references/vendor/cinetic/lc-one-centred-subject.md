# One huge centred subject

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · lc-one-centred-subject
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: layout_and_composition; energy: any; role: workhorse; formats: any

## Mechanism
Every frame has exactly one subject, centred and large: a single line of type, or one UI card scaled to most of the frame width and often bleeding past the edges, with everything else dimmed.

## Use when
Fast, phone-first films; walkthroughs where the viewer must never search for the subject; the default framing between more designed compositions.

## Avoid when
Comparison or cause-and-effect beats that need two things on screen at once (use a split), or bento-style loops.

## Original recipe (adapt to Syka native time and nodes)
Compose every shot on the frame centre (on safeBox cy in a tall frame) with exactly one subject: a single line of type sized with fitSize to at most 80% of the frame width, or one UI card scaled through the anchor camera to at least 0.85 of the frame width and bleeding past the edges wherever its content allows, so it reads as the product filling the frame rather than a centred floating card. Show captured UI at about 2x native, so body text is at least 27 px at 1080p. Dim anything that is not the hero to brightness 0.6-0.7, or defocus it with RackFocus (blur 8-40); never leave it at full strength. Keep each hold alive with breath(t, 0.025) on the camera.

## Original timing
Holds of 30-72 f per hero. Cards at 85-100% of frame width or bleeding past it, header bars up to full width, tables at least 80%; type 5-8% of frame height per line. Dims and rack focus 12-20 f on E.smooth.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
