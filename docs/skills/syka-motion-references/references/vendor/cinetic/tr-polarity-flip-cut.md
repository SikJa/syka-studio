# Polarity flip cut

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · tr-polarity-flip-cut
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: transition; energy: high; role: accent; formats: launch, sting, feature

## Mechanism
A hard cut flips the stage between near-black and near-white on a downbeat, often with the same icon or pill held on the same spot in inverted colours, so the luminance jump itself is the accent.

## Use when
Act breaks: problem to answer, public to private, demo to claim. The strongest punctuation on a drop.

## Avoid when
A third time in one film; a flip from a static frame with nothing carried; or when the accent field would be the film's second full-frame accent flood.

## Original recipe (adapt to Syka native time and nodes)
Plan adjacent acts with opposite stage luminance (mean luma differing by at least 150 of 255) and cut on their act boundary on a downbeat, after a dropout or silence, with one impact in the sound. Carry the flip; never cut from a static frame. Either cut on the outgoing motion peak (a zoom-through or an accelerating exit), or end on a shape centred at P and open on the same shape at P ±20 px, at 1-2.5x the size, with fill and ground swapped. An ink icon on paper becomes a paper icon on ink; an accent pill on paper becomes a paper pill on an accent field. The incoming shape is already drifting, translateY −36 px over 30 f on E.out. For a softer edge, draw two ghost frames with the incoming shot at 0.12 and then 0.94 opacity over the fully opaque outgoing frame. Declare the cut for scripts/forensics.py, and use no flash frame and no dip through black.

## Original timing
Cut in 0 f, or 2 ghost frames at 0.12 and 0.94. Anchor scale jump 1.0-2.5x. Post-cut drift 30 f on E.out. After a flip to dark, wait 12-20 f before any small type. At most one flip per bar and two flip cuts per film.

Upstream evidence count: 6; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
