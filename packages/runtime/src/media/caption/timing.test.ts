import { describe, expect, it } from 'vitest';
import { createRuntimeWorld } from '../../world/create-world';
import { createEntity } from '../../actions/entities';
import { appendChild } from '../../actions/hierarchy';
import { setPlayhead } from '../../actions/playback';
import { playbackSystem } from '../../systems/playback';
import { GeometryType } from '../../constants';
import {
	AssetId, Caption, CaptionDecoderHandle, Chars, ChildOf, Computed,
	Delay, FrameRate, Geometry, Mode, Playback, PlaybackRate, Root, Scene,
	TextRange, Trim,
	Color, Paint,
} from '../../traits';
import { ClassicCaptionDecoder } from './classic';
import { CascadeCaptionDecoder } from './cascade';
import { SpotlightCaptionDecoder } from './spotlight';
import { WhisperCaptionDecoder } from './whisper';
import { PaperCaptionDecoder } from './paper';
import { GuineaCaptionDecoder } from './guinea';
import { StarkCaptionDecoder } from './stark';
import { findActiveGroup } from './utils';
import type { Asset, Transcript, WordGroup } from '@diffusionstudio/assets';
import type { CaptionDecoder } from './types';

const groups: WordGroup[] = [
	[{ text: 'uno', start: 0, end: 1 }],
	[{ text: 'dos', start: 1, end: 2 }],
	[{ text: 'tres', start: 3, end: 4 }],
];
const transcript: Transcript = groups.map(words => ({ text: words[0]!.text, words }));
const presets = [
	['classic', ClassicCaptionDecoder], ['cascade', CascadeCaptionDecoder],
	['spotlight', SpotlightCaptionDecoder], ['whisper', WhisperCaptionDecoder],
	['paper', PaperCaptionDecoder], ['guinea', GuineaCaptionDecoder],
	['stark', StarkCaptionDecoder],
] as const;

function assetWithTranscript(words: Transcript): Asset {
	return {
		id: 'caption-timing-fixture', type: 'AUDIO', path: 'fixture.wav',
		source: 'assets/fixture.wav', createdAt: '2026-10-04T00:00:00.000Z',
		mimeType: 'audio/wav', duration: 5, sampleRate: 48000, channels: 1,
		transcript: words,
		handle: { getFile: async () => { throw Error('Metadata tests must not read media files'); } },
	};
}

async function metadataFixture(
	Decoder: new (asset: Asset) => CaptionDecoder,
	words: Transcript = transcript,
	fps = 30,
) {
	const world = createRuntimeWorld('caption-timing-test');
	world.set(FrameRate, { value: fps });
	world.set(Mode, { value: 'offline-video' });
	const scene = createEntity(world);
	scene.add(Geometry({ value: GeometryType.RECT }), Scene, Playback);
	appendChild(world, scene, world.get(Root)!);
	const caption = createEntity(world);
	caption.add(Geometry({ value: GeometryType.TEXT }), Caption, AssetId({ value: 'caption-timing-fixture' }));
	appendChild(world, caption, scene);
	caption.add(Trim({ start: 0, end: 5 * fps }));
	const decoder = new Decoder(assetWithTranscript(words));
	await decoder.initPromise;
	// Font loading and canvas painting are outside these real playback metadata frames.
	decoder.styled = true;
	caption.set(Caption, { type: decoder.type });
	caption.add(CaptionDecoderHandle(decoder));
	return {
		world, caption,
		frame: (frame: number) => {
			setPlayhead(world, scene, frame);
			playbackSystem(world);
			return {
				text: caption.get(Chars)?.value ?? '',
				localFrame: caption.get(Computed)?.localTime,
				visible: caption.get(Computed)?.visibility,
				ranges: world.query(ChildOf(caption), TextRange).map(range => range.get(TextRange)),
			};
		},
	};
}

describe('caption group intervals', () => {
	it.each([24, 30, 60])('changes groups on the boundary frame at %i fps', fps => {
		expect(findActiveGroup(groups, (fps - 1) / fps)).toBe(0);
		expect(findActiveGroup(groups, fps / fps)).toBe(1);
		expect(findActiveGroup(groups, (fps + 1) / fps)).toBe(1);
	});
	it('includes starts, excludes ends and leaves gaps empty', () => {
		for (const [time, expected] of [[-1, -1], [0, 0], [2, -1], [2.5, -1], [3, 2], [4, -1], [5, -1]]) {
			expect(findActiveGroup(groups, time!)).toBe(expected);
		}
		expect(findActiveGroup([], 0)).toBe(-1);
	});
	it('does not show a zero-duration group at its timestamp', () => {
		expect(findActiveGroup([[{ text: 'empty', start: 1, end: 1 }], ...groups.slice(1)], 1)).toBe(1);
	});
});

describe('caption runtime metadata frames', () => {
	it('Stark still renders decoder text after a preset reset left an empty render mirror', async () => {
		const fixture = await metadataFixture(StarkCaptionDecoder);
		try {
			fixture.caption.set(Computed, { chars: '' });
			fixture.frame(29);
			expect(fixture.caption.get(Computed)?.chars).toBe('uno');
			fixture.frame(60);
			expect(fixture.caption.get(Computed)?.chars).toBe('');
			fixture.frame(30);
			expect(fixture.caption.get(Computed)?.chars).toBe('dos');
		} finally { fixture.world.destroy(); }
	});
	it.each(presets)('%s switches, clears and can seek backwards at exact group boundaries', async (_name, Decoder) => {
		const fixture = await metadataFixture(Decoder);
		try {
			for (const [frame, text] of [[29, 'uno'], [30, 'dos'], [31, 'dos'], [60, ''], [75, ''], [90, 'tres'], [119, 'tres'], [120, ''], [30, 'dos']] as const) {
				expect(fixture.frame(frame)).toMatchObject({ localFrame: frame, visible: 1, text });
			}
		} finally { fixture.world.destroy(); }
	});
	it('uses the caption source clock after trim, offset and rate at 60 fps', async () => {
		const fixture = await metadataFixture(ClassicCaptionDecoder, transcript, 60);
		try {
			fixture.caption.add(PlaybackRate({ value: 2 }), Delay({ value: 30 }));
			fixture.caption.set(Trim, { start: 60, end: 240 });
			expect(fixture.frame(59)).toMatchObject({ localFrame: 58, visible: 0, text: 'uno' });
			expect(fixture.frame(60)).toMatchObject({ localFrame: 60, visible: 1, text: 'dos' });
			expect(fixture.frame(90)).toMatchObject({ localFrame: 120, visible: 1, text: '' });
			expect(fixture.frame(120)).toMatchObject({ localFrame: 180, visible: 1, text: 'tres' });
			expect(fixture.frame(150)).toMatchObject({ localFrame: 240, visible: 0, text: '' });
		} finally { fixture.world.destroy(); }
	});
	it('Spotlight highlights the next word on its shared boundary and clears at the final end', async () => {
		const fixture = await metadataFixture(SpotlightCaptionDecoder, [{ text: 'uno dos', words: groups.slice(0, 2).flat() }]);
		try {
			expect(fixture.frame(29)).toMatchObject({ text: 'uno dos', ranges: [{ start: 0, end: 3 }] });
			expect(fixture.frame(30)).toMatchObject({ text: 'uno dos', ranges: [{ start: 3, end: 7 }] });
			expect(fixture.frame(60)).toMatchObject({ text: '', ranges: [] });
		} finally { fixture.world.destroy(); }
	});
	it('Spotlight keeps group text but clears highlighting during a gap between words', async () => {
		const fixture = await metadataFixture(SpotlightCaptionDecoder, [{ text: 'uno dos', words: [
			{ text: 'uno', start: 0, end: 0.8 }, { text: 'dos', start: 1.2, end: 2 },
		] }]);
		try {
			expect(fixture.frame(23).ranges).toEqual([{ start: 0, end: 3 }]);
			expect(fixture.frame(24)).toMatchObject({ text: 'uno dos', ranges: [] });
			expect(fixture.frame(30)).toMatchObject({ text: 'uno dos', ranges: [] });
			expect(fixture.frame(36)).toMatchObject({ text: 'uno dos', ranges: [{ start: 3, end: 7 }] });
		} finally { fixture.world.destroy(); }
	});
	it('Guinea keeps its highlight color when revisiting the same cue', async () => {
		const fixture = await metadataFixture(GuineaCaptionDecoder, [{ text: 'uno dos tres', words: [
			{ text: 'uno', start: 0, end: 0.7 }, { text: 'dos', start: 0.7, end: 1.4 },
			{ text: 'tres', start: 1.4, end: 2.1 },
		] }]);
		try {
			const colorAt = (frame: number) => {
				fixture.frame(frame);
				fixture.caption.get(CaptionDecoderHandle)!.draw(fixture.world, fixture.caption);
				return fixture.world.query(Paint, Color).map(e => e.get(Color)?.value);
			};
			const before = colorAt(5);
			colorAt(50);
			expect(colorAt(5)).toEqual(before);
		} finally { fixture.world.destroy(); }
	});
});
