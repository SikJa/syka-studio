# Opposite-corner caption relay

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · lc-opposite-corner-relay
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: layout_and_composition; energy: calm; role: accent; formats: walkthrough, feature

## Mechanism
One caption fades out of one upper corner while the next starts building in the mirrored corner, so the eye travels across a locked frame and that travel is the motion.

## Use when
Two consecutive beats over one held product shot with no camera move or cut; alternating claims about one screen.

## Avoid when
Captions longer than a short line (the eye cannot finish A while B starts), or as the default for every caption change; repeated more than twice it reads as a device.

## Original recipe (adapt to Syka native time and nodes)
Place caption A top-left and caption B in the mirrored position top-right, on the same baseline and at the same inset from the safe edge. A exits with a 28 f opacity fade on E.smooth and does not move. B's Words reveal starts 10 f after A's exit begins, so the two overlap for 18 f in different places. Keep the product shot on a slow breath(t, 0.02) or a 0.3 px/f drift rather than fully locked, since each caption holds 48-60 f; the relay is the event.

## Original timing
A fades over 28 f on E.smooth; B starts 10 f after A's exit begins; 18 f of overlap. Each caption stays readable for at least 48-60 f.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
