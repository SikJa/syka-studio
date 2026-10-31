/* Native Syka adaptations of HyperFrames caption treatments.
 * Reference: heygen-com/hyperframes, 4371981b740d92f70e520cfbec34db68a1c93434.
 * Apache-2.0 notice and adaptation details: LICENSE.HyperFrames.txt / HYPERFRAMES-NOTICE.md.
 * Animation is evaluated from source word times, without GSAP, a DOM or a CDN.
 */
import { CaptionAlign, CaptionType, FontStyle, TextAlign, TextBaseline, TextCase } from '../../constants';
import { Caption, Color, Computed, Host, Sequential, TextRange, TextStyle } from '../../traits';
import { store } from '../../world/store';
import { createEntity } from '../../actions/entities';
import { appendChild } from '../../actions/hierarchy';
import { getParentNode } from '../../queries/hierarchy';
import { loadWebFont } from '../../fonts/utils';
import { renderText, type Token, type TextTokenEffect } from '../../utils/text';
import { colorToHex } from '../../utils/color';
import { bridgeClipGroups } from './bridgeclip';
import { clearTextRanges, resolveTranscript, setChars } from './utils';
import { placeCaption } from './position';
import type { Asset, WordGroup } from '@diffusionstudio/assets';
import type { Entity, World } from 'koota';
import type { CaptionDecoder, CaptionPresetStyle } from './types';

export const HYPERFRAMES_TYPES = {
  'clip-wipe': CaptionType.HYPERFRAMES_CLIP_WIPE,
  'kinetic-slam': CaptionType.HYPERFRAMES_KINETIC_SLAM,
  'weight-shift': CaptionType.HYPERFRAMES_WEIGHT_SHIFT,
  'neon-glow': CaptionType.HYPERFRAMES_NEON_GLOW,
  'glitch-rgb': CaptionType.HYPERFRAMES_GLITCH_RGB,
  'gradient-fill': CaptionType.HYPERFRAMES_GRADIENT_FILL,
  'parallax-layers': CaptionType.HYPERFRAMES_PARALLAX_LAYERS,
  'editorial-emphasis': CaptionType.HYPERFRAMES_EDITORIAL_EMPHASIS,
} as const;
export type HyperFramesPreset = keyof typeof HYPERFRAMES_TYPES;
const BASE = { fontFamily: 'Inter', fontSize: 76, fontWeight: '700', fontStyle: FontStyle.NORMAL,
  textAlign: TextAlign.CENTER, textBaseline: TextBaseline.MIDDLE, textCase: TextCase.ORIGINAL,
  leading: 1.12, letterSpacing: undefined } as const;
export const HYPERFRAMES_STYLES = {
  'clip-wipe': { ...BASE, fontFamily: 'Poppins Black', fontWeight: '900', textCase: TextCase.UPPER },
  'kinetic-slam': { ...BASE, fontFamily: 'Archivo Black', fontWeight: '400', fontSize: 126, textCase: TextCase.UPPER },
  'weight-shift': { ...BASE, fontFamily: 'Montserrat' },
  'neon-glow': { ...BASE },
  'glitch-rgb': { ...BASE, fontFamily: 'Source Code Pro', textCase: TextCase.UPPER },
  'gradient-fill': { ...BASE, fontFamily: 'Urbanist', fontSize: 86, fontWeight: '800' },
  'parallax-layers': { ...BASE, fontFamily: 'Montserrat', fontWeight: '800' },
  'editorial-emphasis': { ...BASE, fontFamily: 'Instrument Serif', fontWeight: '400', fontStyle: FontStyle.ITALIC, fontSize: 98 },
} as const satisfies Record<HyperFramesPreset, CaptionPresetStyle>;

const clamp = (n: number) => Math.max(0, Math.min(1, n));
const out = (n: number) => 1 - (1 - clamp(n)) ** 3;

/** Explicit linger prevents either a stale caption in silence or overlap at a cut. */
export function hyperFramesCueAt(groups: WordGroup[], time: number, linger = 0.4): number {
  return groups.findIndex((g, i) => time >= g[0]!.start
    && time < Math.min(g.at(-1)!.end + linger, groups[i + 1]?.[0]?.start ?? Infinity));
}

/** Pure, deterministic word animation: seeking backwards produces the same pose. */
export function hyperFramesWordEffect(preset: HyperFramesPreset, age: number, index: number, size: number): TextTokenEffect {
  const p = out(age / 0.2);
  if (preset === 'clip-wipe') return { reveal: p, opacity: age < 0 ? 0 : 1 };
  if (preset === 'kinetic-slam') {
    const t = clamp(age / 0.22) - 1;
    const back = 1 + 2.7 * t ** 3 + 1.7 * t ** 2;
    return { opacity: out(age / 0.065), scale: index % 4 === 3 ? 0.5 + 0.5 * back : 1,
      x: index % 4 === 1 ? -size * 1.6 * (1 - p) : index % 4 === 2 ? size * 1.6 * (1 - p) : 0,
      y: index % 4 === 0 ? -size * 0.7 * (1 - back) : 0 };
  }
  if (preset === 'parallax-layers') return { opacity: p, y: size * 0.25 * (1 - p), scale: 0.94 + 0.06 * p };
  if (preset === 'glitch-rgb') {
    const phase = Math.floor(Math.max(0, age) * 60);
    return { opacity: age < 0 ? 0.35 : 1, x: age >= 0 && age < 0.13 ? ((phase * 17 + index * 7) % 5 - 2) * size * 0.035 : 0 };
  }
  return { opacity: age < 0 ? 0.42 : 0.7 + 0.3 * p };
}

export class HyperFramesCaptionDecoder implements CaptionDecoder {
  readonly type: CaptionType;
  readonly initPromise: Promise<void>;
  groups: WordGroup[] = [];
  ready = false;
  styled = false;
  private cue = -2;
  private time = 0;
  private ranges: { range: Entity; word: number }[] = [];
  private wordOffset = 0;
  constructor(private readonly asset: Asset, readonly preset: HyperFramesPreset) {
    this.type = HYPERFRAMES_TYPES[preset];
    this.initPromise = this.init();
  }
  private async init(): Promise<void> {
    this.groups = bridgeClipGroups(await resolveTranscript(this.asset), this.preset === 'kinetic-slam' ? 1 : 4);
    this.ready = true;
  }
  reposition(world: World, entity: Entity): boolean {
    let parent = getParentNode(entity);
    while (parent?.has(Sequential)) parent = getParentNode(parent);
    if (!parent) return false;
    const width = parent.get(Computed)?.width ?? 1080;
    const size = entity.get(TextStyle)?.fontSize ?? HYPERFRAMES_STYLES[this.preset].fontSize;
    return placeCaption(world, entity, { width: width * 0.84, height: size * 3.1,
      defaultAlign: this.preset === 'kinetic-slam' ? CaptionAlign.CENTER : CaptionAlign.BOTTOM });
  }
  applyStyles(world: World, entity: Entity): boolean {
    if (!this.reposition(world, entity)) return false;
    const style = HYPERFRAMES_STYLES[this.preset];
    void loadWebFont(world, style.fontFamily, style.fontStyle, style.fontWeight);
    return true;
  }
  seekTo(world: World, entity: Entity, time: number): void {
    this.time = time;
    const cue = hyperFramesCueAt(this.groups, time, this.preset === 'kinetic-slam' ? 0.08 : 0.4);
    if (cue === this.cue) return;
    this.cue = cue;
    clearTextRanges(world, entity);
    this.ranges = [];
    if (cue < 0) { setChars(world, entity, ''); return; }
    this.wordOffset = this.groups.slice(0, cue).reduce((n, g) => n + g.length, 0);
    const group = this.groups[cue]!;
    setChars(world, entity, group.map(w => w.text).join(' '));
    let start = 0;
    group.forEach((word, i) => {
      const range = createEntity(world);
      range.add(TextRange({ start, end: start + word.text.length }), Color({ value: 0xFFFFFF }));
      appendChild(world, range, entity);
      this.ranges.push({ range, word: i });
      start += word.text.length + 1;
    });
  }
  draw(world: World, entity: Entity): void {
    if (this.cue < 0) return;
    const group = this.groups[this.cue]!;
    const active = group.findIndex(w => this.time >= w.start && this.time < w.end);
    const colors = entity.get(Caption)?.colors;
    const accent = colors?.[0] ?? (this.preset === 'editorial-emphasis' ? 0xFFE1A6 : 0x67E8F9);
    const secondary = colors?.[1] ?? 0xC4B5FD;
    const base = entity.get(Computed)?.color ?? entity.get(Color)?.value ?? 0xFFFFFF;
    const size = entity.get(TextStyle)?.fontSize ?? HYPERFRAMES_STYLES[this.preset].fontSize;
    const cueEnd = Math.min(group.at(-1)!.end + (this.preset === 'kinetic-slam' ? 0.08 : 0.4), this.groups[this.cue + 1]?.[0]?.start ?? Infinity);
    const cueOpacity = out((cueEnd - this.time) / 0.06);
    const wordFor = (t: Token) => this.ranges.find(r => t.ranges.includes(r.range))?.word ?? -1;
    for (const { range, word } of this.ranges) {
      const color = word === active && this.preset !== 'gradient-fill' && this.preset !== 'glitch-rgb' ? accent : base;
      store(world, Color).value[range.id()] = color;
      store(world, Computed).color[range.id()] = color;
    }
    renderText(world, entity, {
      tokenEffect: token => {
        const i = wordFor(token);
        if (i < 0) return { opacity: cueOpacity };
        const effect = hyperFramesWordEffect(this.preset, this.time - group[i]!.start, this.wordOffset + i, size);
        return { ...effect, opacity: (effect.opacity ?? 1) * cueOpacity };
      },
      tokenStyle: (ctx, token) => {
        const i = wordFor(token);
        if (this.preset === 'weight-shift' && !entity.get(Host)?.props?.fontWeight) {
          // Measure with the heavier face; the emphasis does not move neighbouring words.
          ctx.font = ctx.font.replace(/\b[1-9]00(?=\s)/, i === active ? '700' : '300');
        }
        if (this.preset === 'neon-glow' && i === active) {
          const transform = ctx.getTransform();
          ctx.shadowColor = colorToHex(accent);
          ctx.shadowBlur = size * 0.28 * Math.hypot(transform.a, transform.b);
        }
      },
      intrinsicFill: this.preset === 'gradient-fill' ? (ctx, token) => {
        const gradient = ctx.createLinearGradient(token.left, token.top, token.right, token.bottom);
        gradient.addColorStop(0, colorToHex(accent));
        gradient.addColorStop(1, colorToHex(secondary));
        return gradient;
      } : undefined,
      tokenUnderlay: (ctx, token) => {
        const i = wordFor(token);
        const age = i < 0 ? 1 : this.time - group[i]!.start;
        if (this.preset === 'glitch-rgb' && age >= 0 && age < 0.15) {
          ctx.globalAlpha *= 0.5 * (1 - age / 0.15);
          ctx.fillStyle = colorToHex(accent); ctx.fillText(token.chars, token.x - size * 0.055, token.y);
          ctx.fillStyle = colorToHex(secondary); ctx.fillText(token.chars, token.x + size * 0.055, token.y);
        } else if (this.preset === 'parallax-layers' && age >= 0 && age < 0.25) {
          ctx.globalAlpha *= 0.3 * (1 - age / 0.25);
          ctx.fillStyle = colorToHex(accent); ctx.fillText(token.chars, token.x - size * 0.065, token.y + size * 0.09);
        }
      },
      beforeDraw: this.preset === 'editorial-emphasis' ? (ctx, lines) => {
        ctx.fillStyle = colorToHex(accent);
        ctx.globalAlpha *= cueOpacity;
        for (const token of lines.flat().filter(t => wordFor(t) === active)) {
          const progress = out((this.time - group[active]!.start) / 0.16);
          ctx.beginPath(); ctx.roundRect(token.left, token.bottom + size * 0.1, Math.max(0.01, (token.right - token.left) * progress), size * 0.035, size * 0.018); ctx.fill();
        }
      } : undefined,
    });
  }
  dispose(): void { this.groups = []; this.ranges = []; this.cue = -1; }
}
