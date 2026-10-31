# Outline-led insert and spawn

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · ui-outline-led-reveal
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: ui_choreography; energy: medium; role: signature; formats: feature, walkthrough, launch

## Mechanism
A thin accent line or a heavy outline appears first and opens into a new row or a modal, then the stroke decays to a hairline so the content takes over.

## Use when
A click that creates something (a new account, row, record or dialog) that must read from a wide shot, or repeated creation shown as a rhythm.

## Avoid when
The accent already means something else in the film, or the shot is a calm monochrome close-up where a bright stroke would shout.

## Original recipe (adapt to Syka native time and nodes)
Row insert: a 2 px C.accent line appears across the list in one frame at the insert position, then the row opens from height 0 to row height over 10 f on E.ui, pushing the rows below through the computed list layout at 20 px/f or less; its 2 px border decays from the accent to 40% over 24 f on E.linear and then to nothing, and the row's content fades in over the last 4 f of the open. Repeat inserts every 41 f so three new rows read as a countable rhythm, each with a tick on its line frame. Modal spawn: the modal scales lmix(0.07, 1, prog(f, a, a + 26, E.out)) about the trigger point while an overlay stroke in the accent runs 6 to 10 to 1 px wide (interpolate(p, [0, 0.6, 1], [6, 10, 1]) on the same progress); after landing it thins to 1 px over 12 f and its opacity falls to 0.3, leaving a clean modal. At its peak the stroke can carry a faint outer glow, which the hard bans rule out; build it flat (see the variant).

## Original timing
Line 1 f; open 10 f (E.ui); border decay 24 f (E.linear); content in the last 4 f; inserts every 41 f. Modal 26 f (lmix on E.out) from scale 0.07, far edge ~52 px/f; stroke 6/10/1 px; thin 12 f; opacity to 0.3.

Upstream evidence count: 1; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
