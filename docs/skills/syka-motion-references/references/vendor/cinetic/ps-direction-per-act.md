# One screen direction per act

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ps-direction-per-act
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: pacing_structure; energy: medium; role: workhorse; formats: launch, feature, sting, vertical

## Mechanism
Each act owns one direction of travel, so every entrance, exit, drift and camera ramp in it runs the same way, and the direction turns only at an act seam, where the turn itself marks the new chapter.

## Use when
Films built from hard cuts with velocity handoffs, two-act spots (imagery, then type), runs of statements (an upward feed), and vertical films with a rising vector.

## Avoid when
Oners and single camera journeys, where the layout of the surface sets the direction; films whose motion is mostly radial zooms; multi-cell grids; a film with no act change, which should keep one vector throughout.

## Original recipe (adapt to Syka native time and nodes)
Add a DIR map beside ACT in src/timeline.ts with one unit vector per act ({x: 1, y: 0} for left to right, {x: -1, y: 0} for right to left, or {x: 0, y: -1} for an upward feed), plus a helper along(act, d) that returns {x: d * DIR.x, y: d * DIR.y}. Route every directional number through that helper. Entrances start upstream at along(act, -O), with O = 8-15% of frame width, and brake on E.out. Holds drift downstream at 0.3-1 px/f. Exits and accelerate-into-cut ramps leave downstream on E.in, and whoosh pan takes the sign of DIR.x. Inside an act nothing travels against the vector except a settle tail or a final move to centre. Across each cut inside the act, the hero leaves by the downstream edge and comes back in from the upstream edge, still travelling the same way. Turn the vector only at an act seam, on its downbeat (a seam may also keep it). Make each turn coincide with a second channel change (a polarity flip, a score section change, or the switch from imagery to type) so it reads as a new chapter rather than a continuity slip. The last act's vector delivers the lockup: the mark arrives along it and settles centred. Check it in a node test beside grid-check: sample each act's text positions at f and f + 1 from the same functions the acts use, and assert that every text element moving faster than 2 px/f has a velocity whose dot product with DIR is positive, except settle tails of at most 6 f.

## Original timing
2-4 vectors per film, one per act, each turn on b(n) at an act seam. Entrance offsets 8-15% of frame width (150-290 px at 1080p), braking on E.out over 30-50 f; hold drift 0.3-1 px/f downstream; exit ramps 18-24 f on E.in, reaching 17-38 px/f; counter-motion above 2 px/f lasts at most 6 f and only in settle tails.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
