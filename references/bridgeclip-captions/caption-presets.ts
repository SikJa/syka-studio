/**
 * Caption presets the engine renders (engine/clip_engine/config.py
 * CaptionPreset). The Create picker carries the visual preview for each; a
 * test keeps the three lists in step.
 */
export const CAPTION_PRESETS = [
  { id: 'pop', name: 'Pop', description: 'The all-rounder' },
  { id: 'spotlight', name: 'Spotlight', description: 'Word on a pill' },
  { id: 'impact', name: 'Impact', description: 'Tall, two words at a time' },
  { id: 'glow', name: 'Glow', description: 'Cyan bloom, tech & gaming' },
  { id: 'boxed', name: 'Boxed', description: 'Readable on any footage' },
  { id: 'sweep', name: 'Sweep', description: 'Colour follows the voice' },
  { id: 'editorial', name: 'Editorial', description: 'Serif for podcasts & stories' },
  { id: 'hype', name: 'Hype', description: 'Heavy stroke, high energy' },
  { id: 'punch', name: 'Punch', description: 'One huge word at a time' },
  { id: 'neon', name: 'Neon', description: 'Magenta bloom, music & lifestyle' },
  { id: 'headline', name: 'Headline', description: 'Word on a red news tag' },
  { id: 'paper', name: 'Paper', description: 'Dark type on a white card' },
  { id: 'subtle', name: 'Subtle', description: 'Light touch for interviews & vlogs' }
] as const

export type CaptionPresetId = (typeof CAPTION_PRESETS)[number]['id']
export const CAPTION_PRESET_IDS: readonly string[] = CAPTION_PRESETS.map((preset) => preset.id)
export const DEFAULT_CAPTION_PRESET: CaptionPresetId = 'pop'

export function isCaptionPresetId(value: unknown): value is CaptionPresetId {
  return typeof value === 'string' && CAPTION_PRESET_IDS.includes(value)
}
