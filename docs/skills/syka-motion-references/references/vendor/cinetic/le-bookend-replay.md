# End card replays the opening

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · le-bookend-replay
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: logo_and_end_card; energy: any; role: workhorse; formats: any

## Mechanism
The ending reuses the opening's stage and its mechanic, now carrying the brand, so the film closes on a rhyme the viewer has already learned.

## Use when
Films with a distinctive opening mechanic or stage. The signature move's third use. Loops, where the end hands back to frame 0.

## Avoid when
The opening was generic (replaying it only repeats a template). The reprise would be a frame-for-frame replay that adds nothing. Films under 10 s, where the rhyme has no time to land.

## Original recipe (adapt to Syka native time and nodes)
Build the opening's stage (a Background component with an intensity prop) and its signature mechanic (a gap opening in a line, a word-roll, a mark slide, a window rise) as components with props, and call them again at the end with the same type size, position and curves. Run the mechanic mirrored, or with the brand as its payload. The window's exit is its entrance time-reversed: 1 - entrance(1 - t). The flanking words roll up and away (Words exit at half the stagger, E.in) and 'made with' plus the name roll in while the centre object holds. The opening's mark slide plays again, this time with the name. Bring the stage back only for brand beats: intensity 0 on product beats, then a 25 f rise from the bottom edge on E.out at the lockup. Never replay a reveal identically; the third use must add the name or the CTA.

## Original timing
Word-roll: 28 f with a 5 f stagger. Mirrored exits keep the entrance's distance and duration. Stage rise: 25 f on E.out. Final hold: 96-120 f under the push.

Upstream evidence count: 5; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
