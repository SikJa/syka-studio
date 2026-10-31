# Spectacle, diagram, walkthrough, sign-off

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ps-four-sequence-launch
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: pacing_structure; energy: medium; role: workhorse; formats: launch

## Mechanism
A launch film in four sequences: a short spectacle open, one concept diagram, a long real-product walkthrough and a brief brand close.

## Use when
30-60 s launch films that have to earn attention, explain an idea and then prove it in the product.

## Avoid when
Spots under 15 s (use the image-then-type plan instead) and products with nothing to diagram.

## Original recipe (adapt to Syka native time and nodes)
Split the runtime about 19/14/58/9%, each part a contiguous bar-aligned ACT in src/timeline.ts. The open (surge) gets the biggest moves and the strongest use of the accent colour. The diagram (dip) is one centred concept figure that names the idea, paced slower. The walkthrough (plateau) is 10-14 shots built from wide/close pairs: render the UI once and frame each close-up as the same composition at 4-4.5x scale on the control, with the cuts velocity-matched. The close (a small peak, then calm) replays the open's mechanic and lands the lockup. Map score.json sections onto the same contour: intro/build, breakdown, groove, resolve, hold.

## Original timing
Shares 19/14/58/9% (at 30 s: about 342/252/1044/162 f). Walkthrough shot median 75-100 f; wides 90-180 f, close-ups 76-154 f at 4-4.5x. Lockup hold 90-120 f inside the close.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
