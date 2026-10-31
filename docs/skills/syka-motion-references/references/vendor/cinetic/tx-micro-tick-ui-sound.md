# Micro-tick UI sound

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · tx-micro-tick-ui-sound
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: texture_and_finish; energy: any; role: workhorse; formats: any

## Mechanism
(Sound) Typing and UI changes get tiny, dry ticks at or under the music, and once the drums run the UI goes silent, so the picture feels tactile without a loud keyboard sample.

## Use when
Typed prompts, word-by-word builds, cold opens before the beat drops, any UI moment that wants touch without an effect announcing itself.

## Avoid when
Under voiceover syllables; inside a dense drum section; loud keyboard samples; a film whose idea is silent UI over a beat bed throughout.

## Original recipe (adapt to Syka native time and nodes)
In src/sync.ts emit `key` events from the same CHAR_AT array the picture types with (variant 'word' on word starts) and `tick` or `click` events on UI appearances, at weight 0.2-0.35 (12-18 dB under the landing hit), and set "typing": "soft" in score.json ("muted" over a denser section). Emit none of them in sections whose drums are "groove" or "drive": there the hats carry the typing. When typing is fast, place one tick per word as it becomes legible rather than one per letter, and let a run of UI ticks climb about 1 dB per event into a payoff. Read score.py's typing block: 15-20 dB A under a full bed and never brighter than the music above 2 kHz.

## Original timing
Ticks 2-6 ms long, at least 60 ms (3.6 f) apart, sigma 3.5 ms timing jitter and +-1 dB gain jitter; peaks -23 to -36 dBFS, at or under the bed's RMS; zero UI sounds once the drums enter.

Upstream evidence count: 5; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
