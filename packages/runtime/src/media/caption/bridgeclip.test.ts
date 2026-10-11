import { describe, expect, it } from 'vitest';
import { bridgeClipCueAt, bridgeClipGroups, bridgeClipPop, BridgeClipCaptionDecoder, BRIDGECLIP_STYLES } from './bridgeclip';
import { createRuntimeWorld } from '../../world/create-world';
import { createEntity } from '../../actions/entities';
import { Chars, ChildOf, TextRange } from '../../traits';
import type { Asset, Transcript } from '@diffusionstudio/assets';

const transcript: Transcript = [{ text: 'Esta prueba sigue. Otra frase.', words: [
	{ text: 'Esta', start: 0, end: 0.3 }, { text: 'prueba', start: 0.3, end: 0.8 },
	{ text: 'sigue.', start: 0.8, end: 1.4 }, { text: 'Otra', start: 2.5, end: 2.8 },
	{ text: 'frase.', start: 2.8, end: 3.2 },
] }];
const asset = { id: 'bridgeclip-test', type: 'AUDIO', transcript } as Asset;

describe('BridgeClip native captions', () => {
	it('keeps original word references and splits sentences, maximum count and pauses', () => {
		const result = bridgeClipGroups(transcript, 2);
		expect(result.map(g => g.map(w => w.text))).toEqual([['Esta', 'prueba'], ['sigue.'], ['Otra', 'frase.']]);
		expect(result.flat()).toEqual(transcript[0]!.words);
		expect(result[0]![0]).toBe(transcript[0]!.words[0]);
	});
	it('holds a completed phrase at most 700 ms without overlapping the next one', () => {
		const groups = bridgeClipGroups(transcript, 4);
		expect(bridgeClipCueAt(groups, 1.5)).toBe(0);
		expect(bridgeClipCueAt(groups, 2.11)).toBe(-1);
		expect(bridgeClipCueAt(groups, 2.5)).toBe(1);
		expect(bridgeClipCueAt(groups, 3.91)).toBe(-1);
		const adjacent = [[{text:'uno',start:0,end:1}], [{text:'dos',start:1.1,end:2}]];
		expect(bridgeClipCueAt(adjacent, 1.09)).toBe(0);
		expect(bridgeClipCueAt(adjacent, 1.1)).toBe(1);
	});
	it.each(['subtle', 'editorial', 'boxed', 'spotlight'] as const)('%s clears ranges in silence and recreates exactly the same words after backwards seeks', async preset => {
		const world = createRuntimeWorld('bridgeclip-test');
		const entity = createEntity(world);
		const decoder = new BridgeClipCaptionDecoder(asset, preset);
		await decoder.initPromise;
		try {
			decoder.seekTo(world, entity, 0.5);
			const read = () => ({text: entity.get(Chars)?.value, ranges: world.query(ChildOf(entity), TextRange).map(r => r.get(TextRange))});
			const before = read();
			expect(before.text).toBe('Esta prueba sigue.');
			decoder.seekTo(world, entity, 2.2);
			expect(read()).toEqual({text:'', ranges:[]});
			decoder.seekTo(world, entity, 3);
			expect(read().text).toBe('Otra frase.');
			decoder.seekTo(world, entity, 0.5);
			expect(read()).toEqual(before);
		} finally { decoder.dispose(); world.destroy(); }
	});
	it('uses an absolute-time pop and keeps quiet styles sentence case', () => {
		expect(bridgeClipPop(0)).toBe(0.82);
		expect(bridgeClipPop(0.09)).toBe(1.06);
		expect(bridgeClipPop(0.17)).toBe(1);
		expect(bridgeClipPop(8)).toBe(1);
		expect(BRIDGECLIP_STYLES.editorial.fontFamily).toBe('Instrument Serif');
	});
});
