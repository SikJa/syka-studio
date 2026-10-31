# Caption in the subject's negative space

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · lc-negative-space-caption
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: layout_and_composition; energy: calm; role: workhorse; formats: walkthrough, feature, launch

## Mechanism
Each camera move ends on a pose where the product covers about two-thirds of the frame and leaves a clean band of empty stage, and the caption builds inside that band.

## Use when
Single-take product walkthroughs and 3D UI slabs where each feature gets one pose and one caption; any shot where text laid over the UI would fight it.

## Avoid when
The subject must stay full-frame to be legible (caption above or below it instead), or a 9:16 frame, where the band should be top or bottom only.

## Original recipe (adapt to Syka native time and nodes)
Design each anchor-camera end Shot (src/lib/camera.ts) so the subject covers 65-75% of the frame and leaves a clear 25-30% band on the side it turns away from (a right band when yawed left, a top band when pitched down); check the subject's corners with toScreen. Set the caption in that band: at most 24% of the frame width, 2-3 words per line, left-aligned, inset 8-10% from the frame edge and inside SAFE. Start its Words reveal in the last 25% of the camera move, or within 6 f of landing, so type and camera settle as one gesture; fade it out as a block before the camera moves again.

## Original timing
Caption starts at 75% of the move, or within 6 f of landing; Words stagger 8 f, dur 26 f. Block exit 12-16 f on E.smooth, ending as the next move starts. Camera moves on E.cam.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
