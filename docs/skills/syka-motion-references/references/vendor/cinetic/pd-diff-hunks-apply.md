# Change applied as a visible diff

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · pd-diff-hunks-apply
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: product_demo; energy: calm; role: workhorse; formats: feature, walkthrough

## Mechanism
A proposed edit lands in a code or document view as a diff: outgoing lines strike through and fold away, incoming lines open in place with a marker in the gutter, and the view steps hunk by hunk before the change is accepted.

## Use when
AI coding or writing assistants and review, versioning or migration tools, when the claim is 'it changes exactly the right lines and shows you which'.

## Avoid when
The code is unreadable at frame size (macro in first), or the change needs more than three hunks (show a summary instead); never give removals a second colour.

## Original recipe (adapt to Syka native time and nodes)
Render the file as live lines from data (FONT.mono for code, the text face for prose) beside a gutter of line numbers, and drive each hunk from its own start frame. An outgoing line first gets a 1.5 px C.mute strike that draws left to right over 8 f on E.ui (scaleX 0 → 1 from the left) while its text dims to C.mute; 6 f later it folds from line height to 0 over 12 f on E.ui, its opacity gone in the first 8 f. On that same frame an incoming slot opens from 0 to line height over 12 f on E.ui (the lines below are pushed through the computed layout), a 3 px C.accent bar appears in the gutter on its first frame, the new text appears whole once the slot is 70% open, and a C.accent 10% row tint relaxes to clear over 36 f while the bar stays; line numbers below recompute on fd(f) and are never tweened. Step to the next hunk 60-90 f later with the anchor camera (lc to a Shot centred on it) over 48 f on E.glide, keeping each hop under about 300 px (peak ≈ 19 px/f) and hard-cutting on the same axis to anything farther; on Accept (a Cursor press with pressAt on the button) every gutter bar fades over 12 f on E.smooth and the clean file holds under breath(t, 0.02).

## Original timing
Strike 8 f on E.ui; fold 12 f on E.ui starting 6 f later; slot open 12 f on E.ui with the text in at 70%; tint relax 36 f; hunks 60-90 f apart, camera hop 48 f on E.glide (≤ 300 px); accept fade 12 f; final hold 36-48 f under a 2% breath; at most three hunks.

Upstream evidence count: 0; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
