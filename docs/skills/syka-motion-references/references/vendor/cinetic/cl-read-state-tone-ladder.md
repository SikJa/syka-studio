# Now, was, next tone ladder

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · cl-read-state-tone-ladder
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: color_and_light; energy: any; role: workhorse; formats: any

## Mechanism
Items in a sequence sit on three neutral tones: the one being read is at full ink, the ones already read step down to a mid grey and stay as context, and the ones still to come wait in a dim grey.

## Use when
Captions that build in steps, lists and checklists that grow, slot rollers, status sequences, and flanking words that make way for a new focal word.

## Avoid when
A single statement that lands all at once, or real product UI whose own text colours must stay true. In lens lists, tone should follow distance from the focus line, not reading order.

## Original recipe (adapt to Syka native time and nodes)
Declare three tones in brand/tokens.ts. NOW is C.white on an ink stage (C.ink on paper). WAS is C.mute. NEXT is mixColor(C.ink, C.white, 0.24) on ink (mixColor(C.paper, C.ink, 0.2) on paper). Give every item in the sequence (caption words, list rows, step labels, roller slots, status words) a cue frame, and compute its state with fd(): NEXT before its cue, NOW from its cue, and WAS from the next item's cue. Promote NEXT to NOW over 6 f on E.ui. Start the previous item's NOW-to-WAS demotion on the same frame, over 10 f on E.smooth, so the eye is handed over and only one item is at full ink after each handoff. Rollers and ratchets step their tones on the slot frame with no tween. Show pending items at NEXT only when 'there is more' is the message (lists, slot ratchets, step lists, with at most three visible); otherwise they do not exist yet. Exits go through WAS: an item drops to WAS before it leaves, never straight from NOW. Keep weight and size the same so tone alone carries the order. The accent stays out of the ladder because it marks meaning (cl-mono-one-accent).

## Original timing
Promotion takes 6 f on E.ui. Demotion takes 10 f on E.smooth, starting with the next item's arrival. Each item holds NOW for at least 24 f. Rollers and ratchets step on the slot frame (0 f). An exit starts at least 8 f after the item reaches WAS. On ink, the tones sit at about 100% (NOW), 40% (WAS) and 24% (NEXT) of the way from the stage to white.

Upstream evidence count: 3; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
