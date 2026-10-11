import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWorld } from 'koota';
import { FontStyle } from '../../../packages/runtime/src/constants';
import { Fonts, FramePromises, TextStyle } from '../../../packages/runtime/src/traits';
import { loadWebFont, registerFontSources, fontSystem } from '../../../packages/runtime/src/fonts/utils';
import { resolverSystem } from '../../../packages/encoder/src/encoder';
import type { World } from 'koota';

// The encoder imports its renderer barrel, whose identity matrix is created
// on import. No canvas/matrix operations run in these readiness tests.
vi.hoisted(() => vi.stubGlobal('DOMMatrix', class {}));

class ControlledFontFace {
	static faces: ControlledFontFace[] = [];
	static failConstruction = false;
	readonly loaded: Promise<FontFace>;
	resolve!: (face: FontFace) => void;
	reject!: (error: Error) => void;
	load = vi.fn(() => this.loaded);
	constructor(
		readonly family: string,
		readonly source: string,
		readonly descriptors: FontFaceDescriptors,
	) {
		if (ControlledFontFace.failConstruction) throw Error('Invalid font descriptor');
		this.loaded = new Promise((resolve, reject) => { this.resolve = resolve; this.reject = reject; });
		ControlledFontFace.faces.push(this);
	}
	finish() { this.resolve(this as unknown as FontFace); }
}

let worlds: World[] = [];
const add = vi.fn();
function fontWorld(offline = false) {
	const world = createWorld(Fonts, FramePromises({ list: offline ? [] : null }));
	worlds.push(world);
	return world;
}
async function requestedFaces() {
	await Promise.resolve();
	return ControlledFontFace.faces;
}
beforeEach(() => {
  registerFontSources([]);
	ControlledFontFace.faces = [];
	ControlledFontFace.failConstruction = false;
	add.mockReset();
	vi.stubGlobal('FontFace', ControlledFontFace);
	vi.stubGlobal('document', { fonts: { add } });
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
	for (const world of worlds) world.destroy();
	worlds = [];
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('web font operations', () => {
  it('loads distinct real files for imported static weights and authored JSX waits for them', async () => {
    registerFontSources([{ family: 'Imported Fixture', variants: [
      { family: 'Imported Fixture', source: 'url(regular.ttf)', weight: '400', style: FontStyle.NORMAL },
      { family: 'Imported Fixture', source: 'url(bold.ttf)', weight: '700', style: FontStyle.NORMAL },
    ] }]);
    const world = fontWorld(true);
    world.spawn(TextStyle({ fontFamily: 'Imported Fixture', fontWeight: '700', fontStyle: FontStyle.NORMAL }));
    fontSystem(world);
    const [face] = await requestedFaces();
    expect(face!.source).toBe('url(bold.ttf)');
    expect(face!.descriptors.weight).toBe('700');
    const barrier = resolverSystem(world);
    face!.finish(); await barrier;
    const regular = loadWebFont(world, 'Imported Fixture', FontStyle.NORMAL, '400');
    const second = (await requestedFaces()).at(-1)!;
    expect(second.source).toBe('url(regular.ttf)');
    second.finish(); await regular;
    expect(world.get(Fonts)!.list.map(f => f.weight)).toEqual(['700', '400']);
  });
	it('shares the pending promise and keeps both callers waiting for the same load', async () => {
		const world = fontWorld();
		const first = loadWebFont(world, 'Urbanist', FontStyle.NORMAL, '400');
		const second = loadWebFont(world, 'Urbanist', FontStyle.NORMAL, '400');
		expect(first).toBe(second);
		let complete = false;
		void second.then(() => { complete = true; });
		const [face] = await requestedFaces();
		expect(ControlledFontFace.faces).toHaveLength(1);
		expect(face!.load).toHaveBeenCalledOnce();
		expect(complete).toBe(false);
		expect(world.get(Fonts)?.list).toEqual([]);
		face!.finish();
		const [a, b] = await Promise.all([first, second]);
		expect(a).toBe(b);
		expect(complete).toBe(true);
		expect(world.get(Fonts)?.list).toEqual([a]);
		expect(add).toHaveBeenCalledOnce();
		await expect(loadWebFont(world, 'Urbanist', FontStyle.NORMAL, '400')).resolves.toBe(a);
		expect(ControlledFontFace.faces).toHaveLength(1);
	});
	it('a failed family preserves another family at the same weight and allows retry', async () => {
		const world = fontWorld();
		const urbanist = loadWebFont(world, 'Urbanist', FontStyle.NORMAL, '400');
		const inter = loadWebFont(world, 'Inter', FontStyle.NORMAL, '400');
		const heavier = loadWebFont(world, 'Urbanist', FontStyle.NORMAL, '600');
		const [badFace, otherFace, heavierFace] = await requestedFaces();
		otherFace!.finish(); heavierFace!.finish();
		const preserved = await Promise.all([inter, heavier]);
		const error = Error('Font unavailable');
		badFace!.reject(error);
		await expect(urbanist).rejects.toBe(error);
		expect(world.get(Fonts)?.list).toEqual(preserved);
		const retry = loadWebFont(world, 'Urbanist', FontStyle.NORMAL, '400');
		expect(retry).not.toBe(urbanist);
		const retryFace = (await requestedFaces()).at(-1)!;
		retryFace.finish();
		await expect(retry).resolves.toMatchObject({ family: 'Urbanist', weight: '400' });
		expect(world.get(Fonts)?.list).toHaveLength(3);
	});
	it('tracks style independently and a normal failure preserves the italic variant', async () => {
		const world = fontWorld();
		const normal = loadWebFont(world, 'Inter', FontStyle.NORMAL, '400');
		const italic = loadWebFont(world, 'Inter', FontStyle.ITALIC, '400');
		const [normalFace, italicFace] = await requestedFaces();
		expect(italicFace!.descriptors.style).toBe('italic');
		italicFace!.finish();
		const loaded = await italic;
		normalFace!.reject(Error('Normal failed'));
		await expect(normal).rejects.toThrow('Normal failed');
		expect(world.get(Fonts)?.list).toEqual([loaded]);
	});
	it('turns constructor failure into a rejecting promise without leaving stale state', async () => {
		const world = fontWorld();
		ControlledFontFace.failConstruction = true;
		await expect(loadWebFont(world, 'Urbanist')).rejects.toThrow('Invalid font descriptor');
		expect(world.get(Fonts)?.list).toEqual([]);
		ControlledFontFace.failConstruction = false;
		const retry = loadWebFont(world, 'Urbanist');
		const face = (await requestedFaces()).at(-1)!;
		expect(face.descriptors.weight).toBe('100 900');
		face.finish(); await retry;
	});
	it('observes fire-and-forget failures while preserving rejection for awaited callers', async () => {
		const world = fontWorld();
		void loadWebFont(world, 'Urbanist');
		const [face] = await requestedFaces();
		face!.reject(Error('Offline'));
		await vi.waitFor(() => expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Urbanist'), expect.any(Error)));
		expect(world.get(Fonts)?.list).toEqual([]);
	});
	it('adds worker-loaded fonts to the worker FontFaceSet', async () => {
		vi.stubGlobal('document', undefined);
		vi.stubGlobal('fonts', { add });
		const loading = loadWebFont(fontWorld(), 'Bangers');
		const [face] = await requestedFaces();
		face!.finish(); await loading;
		expect(add).toHaveBeenCalledWith(face);
	});
	it('still waits for FontFace.load when the host has no FontFaceSet', async () => {
		vi.stubGlobal('document', undefined);
		vi.stubGlobal('fonts', undefined);
		const world = fontWorld();
		const loading = loadWebFont(world, 'Bangers');
		const [face] = await requestedFaces();
		expect(face!.load).toHaveBeenCalledOnce();
		expect(world.get(Fonts)?.list).toEqual([]);
		face!.finish(); await loading;
		expect(world.get(Fonts)?.list).toHaveLength(1);
		expect(add).not.toHaveBeenCalled();
	});
});

describe('offline font readiness', () => {
	it('the real capture resolver waits for the font before the first frame', async () => {
		const world = fontWorld(true);
		const loading = loadWebFont(world, 'Urbanist');
		expect(loadWebFont(world, 'Urbanist')).toBe(loading);
		expect(world.get(FramePromises)?.list).toEqual([loading]);
		let sampled = false;
		const firstFrame = resolverSystem(world).then(() => { sampled = true; });
		const [face] = await requestedFaces();
		expect(sampled).toBe(false);
		face!.finish(); await firstFrame;
		expect(sampled).toBe(true);
		expect(world.get(FramePromises)?.list).toEqual([]);
	});
	it('a failed font rejects capture promptly even while another font is still pending', async () => {
		const world = fontWorld(true);
		void loadWebFont(world, 'Urbanist');
		const other = loadWebFont(world, 'Inter');
		const capture = resolverSystem(world);
		const [badFace, pendingFace] = await requestedFaces();
		const error = Error('Font unavailable');
		badFace!.reject(error);
		await expect(capture).rejects.toBe(error);
		expect(world.get(Fonts)?.list).toEqual([]);
		pendingFace!.finish(); await other;
	});
	it('a capture copying editor fonts cannot mistake an unfinished load for a loaded font', async () => {
		const editor = fontWorld();
		const editorFont = loadWebFont(editor, 'Urbanist');
		const capture = fontWorld(true);
		capture.set(Fonts, { list: [...editor.get(Fonts)!.list] });
		const captureFont = loadWebFont(capture, 'Urbanist');
		expect(captureFont).not.toBe(editorFont);
		const resolver = resolverSystem(capture);
		const [editorFace, captureFace] = await requestedFaces();
		expect(ControlledFontFace.faces).toHaveLength(2);
		editorFace!.finish(); await editorFont;
		expect(capture.get(Fonts)?.list).toEqual([]);
		captureFace!.finish(); await resolver;
		expect(capture.get(Fonts)?.list).toHaveLength(1);
	});
});
