# Scale-through cut

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · tr-scale-through-cut
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: transition; energy: high; role: signature; formats: launch, sting, feature, loop

## Mechanism
An object shrinks faster and faster toward a fixed point, the film cuts, and a matching object appears much larger on the same point and keeps shrinking as it brakes, so one pull-back runs through two different worlds. The mirror version swells into the cut and opens on an undersized object that grows.

## Use when
Changing medium or world while keeping the subject: 3D to flat, device to UI, brand card to product, a mark coming back as a macro. Also hero pull-backs at act changes.

## Avoid when
The two objects cannot share a centre point, or both sides are calm; a scale jump without matched scale velocity reads as a jump cut. Use it at most twice per film.

## Original recipe (adapt to Syka native time and nodes)
Choose an anchor screen point and keep both objects centred on it within ±30 px (fixed sx, sy in an anchor-camera Shot, or transform-origin on the anchor). Outgoing: k = lmix(1, 0.75, prog(f, T − 20, T, E.in)), so the last frame shrinks about 7.8%; cut on an act boundary. Incoming: the same subject in a new medium (3D render to flat map, device to flat UI, brand card to product world) with k = lmix(1.8, 1, prog(f, 0, 40, E.out)). Its first frame shrinks about 8.4%, so scale velocity is continuous in log space. For a related mark shown as a frame-filling macro, use k = 1 + (S0 − 1)·0.84^f from S0 = 8-9 and snap to 1 once |1 − k| < 0.01. Push version: the hero swells 1 → 1.22 on E.in over the last 16-24 f while the rest of the frame dims (brightness 1 → 0.6 on a dark stage), and the next shot opens at 0.8 and grows to 1 over 30 f on E.out.

## Original timing
Exit: 16-24 f on E.in to 0.70-0.80 (last frame −7 to −9% per frame). Cut on a downbeat. Entry: 1.7-2.0x → 1 over 30-40 f on E.out (first frame −8 to −9%), or an 8-9x macro shrinking toward rest ×0.84 per frame and settled by about 30 f. Anchor drift ≤ 30 px. Push variant: +20-25% over 16-24 f, then 0.8 → 1 over 30 f.

Upstream evidence count: 6; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
