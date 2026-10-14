// Cuelume, Copyright (c) 2026 Daniel Belyi. MIT; see ../../LICENSE.
// Types removed from upstream 2a1ba4fc1b67e8371c9f37e37a51e61353166335/src/audio/render.ts.
/**
 * Rendering: turns one shaped recipe into Web Audio nodes — an oscillator
 * or filtered-noise source per layer, each swelling in along a straight line
 * and dying away exponentially. Every sound rings faintly into the shared
 * room (see output.ts), so it sounds placed in a space.
 *
 * A straight swell is heard from its first moment; an exponential one stays
 * silent for most of its length and then jumps in, heard as a late second hit.
 */
import { arrangement, layerFactors } from "../sounds/context.js";
import { getNoise, NOISE_SECONDS, ROOM_SEND } from "./output.js";
export const SOURCE_STOP_PADDING = 0.05;
const DECAY_DB = 60;
export const fallTime = (decay) => decay / ((DECAY_DB / 20) * Math.LN10);
const CLEANUP_MARGIN = 0.05;
/** Holds `param` at `from`, then glides it toward the layer's `glideTo`, if any. */
function glide(param, from, layer, startTime) {
    param.setValueAtTime(from, startTime);
    if (layer.glideTo === undefined)
        return;
    param.exponentialRampToValueAtTime(layer.glideTo, startTime + (layer.glideTime ?? layer.attack + layer.decay));
}
/** Swells `param` to the layer's peak along a straight line, then lets it die away. */
function envelope(param, layer, startTime) {
    param.setValueAtTime(0, startTime);
    param.linearRampToValueAtTime(layer.peak, startTime + layer.attack);
    param.setTargetAtTime(0, startTime + layer.attack, fallTime(layer.decay));
}
function renderTone(context, destination, layer, startTime) {
    const oscillator = context.createOscillator();
    oscillator.type = layer.waveform;
    glide(oscillator.frequency, layer.frequency, layer, startTime);
    if (layer.detune)
        oscillator.detune.value = layer.detune;
    const gain = context.createGain();
    envelope(gain.gain, layer, startTime);
    oscillator.connect(gain).connect(destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + layer.attack + layer.decay + SOURCE_STOP_PADDING);
}
function renderNoise(context, bus, destination, layer, startTime) {
    const duration = layer.attack + layer.decay + SOURCE_STOP_PADDING;
    const source = context.createBufferSource();
    source.buffer = getNoise(context, bus);
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = layer.filterType;
    glide(filter.frequency, layer.filterFrequency, layer, startTime);
    if (layer.filterQ !== undefined)
        filter.Q.value = layer.filterQ;
    const gain = context.createGain();
    envelope(gain.gain, layer, startTime);
    source.connect(filter).connect(gain).connect(destination);
    // a different stretch of the same noise every time
    source.start(startTime, Math.random() * NOISE_SECONDS);
    source.stop(startTime + duration);
}
function sourceEnd(layers) {
    return Math.max(...layers.map((layer) => (layer.offset ?? 0) + layer.attack + layer.decay + SOURCE_STOP_PADDING));
}
const nudge = (amount) => 1 + (Math.random() * 2 - 1) * amount;
const STEADY_STRIKE = { pitch: 1, force: 1 };
/** Within one strike, each layer's ring length moves by up to this: same object, a slightly different hit. */
const DECAY_JITTER = 0.1;
/** And each tone's pitch by up to this, about 9 cents: the object's modes never sit exactly the same twice. */
const MODE_JITTER = 0.005;
/** How long a cue's last play takes to fade when the same cue plays again, in seconds. */
const HANDOFF_TIME = 0.08;
/**
 * A cue with notes lets its last play go slower, so a walk overlaps: in the
 * Artasaka press the old note falls about twice as fast once the next lands.
 */
const NOTE_HANDOFF_TIME = 0.4;
/** The Artasaka press lets go 85–95 ms after it presses; a play with no real let-go waits this long. */
export const RELEASE_GAP = 0.09;
/**
 * A copy of `layer` bent by the play's context shape and its strike. A cue
 * with `vary` also moves each layer's ring and tone a little on its own, so no
 * two plays match; one without plays exactly. A harder strike raises a noise
 * layer's filter with its level: louder is brighter. A reversed sweep starts
 * where it would have ended. `time` moves every layer's start, and a
 * `stretch` layer lasts as long as the count.
 */
function shaped(layer, shape, strike, vary, walk) {
    const factors = layerFactors(layer, shape);
    const tune = layer.kind === "tone" ? (vary ? nudge(MODE_JITTER) : 1) : strike.force;
    const pitch = factors.pitch * strike.pitch * tune * (layer.note ? walk : 1);
    const peak = layer.peak * factors.gain * strike.force;
    const stretch = layer.stretch ? shape.time : 1;
    const decay = layer.decay * factors.length * stretch * (vary ? nudge(DECAY_JITTER) : 1);
    const start = layer.kind === "tone" ? layer.frequency : layer.filterFrequency;
    const [from, to] = shape.sweep < 0 && layer.glideTo !== undefined ? [layer.glideTo, start] : [start, layer.glideTo];
    const glideTo = to === undefined ? undefined : to * pitch;
    const timing = {
        offset: (layer.offset ?? 0) * shape.time,
        attack: layer.attack * stretch,
        glideTime: layer.glideTime === undefined ? undefined : layer.glideTime * stretch,
    };
    return layer.kind === "tone"
        ? { ...layer, ...timing, frequency: from * pitch, glideTo, peak, decay }
        : { ...layer, ...timing, filterFrequency: from * pitch, glideTo, peak, decay };
}
/**
 * The layers `part` of one play sounds: arranged for its emphasis, bent by its
 * shape, strike and walk, the release starting as the gesture lets go. No Web
 * Audio here, so scripts/sound.mjs renders the same layers offline.
 */
export function layersFor({ recipe, emphasis, shape, step }, part) {
    const parts = [];
    if (part !== "release")
        parts.push([recipe.layers, 0]);
    if (part !== "press" && recipe.release)
        parts.push([recipe.release, part === "both" ? RELEASE_GAP : 0]);
    const walk = 2 ** ((recipe.walk?.[step] ?? 0) / 12);
    const { vary } = recipe;
    const strike = vary ? { pitch: nudge(vary.pitch), force: nudge(vary.level) } : STEADY_STRIKE;
    return parts.flatMap(([partLayers, delay]) => arrangement(partLayers, emphasis).map((layer) => {
        const bent = shaped(layer, shape, strike, vary, walk);
        return { ...bent, offset: (bent.offset ?? 0) + delay };
    }));
}
export function renderRecipe(context, getBus, voices, sound, played, part) {
    const { recipe, volume } = played;
    const layers = layersFor(played, part);
    if (layers.length === 0)
        return;
    const now = context.currentTime;
    const bus = getBus();
    const { output, room } = bus;
    const master = context.createGain();
    master.gain.value = recipe.masterGain * volume;
    master.connect(output);
    const send = context.createGain();
    send.gain.value = ROOM_SEND * (recipe.room ?? 1);
    master.connect(send).connect(room);
    bus.live.add(master);
    // a release rings with its press rather than replacing it
    if (part !== "release") {
        const last = voices.get(sound);
        if (last) {
            last.gain.gain.setValueAtTime(last.gain.gain.value, now);
            last.gain.gain.exponentialRampToValueAtTime(0.0001, now + last.fade);
        }
        const fade = recipe.layers.some((layer) => layer.note) ? NOTE_HANDOFF_TIME : HANDOFF_TIME;
        voices.set(sound, { gain: master, fade });
    }
    for (const layer of layers) {
        const startTime = now + (layer.offset ?? 0);
        if (layer.kind === "tone")
            renderTone(context, master, layer, startTime);
        else
            renderNoise(context, bus, master, layer, startTime);
    }
    // the room rings on by itself once the last source has fed it
    const cleanupAfterMs = (sourceEnd(layers) + CLEANUP_MARGIN) * 1000;
    setTimeout(() => {
        if (voices.get(sound)?.gain === master)
            voices.delete(sound);
        bus.live.delete(master);
        master.disconnect();
        send.disconnect();
    }, cleanupAfterMs);
}
