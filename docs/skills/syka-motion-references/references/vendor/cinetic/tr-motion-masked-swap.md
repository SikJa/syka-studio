# Motion-masked swap

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · tr-motion-masked-swap
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: transition; energy: medium; role: workhorse; formats: feature, loop, launch

## Mechanism
Content changes on exactly the frame something else moves fastest (background rings whipping past, a card kicking into a tilt), so the change hides inside the motion and two states chain in one space with no visible cut.

## Use when
Changing copy inside a continuous environment; cycling examples (photos, prompts, results) in a loop.

## Avoid when
The masking motion is weak (under about 20 px/f at its peak), so the swap shows; or the content is a counter (roll the digits instead).

## Original recipe (adapt to Syka native time and nodes)
Drive a large secondary motion with a curve whose peak falls on the swap frame s. Either run a background sweep on E.smooth over 20-24 f, from s − 11 to s + 11, so its peak speed lands on s. Or kick a card with rotateY = 12 deg × hitPulse(f − s + 2, 2, 3) and skewY 2 deg on the same envelope, in a perspective(900px) container. Decide the content with fd(frame) >= s, so every motion-blur sub-sample agrees, and give the new content its own arrival (a slam or a word reveal) from s. Give kicked cards a soft shadow (0 18px 40px rgba(0,0,0,.18)) so the tilt reads.

## Original timing
Sweep: 20-24 f on E.smooth, centred on the swap. Kick: attack 2 f, decay tau 3 f, settled in about 8 f. Repeat no faster than every 48-54 f.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
