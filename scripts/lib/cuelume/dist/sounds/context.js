// Cuelume, Copyright (c) 2026 Daniel Belyi. MIT; see ../../LICENSE.
// Types removed from upstream 2a1ba4fc1b67e8371c9f37e37a51e61353166335/src/sounds/context.ts.
/**
 * Context-aware shaping: how a cue bends to the interaction that played it.
 *
 *   semantic cue + interaction context + emphasis = rendered sound
 *
 * A shape scales a recipe's pitch, level, and length, plus its bright layers
 * (centred at or above BRIGHT_HZ) and its tail (layers that start late). Every
 * factor is curated here and clamped, so a cue always stays recognisably itself
 * and context that is missing leaves the canonical sound untouched.
 */
const IDENTITY = { pitch: 1, level: 1, length: 1, bright: 1, tail: 1, sweep: 1, time: 1 };
const BRIGHT_HZ = 2500;
/**
 * How much the action matters. Most of the difference is the arrangement
 * (which layers play, see `arrangement`); this shape only leans on it.
 */
const EMPHASIS = {
    subtle: { level: 0.8, length: 0.85, bright: 0.75 },
    normal: {},
    strong: { pitch: 0.98, level: 1.08, length: 1.2, bright: 1.1 },
};
const RANK = { subtle: 0, normal: 1, strong: 2 };
/** `type`: bigger keys sound bigger; deleting sits lower than writing. */
const KEYS = {
    printable: {},
    space: { pitch: 0.86, level: 1.08, length: 1.15 },
    delete: { pitch: 0.92, level: 0.9, bright: 0.8 },
    enter: { pitch: 0.8, level: 1.12, length: 1.25 },
};
/** `tap`: the glass answers to what touched it. */
const INPUTS = {
    mouse: {},
    touch: { pitch: 0.97, level: 0.92, bright: 0.45 },
    pen: { pitch: 1.02, bright: 1.3 },
    keyboard: { pitch: 0.94, length: 0.85, bright: 0.7 },
};
/** `select`: a later option rises, an earlier one falls. Perceptible, never melodic. */
const DIRECTION_STEP = 0.05;
/** Repeats closer than FAST_MS play fully lightened; slower than SLOW_MS, not at all. */
const FAST_MS = 70;
const SLOW_MS = 220;
const CADENCE_CUES = new Set(["type", "select", "tap", "toggle", "navigate"]);
/** `count` is written at COUNT_MS; `duration` stretches it within these bounds. */
const COUNT_MS = 800;
const COUNT_MIN_MS = 300;
const COUNT_MAX_MS = 2000;
/** Going back plays these cues' glides backwards, so they fall. */
const REVERSIBLE = new Set(["navigate", "toggle", "count"]);
/** The layers an emphasis plays: subtle strips ornament, strong adds its own layer. */
export function arrangement(layers, emphasis) {
    return layers.filter((layer) => RANK[emphasis] >= RANK[layer.from ?? "subtle"]);
}
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
export function resolveEmphasis(value) {
    return typeof value === "string" && own(EMPHASIS, value) ? value : "normal";
}
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const DIRECTIONS = { forward: 1, back: -1 };
/**
 * The context a caller passed to `play()`, in the shape bindings produce.
 * Unknown values are left out, so the cue plays as it would with none.
 */
export function contextFrom(options) {
    const context = {};
    if (!options)
        return context;
    const { direction, key, input, duration } = options;
    if (typeof direction === "string" && own(DIRECTIONS, direction))
        context.direction = DIRECTIONS[direction];
    if (typeof key === "string" && own(KEYS, key))
        context.key = key;
    if (typeof input === "string" && own(INPUTS, input))
        context.input = input;
    if (typeof duration === "number" && Number.isFinite(duration))
        context.duration = clamp(duration, COUNT_MIN_MS, COUNT_MAX_MS);
    return context;
}
function cadence(sinceLastMs) {
    const speed = Math.min(1, Math.max(0, (SLOW_MS - sinceLastMs) / (SLOW_MS - FAST_MS)));
    return { level: 1 - 0.22 * speed, length: 1 - 0.25 * speed, bright: 1 - 0.2 * speed, tail: 1 - 0.8 * speed };
}
/** The combined shape for one play of `sound`. */
export function shapeFor(sound, context, emphasis, sinceLastMs) {
    const parts = [EMPHASIS[emphasis]];
    if (CADENCE_CUES.has(sound))
        parts.push(cadence(sinceLastMs));
    if (sound === "type" && context.key)
        parts.push(KEYS[context.key]);
    if (sound === "tap" && context.input)
        parts.push(INPUTS[context.input]);
    if (sound === "select" && context.direction)
        parts.push({ pitch: 1 + DIRECTION_STEP * context.direction });
    if (sound === "count" && context.duration)
        parts.push({ time: context.duration / COUNT_MS });
    if (REVERSIBLE.has(sound) && context.direction === -1)
        parts.push({ sweep: -1 });
    const shape = { ...IDENTITY };
    for (const part of parts) {
        for (const key of Object.keys(part))
            shape[key] *= part[key];
    }
    return shape;
}
/** What `shape` does to one layer, bounded so no context can run away with a cue. */
export function layerFactors(layer, shape) {
    const frequency = layer.kind === "tone" ? layer.frequency : layer.filterFrequency;
    const gain = shape.level * (frequency >= BRIGHT_HZ ? shape.bright : 1) * ((layer.offset ?? 0) > 0 ? shape.tail : 1);
    return {
        pitch: clamp(shape.pitch, 0.75, 1.25),
        gain: clamp(gain, 0, 1.5),
        length: clamp(shape.length, 0.6, 1.6),
    };
}
