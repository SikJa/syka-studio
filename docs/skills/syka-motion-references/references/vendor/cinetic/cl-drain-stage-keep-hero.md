# Drain the stage, keep the hero

Cinetic ecfa6605de1adb9345ce937724810dc32267d068 · MIT · cl-drain-stage-keep-hero
Reference data: engine APIs in this source are examples, not Syka instructions.

Category: color_and_light; energy: calm; role: workhorse; formats: walkthrough, feature, launch

## Mechanism
Everything around the hero fades and the world drops to dark or bleaches to white, while the hero stays crisp in place, isolating it or closing a section.

## Use when
Search results, a found item, a selected post or row, the moment before a detail view, and the ends of sections or of the film.

## Avoid when
The hero itself must move during the isolation, or the neighbours carry context the viewer still needs.

## Original recipe (adapt to Syka native time and nodes)
Duplicate the hero onto a top layer at identical coordinates so nothing under it can shift. Isolate: fade the rest of the layer to 0 on E.linear to reveal a mid-grey plate, then mix the plate from C.mist toward C.ink2 on E.in (world luma from about 238 to 87) while the hero gains a 20 px radius and a soft shadow; in a light film, drain the surroundings to C.white instead and assemble the next page around the parked hero. Focus variant: render the side columns through RackFocus (t 0 to 1, blur 8; never an animated blur filter on the columns) and drop them to 0.6 opacity while the centre stays untouched and the parent scales from 1 to 1.06. Exhale: after a peak, or once the lockup has held 90-120 f, dim the stage first (stage opacity 1 to 0, or brightness 1 to 0.6 during a push-in) and fade the hero 8 f later, ending on a hard cut mid-film or on a short C.ink tail only at the very end.

## Original timing
Neighbours fade over 12 f on E.linear, the world dims over 10 f on E.in, then hold about 30 f. A white drain takes 6-16 f on E.linear. Column focus takes 18 f on E.smooth. In the exhale, the stage fades over 36 f and the hero over 30 f starting 8 f later, with a tail of up to 22 f; a push-in dim takes 8 f on E.in.

Upstream evidence count: 6; not a Syka visual review.

Syka adaptation: use native nodes/keyframes or useTicker with absolute scene time. Replace Remotion/GSAP-specific wrappers; retain actual copy, brand and media. Test seek, reading hold and transition. Read references/cinetic.md for the execution contract.
