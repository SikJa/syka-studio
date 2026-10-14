// Cuelume, Copyright (c) 2026 Daniel Belyi. MIT; see ../../LICENSE.
// Types removed from upstream 2a1ba4fc1b67e8371c9f37e37a51e61353166335/src/sounds/layers.ts.
/**
 * Layers — the building blocks every cue is made of: one tone or one burst
 * of filtered noise, shaped by an attack/decay envelope. The builders below
 * (`knock`, `struck`, `click`, …) are how themes spell real materials —
 * a struck bar, a switch click, a breath of air — out of those layers.
 */
/**
 * Success and ready ring into the room 6 dB more than the rest, about 16 dB
 * under the sound itself: a result lands in the space without sounding far.
 */
export const LANDED = 2;
/** How far sharp a knock is struck, and how fast it drops to its pitch. */
const KNOCK_DROP = 1.6;
const KNOCK_DROP_TIME = 0.018;
/**
 * A knock's body: a sine struck sharp that drops to `frequency` in 18 ms, the
 * way a small hollow part answers a tap. Heard as a soft "tok", never as a
 * slide. Measured from the keycap sounds in DawoodUI's Artasaka preview.
 */
export const knock = (frequency, decay, peak, more = {}) => ({
    kind: "tone", waveform: "sine", frequency: frequency * KNOCK_DROP, glideTo: frequency, glideTime: KNOCK_DROP_TIME,
    attack: 0.001, decay, peak, ...more,
});
/** A free bar, glass or metal: modes at 1, 2.76 and 5.40 times the fundamental (euphonics.org, free-free bar). */
export const BAR = [[1, 1], [2.76, 0.3], [5.4, 0.1]];
/** A marimba bar, undercut so its second mode sits at 3.99x (STK ModalBar's marimba). Rounder than a free bar. */
export const MALLET = [[1, 1], [3.99, 0.2]];
/** Modes above this are left out: the register ceiling every theme keeps. */
const MODE_CEILING = 5000;
/** A struck tone swells in over 3 ms: short enough to strike, long enough not to click. */
const STRIKE_ATTACK = 0.003;
/** No mode dies faster than this, or it stops being heard as a pitch. */
const SHORTEST_MODE = 0.028;
const MODE_DAMPING = 0.75;
/**
 * A struck note: one sine per mode of `material`. A higher mode dies sooner,
 * so the highs go first as on any real bar, though more gently than the 1/f
 * of van den Doel and Pai's model. Upper modes are ornament that
 * subtle leaves out; `from` moves the whole note to a higher emphasis.
 */
export function struck(frequency, decay, peak, material, { from } = {}) {
    return material
        .filter(([ratio]) => frequency * ratio <= MODE_CEILING)
        .map(([ratio, level], mode) => {
        const layerFrom = mode === 0 ? from : (from ?? "normal");
        return {
            kind: "tone", waveform: "sine", frequency: frequency * ratio, attack: STRIKE_ATTACK,
            decay: Math.max(SHORTEST_MODE, decay / ratio ** MODE_DAMPING), peak: peak * level, ...(layerFrom ? { from: layerFrom } : {}),
        };
    });
}
/** Lowpass Q in dB that gives a flat, unresonant corner. Web Audio reads a lowpass Q in dB. */
export const FLAT_Q = -3;
/**
 * The mallet meeting the bar: 3 ms of noise, low-passed at the mallet's
 * hardness. A soft felt mallet sits near 1 kHz, a hard one near 3 kHz. It
 * makes a chord a struck object rather than a test tone.
 */
export const contact = (hardness, peak, more = {}) => ({
    kind: "noise", filterType: "lowpass", filterFrequency: hardness, filterQ: FLAT_Q, attack: 0.001, decay: 0.0035, peak, ...more,
});
/**
 * One resonance of a switch's click: a narrow ring that dies in about 5 ms.
 * Measured from the Subscribe press in DawoodUI's Artasaka preview.
 */
export const ring = (frequency, peak, more = {}) => ({
    kind: "noise", filterType: "bandpass", filterFrequency: frequency, filterQ: 8, attack: 0.001, decay: 0.0055, peak, ...more,
});
/** How far below its ring a click's body sits. */
const CLICK_BODY = 0.675;
/**
 * A click: a tight ring over a softer, wider body below it, so the energy
 * spreads the way a real switch's does. The Artasaka press rings at 4 kHz and
 * lets go at 4.8 kHz, 5 dB quieter.
 */
export const click = (frequency, peak, more = {}) => [
    ring(frequency, peak, more),
    ring(frequency * CLICK_BODY, peak * 0.5, { filterQ: 2, ...more }),
];
/** Air moved by a part: filtered noise that sweeps from `from` to `to` Hz. */
export const air = (from, to, decay, peak, more = {}) => ({
    kind: "noise", filterType: "bandpass", filterFrequency: from, glideTo: to, glideTime: decay, filterQ: 1.5, attack: 0.008, decay, peak, ...more,
});
/** A dull thud: a part hitting its stop. */
export const thud = (frequency, decay, peak, more = {}) => ({
    kind: "noise", filterType: "lowpass", filterFrequency: frequency, filterQ: 0.7, attack: 0.001, decay, peak, ...more,
});
/**
 * A note's partials as the Artasaka press sounds them: [multiple, share of
 * the ring, level]. The octave at -6 dB carries a low note on small speakers;
 * the faint third and fourth give it its edge.
 */
const NOTE_PARTIALS = [[1, 1, 1], [2, 0.9, 0.5], [3, 1, 0.04], [4, 0.73, 0.056]];
/** The note starts 9% sharp and settles within 15 ms. */
const NOTE_SHARP = 1.09;
const NOTE_SETTLE = 0.015;
/** It swells in rather than striking: the video's peaks 105–125 ms after the click. */
const NOTE_SWELL = 0.11;
/**
 * A deep note that swells in under a click and rings on, as the Artasaka
 * press does. With a `decay` of 1.36 s it falls about 45 dB a second, as the
 * video's does.
 * Upper partials are ornament that subtle leaves out; `from` moves the whole
 * note to a higher emphasis.
 */
export function note(frequency, decay, peak, { from } = {}) {
    const attack = Math.min(NOTE_SWELL, decay / 2);
    return NOTE_PARTIALS.map(([multiple, length, level], partial) => {
        const layerFrom = partial < 2 ? from : (from ?? "normal");
        return {
            note: true, kind: "tone", waveform: "sine", frequency: frequency * multiple * NOTE_SHARP, glideTo: frequency * multiple,
            glideTime: NOTE_SETTLE, attack, decay: decay * length, peak: peak * level, ...(layerFrom ? { from: layerFrom } : {}),
        };
    });
}
