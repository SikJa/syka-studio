# Slice glitch into a speed streak

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ty-slice-glitch-streak
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: typography_motion; energy: high; role: accent; formats: launch, sting, feature

## Mechanism
A word jolts into sideways-displaced horizontal slices for two frames, then stretches into a solid capsule that races off as a streak, and the next word lands in its wake.

## Use when
A speed or performance claim, where the word itself turns into motion. Handing a name off to a thread, packet or line that carries into the next scene. The 2 f slice alone on 'private', 'encrypted' or 'blocked'.

## Avoid when
Calm films. More than once per film. Words wider than about 450 px at the smear, where the edge would pass 80 px/f. Long lines. Coloured fringes or a tint shift along the trail.

## Original recipe (adapt to Syka native time and nodes)
Slice: for 2 f decided with fd, render the word as 6-8 stacked copies, each clipped to one horizontal band with clip-path: inset(), and offset each band by sign x 0.08-0.25 em, both drawn from rand(`${b}:${fd(f)}`). Under 30% of the bands, lay a C.mute copy offset 0.03 em (one hue, no RGB fringes), and raise the variable 'wght' by 100 for those two frames; frame 3 renders clean. Smear: from s, scaleX = mix(1, 1.8, prog(f, s, s + 18, E.contact)) about the word's left edge, so the right edge accelerates to about 70 px/f on the last frame (render the blurred master). Over those last 10 f, fade the text out while a capsule (C.ink on paper or C.white on ink, radius 50%) fades in over the same box and its height shrinks from the cap height to 0.35 of it. Streak: the capsule keeps its handoff speed, with head x = x_e + v_e x (f - e) and a trailing tail of length clamp(v x 1.5, 0, 240) px, until it clears the frame edge. Next word: it enters in the wake, layered under the streak, with translateX -320 -> 0 on p = prog(f, e + 4, e + 28, E.outSoft), opacity 0 -> 1 over 8 f and blurIn(p, 16), so it is faint while fast and readable once it drops under 20 px/f. The 2 f slice alone, with no smear, works as a hit on privacy or obfuscation copy.

## Original timing
Slice: 2 f via fd, clean on frame 3. Smear: 18 f on E.contact, scaleX 1 -> 1.8; for a word up to 450 px wide the right edge ends near 70 px/f. Text-to-capsule crossfade over the last 10 f. The streak cruises at that speed and clears a 1920 frame in about 15 f, with a tail of at most 240 px. Next word: 320 px over 24 f on E.outSoft from e + 4 (58 px/f on frame 1, under 20 px/f from frame 7), opacity over 8 f. Hold it at least 54 f.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
