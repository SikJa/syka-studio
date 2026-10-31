# In-place character rewrite

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · mi-in-place-char-rewrite
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: micro_interaction; energy: medium; role: accent; formats: feature, walkthrough, launch

## Mechanism
A small monospace status field is overwritten left to right by its new state, or a sensitive value turns to dots and deletes from the right, all inside the same fixed slot with no layout change.

## Use when
The product's own status (sending, receiving, connected) or a privacy claim should change in place and read as the machine's voice.

## Avoid when
The text is decorative rather than real UI status (it becomes filler text), or the field uses a proportional face, so the columns jump.

## Original recipe (adapt to Syka native time and nodes)
Set the field in FONT.mono with whiteSpace pre so every character keeps its column. Overwrite: k = fd(prog(f, s, s + 12, E.linear) * max(oldLen, newLen)) and text = next.slice(0, k) + prev.slice(k). Start it 8 f into the press release, so the status changes as the button's light fades. Optionally lift a companion icon 10 px over 4 f E.out and bring it back over 8 f. Redact: on the click frame, swap the value to '•'.repeat(n) in one frame, then set n = len - fd((f - s) / 2) so one dot deletes every 2 f. Meanwhile, an anchor-camera pan over 40 f E.inOut keeps the toggle icon centred; put the click on a downbeat.

## Original timing
Overwrite at about 1 character per frame (13 characters in 12 f), linear, starting 8 f after the press peak. Redact: 1 f swap, then 1 dot deleted every 2 f; camera pan 40 f E.inOut.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
