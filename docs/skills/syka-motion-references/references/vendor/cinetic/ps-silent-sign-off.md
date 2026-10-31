# Hard stop into a silent sign-off

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ps-silent-sign-off
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: pacing_structure; energy: high; role: workhorse; formats: launch, feature, sting

## Mechanism
Tension rises under the back half, the music stops dead on the cut to the last line or URL, the picture all but freezes, and the lockup arrives at full speed under a single low stinger.

## Use when
The last 4-6 s of launch films and feature reels for fast, confident brands.

## Avoid when
Calm brands, where a sub stinger reads as trailer noise (end on one soft chord instead), and loops with no ending.

## Original recipe (adapt to Syka native time and nodes)
About 180-300 f before the end card, add a riser event in src/sync.ts that ends on the first frame of the silence, and thin the score section (layers {drums: 0, arp: 0}). Skip the riser if a whoosh already leads into the same downbeat. On the cut to the URL or last line, stop the music with a score.json drops entry and hold the picture near-still (scale drift at most 0.03%/f). The final 12-15 f before the logo sit on a silences entry with zero transforms. The logo move starts at full speed (its E.out curve begins on frame 0 of the move, with no ease-in), and one drop or hit stinger lands on the frame the wordmark resolves; its 1.2-1.5 s tail covers a 90-120 f lockup hold that keeps building with a push of at least 10%.

## Original timing
Riser 180-300 f ending where the silence begins; music falls to silence within 2 f; URL readable for at least 102 f with drift of at most 0.03%/f; designed freeze 12-15 f on true silence; logo move 30-68 f E.out from full speed; stinger on the wordmark's resolve frame; lockup hold 90-120 f; tail of at least 60 f.

Upstream evidence count: 4; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
