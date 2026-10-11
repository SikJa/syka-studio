/* Native Diffusion adaptation of BridgeClip caption styling.
 * Reference: bridge-mind/bridgeclip, b996820ef80fa324a3ad233bef1aac5cc6936804.
 * Copyright 2026 BridgeMind LLC. MIT notice: LICENSE.BridgeClip.txt.
 * Font files are unchanged SIL OFL fonts; notices live in ../../fonts/assets.
 */

import { CaptionAlign, CaptionType, FontStyle, TextAlign, TextBaseline, TextCase } from '../../constants';
import { Blur, Caption, Color, Computed, Offset, Opacity, Sequential, Shadow, TextRange, TextStyle } from '../../traits';
import { store } from '../../world/store';
import { createEntity } from '../../actions/entities';
import { appendChild } from '../../actions/hierarchy';
import { getParentNode } from '../../queries/hierarchy';
import { loadWebFont } from '../../fonts/utils';
import { renderText, type Token } from '../../utils/text';
import { colorToHex } from '../../utils/color';
import { clearTextRanges, resolveTranscript, setChars } from './utils';
import { placeCaption } from './position';
import type { Asset, Transcript, WordGroup } from '@diffusionstudio/assets';
import type { Entity, World } from 'koota';
import type { CaptionDecoder, CaptionPresetStyle } from './types';

export type BridgeClipPreset = 'subtle' | 'editorial' | 'boxed' | 'spotlight';

const BASE_STYLE = {
	fontWeight: '400', fontStyle: FontStyle.NORMAL,
	textAlign: TextAlign.CENTER, textBaseline: TextBaseline.MIDDLE,
	textCase: TextCase.ORIGINAL, leading: 1.08, letterSpacing: undefined,
} as const;

export const BRIDGECLIP_STYLES = {
	subtle: { ...BASE_STYLE, fontFamily: 'Montserrat ExtraBold', fontWeight: '800', fontSize: 70 },
	editorial: { ...BASE_STYLE, fontFamily: 'Instrument Serif', fontStyle: FontStyle.ITALIC, fontSize: 112 },
	boxed: { ...BASE_STYLE, fontFamily: 'Archivo Black', fontSize: 70, textCase: TextCase.UPPER },
	spotlight: { ...BASE_STYLE, fontFamily: 'Poppins Black', fontWeight: '900', fontSize: 80, textCase: TextCase.UPPER },
} as const satisfies Record<BridgeClipPreset, CaptionPresetStyle>;

const TYPES = {
	subtle: CaptionType.BRIDGECLIP_SUBTLE, editorial: CaptionType.BRIDGECLIP_EDITORIAL,
	boxed: CaptionType.BRIDGECLIP_BOXED, spotlight: CaptionType.BRIDGECLIP_SPOTLIGHT,
} as const;
const EMPHASIS = { subtle: 0xC4F1FF, editorial: 0xFFE6B8, boxed: 0xFFD23F, spotlight: 0xFFFFFF };
const CUE_LINGER = 0.7;
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => 1 - Math.pow(1 - clamp01(n), 3);

/** Keep word timestamps intact; only group for display. Long pauses end a cue. */
export function bridgeClipGroups(transcript: Transcript, maxWords: number): WordGroup[] {
	const groups: WordGroup[] = [];
	for (const segment of transcript) {
		let group: WordGroup = [];
		for (const word of segment.words) {
			const previous = group.at(-1);
			const length = group.reduce((n, w) => n + w.text.length + 1, 0) + word.text.length;
			if (group.length && (group.length >= maxWords || length > 28 || word.start - previous!.end > CUE_LINGER)) {
				groups.push(group); group = [];
			}
			group.push(word);
			if (/[.!?;,]$/.test(word.text)) { groups.push(group); group = []; }
		}
		if (group.length) groups.push(group);
	}
	return groups;
}

export function bridgeClipCueAt(groups: WordGroup[], time: number): number {
	return groups.findIndex((group, i) => time >= group[0]!.start
		&& time < Math.min(group.at(-1)!.end + CUE_LINGER, groups[i + 1]?.[0]?.start ?? Infinity));
}

/** Absolute-time pop, independent of playback direction or how many seeks ran. */
export function bridgeClipPop(age: number): number {
	if (age < 0) return 1;
	if (age < 0.09) return 0.82 + 0.24 * smooth(age / 0.09);
	if (age < 0.17) return 1.06 - 0.06 * smooth((age - 0.09) / 0.08);
	return 1;
}

function mixColor(a: number, b: number, amount: number): number {
	return [16, 8, 0].reduce((color, shift) => color | Math.round(((a >> shift) & 255) * (1 - amount) + ((b >> shift) & 255) * amount) << shift, 0);
}

export class BridgeClipCaptionDecoder implements CaptionDecoder {
	public readonly type: CaptionType;
	public readonly initPromise: Promise<void>;
	public groups: WordGroup[] = [];
	public ready = false;
	public styled = false;
	private currentGroup = -1;
	private currentTime = 0;
	private ranges: { range: Entity; word: number }[] = [];

	constructor(private readonly asset: Asset, public readonly preset: BridgeClipPreset) {
		this.type = TYPES[preset];
		this.initPromise = this.init();
	}

	private async init(): Promise<void> {
		this.groups = bridgeClipGroups(await resolveTranscript(this.asset), this.preset === 'boxed' || this.preset === 'spotlight' ? 3 : 4);
		this.ready = true;
	}

	public reposition(world: World, entity: Entity): boolean {
		let parent = getParentNode(entity);
		while (parent?.has(Sequential)) parent = getParentNode(parent);
		if (!parent) return false;
		const parentWidth = parent.get(Computed)?.width ?? 1080;
		const fontSize = entity.get(TextStyle)?.fontSize ?? BRIDGECLIP_STYLES[this.preset].fontSize;
		return placeCaption(world, entity, {
			width: Math.min(1180, parentWidth * 0.86), height: Math.ceil(fontSize * 3.1), defaultAlign: CaptionAlign.BOTTOM,
		});
	}

	public applyStyles(world: World, entity: Entity): boolean {
		if (!this.reposition(world, entity)) return false;
		const style = BRIDGECLIP_STYLES[this.preset];
		void loadWebFont(world, style.fontFamily, style.fontStyle, style.fontWeight);
		if (this.preset !== 'boxed') {
			const shadow = createEntity(world);
			shadow.add(Shadow, Color({ value: 0 }), Opacity({ value: 0.85 }), Blur({ value: this.preset === 'editorial' ? 20 : 16 }), Offset({ x: 0, y: 3 }));
			appendChild(world, shadow, entity);
		}
		return true;
	}

	public seekTo(world: World, entity: Entity, time: number): void {
		this.currentTime = time;
		const index = bridgeClipCueAt(this.groups, time);
		if (index === this.currentGroup) return;
		this.currentGroup = index;
		clearTextRanges(world, entity);
		this.ranges = [];
		if (index < 0) { setChars(world, entity, ''); return; }
		const group = this.groups[index]!;
		setChars(world, entity, group.map(w => w.text).join(' '));
		let start = 0;
		for (let word = 0; word < group.length; word++) {
			const text = group[word]!.text;
			const range = createEntity(world);
			range.add(TextRange({ start, end: start + text.length }), Color({ value: 0xFFFFFF }));
			appendChild(world, range, entity);
			this.ranges.push({ range, word });
			start += text.length + 1;
		}
	}

	public draw(world: World, entity: Entity): void {
		if (this.currentGroup < 0) return;
		const group = this.groups[this.currentGroup]!;
		const colors = entity.get(Caption)?.colors;
		const baseColor = entity.get(Computed)?.color ?? entity.get(Color)?.value ?? 0xFFFFFF;
		const highlight = this.preset === 'spotlight' ? baseColor : colors?.[0] ?? EMPHASIS[this.preset];
		const fontSize = entity.get(TextStyle)?.fontSize ?? BRIDGECLIP_STYLES[this.preset].fontSize;
		const active = group.findIndex(w => this.currentTime >= w.start && this.currentTime < w.end);
		const pop = this.preset === 'boxed' || this.preset === 'spotlight';
		const groupAge = this.currentTime - group[0]!.start;
		const groupEnd = Math.min(group.at(-1)!.end + CUE_LINGER, this.groups[this.currentGroup + 1]?.[0]?.start ?? Infinity);
		const cueOpacity = Math.min(smooth(groupAge / 0.075), smooth((groupEnd - this.currentTime) / 0.07));
		for (const { range, word } of this.ranges) {
			const amount = word === active ? smooth((this.currentTime - group[word]!.start) / 0.075) : 0;
			const color = mixColor(baseColor, highlight, amount);
			// These are decoder-owned ephemeral ranges, never authored props. One
			// intrinsic glyph pass keeps 55% opacity at 55%, without a second fill.
			store(world, Color).value[range.id()] = color;
			store(world, Computed).color[range.id()] = color;
		}
		const wordFor = (token: Token) => this.ranges.find(({ range }) => token.ranges.includes(range))?.word ?? -1;
		const effects = (token: Token) => {
			const i = wordFor(token);
			const word = group[i];
			const age = word ? this.currentTime - word.start : 1;
			const dim = this.preset === 'subtle' ? 0.55 : this.preset === 'editorial' ? 0.6 : 1;
			return { opacity: cueOpacity * (dim + (1 - dim) * smooth(age / 0.08)), scale: pop && i === active ? bridgeClipPop(age) : 1 };
		};
		renderText(world, entity, {
			tokenEffect: effects,
			beforeDraw: (ctx, lines) => {
				if (this.preset === 'boxed') {
					ctx.fillStyle = colorToHex(colors?.[1] ?? 0x000000);
					ctx.globalAlpha *= 0.62 * cueOpacity;
					for (const line of lines) {
						const ink = line.filter(t => t.chars.trim());
						if (!ink.length) continue;
						const l = Math.min(...ink.map(t => t.left)), r = Math.max(...ink.map(t => t.right));
						const t = Math.min(...ink.map(t => t.top)), b = Math.max(...ink.map(t => t.bottom));
						const pad = fontSize * 0.28;
						ctx.beginPath(); ctx.roundRect(l - pad, t - pad * 0.7, r - l + pad * 2, b - t + pad * 1.4, fontSize * 0.16); ctx.fill();
					}
				} else if (this.preset === 'spotlight' && active >= 0) {
					ctx.fillStyle = colorToHex(colors?.[0] ?? 0x7C5CFF);
					ctx.globalAlpha *= cueOpacity;
					for (const token of lines.flat().filter(t => wordFor(t) === active)) {
						const scale = effects(token).scale;
						const x = (token.left + token.right) / 2, y = (token.top + token.bottom) / 2;
						const w = (token.right - token.left + fontSize * 0.42) * scale;
						const h = (token.bottom - token.top + fontSize * 0.28) * scale;
						ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, fontSize * 0.2); ctx.fill();
					}
				}
			},
		});
	}

	public dispose(): void { this.groups = []; this.ranges = []; this.currentGroup = -1; }
}
