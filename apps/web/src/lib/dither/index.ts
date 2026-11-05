/**
 * dither-core from dithercn (https://dithercn.dev, MIT, see LICENSE), the
 * engine behind Syka Code's profile avatar: the plain TypeScript parts only.
 */
export { BAYER_2, BAYER_4, BAYER_8, BLUE_NOISE_64, DITHER_MATRICES, getThresholdMap, isInked, thresholdAt } from './matrices';
export type { DitherMatrix, ThresholdMap } from './matrices';
export { cssColor, DEFAULT_PALETTE, DITHER_COLOR_NAMES, DITHER_COLORS, MOTION } from './tokens';
export type { DitherColor, DitherColorName, DitherPalette, Rgba } from './tokens';
export { BLOOM_LEVELS, BLOOMS, bloomFilter, bloomStyle, FILL_VARIANTS } from './style';
export type { Bloom, FillVariant } from './style';
