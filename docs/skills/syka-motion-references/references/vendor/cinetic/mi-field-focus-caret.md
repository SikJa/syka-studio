# Click to focus: I-beam, ring, caret

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · mi-field-focus-caret
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: micro_interaction; energy: calm; role: workhorse; formats: walkthrough, feature, launch, vertical

## Mechanism
An arrow cursor turns into an I-beam as it enters an empty field and clicks. The field's border sharpens, a caret appears and blinks twice at an uneven, human pace, and on the first key the placeholder vanishes and the pointer fades away.

## Use when
A shot opens on an empty prompt, search or chat field and the first action is typing into it, so the click into the field becomes the cause of everything after.

## Avoid when
The field is already focused or pre-filled, the product acts on its own with no cursor, or the film has already played the full two-blink wait once (later prompts start at the first key).

## Original recipe (adapt to Syka native time and nodes)
Draw the I-beam as a variant of src/fx/Cursor.tsx: a 2.5 px C.ink stem 28 px tall with 9 px crossbars over a 2 px C.white outline, using the arrow's drop shadow. Its stem centre, not a tip, sits on the hotspot, and it scales about that point. The arrow travels on cursorArc and swaps to the I-beam in one frame, on the fd(f) where its tip enters the field's rect, arriving 8-12 f before CLICK. On CLICK (pressAt) the field takes focus: its border goes from 1.5 px C.line to 2 px C.ink through mixColor on prog(f, CLICK - 1, CLICK + 4, E.ui), so the change shows on the press frame, with no halo. On the same frame a 0.08 em x 1 em caret appears at the start of the text, while the C.mute placeholder stays where it is. Blink the caret on a hard, uneven table decided with fd: on 18, off 16, on 24, off 12 f, then the first key at CLICK + 70 (or just on 18, off 16 when the beat is tight). The pause should read as a person gathering a thought, never as a metronome. On the first key the placeholder vanishes in one frame, TypeOn takes over with a solid caret, and the I-beam fades out over 8 f on E.smooth, because a system pointer hides while typing. Run one log-space push toward the field under the arrival and the blinks (lc between two shots in src/lib/camera.ts, up to about 1.8x over 40-44 f on E.cam), so the wait is never a still frame. Put one 'click' at weight 0.3 on CLICK and no sound on the blinks.

## Original timing
Arrive in 24-36 f on E.smooth, 8-12 f before the click; glyph swap 1 f; press 4 f down, 8 f recoil; focus border 5 f E.ui from CLICK - 1; caret blink in hard steps of 18/16/24/12 f (70 f) or 18/16 f (34 f); placeholder gone in 1 f on the first key; I-beam fade 8 f E.smooth; push up to 1.8x over 40-44 f E.cam.

Upstream evidence count: 2; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
