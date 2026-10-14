// Cuelume, Copyright (c) 2026 Daniel Belyi. MIT; see ../../LICENSE.
// Types removed from upstream 2a1ba4fc1b67e8371c9f37e37a51e61353166335/src/sounds/themes.ts.
/**
 * Themes — finished materials for the same fourteen cues. A theme changes how a
 * cue sounds, never what it means, so every theme carries every cue.
 */
import { BUBBLE } from "./bubble.js";
import { MECH } from "./mech.js";
import { PRESS } from "./press.js";
import { RECIPES } from "./recipes.js";
export const THEMES = {
    default: RECIPES,
    mech: MECH,
    bubble: BUBBLE,
    press: PRESS,
};
/** The built-in theme names. */
export const themes = Object.keys(THEMES);
export function isThemeName(value) {
    return typeof value === "string" && Object.prototype.hasOwnProperty.call(THEMES, value);
}
