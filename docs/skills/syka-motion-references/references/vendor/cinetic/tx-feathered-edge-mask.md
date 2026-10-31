# Feathered edge mask

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · tx-feathered-edge-mask
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: texture_and_finish; energy: any; role: workhorse; formats: walkthrough, feature, loop, vertical

## Mechanism
Lists, reels and overflowing lines dissolve into the stage at a soft edge instead of being cut by a hard crop, so content feels endless and the eye stays in the clear middle.

## Use when
Endless-feeling lists, proof reels, logs, chats, card stacks, and type that overflows its line as it is typed.

## Avoid when
Content that must be read right at the container edge; a hard-cropped bento look; as a full-frame vignette (that is lighting, not a mask).

## Original recipe (adapt to Syka native time and nodes)
Put the moving content inside a fixed container with `maskImage` (and `WebkitMaskImage`) set to `linear-gradient(to bottom, transparent 0%, #000 14%, #000 86%, transparent 100%)`, so rows enter and leave by fading into the stage; move the content inside by transform only, with inertia() for a flicked reel or E.glide for single steps. For a typed line that must follow its caret, use a left feather `linear-gradient(to right, transparent 0, #000 140px)` on the line's box and slide the text left by exactly its overflow each frame. Size the feather at 10-15% of the container (120-160 px at 1080p): shorter reads as a crop, longer greys out readable rows.

## Original timing
Feather 10-15% of the container; list steps 26-40 f on E.glide, or inertia(f, s, 30-60, 0.89) for a proof reel; text under the mask at most 20 px/f while it must read; the mask itself never moves.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
