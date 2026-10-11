/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { Input, ALL_FORMATS, BlobSource, AudioBufferSink, type WrappedAudioBuffer, type InputAudioTrack } from 'mediabunny';

import { AssetId, AudioDecoderHandle } from '../traits';
import { AsyncMutex } from '../utils/async';
import { assert } from '../utils/assert';
import { getAsset, getAssetFile } from '../actions/assets';
import { TimeStretcher } from './time-stretcher';
import { WeakAsyncCache } from '../utils/weak-async-cache';

import type { Entity, World } from 'koota';
import type { AudioAsset, VideoAsset } from '@diffusionstudio/assets';
import type { AudioBus } from './audio-bus';

const audioTrackCache = new WeakAsyncCache<AudioAsset | VideoAsset, InputAudioTrack | null>();

export function clearAudioTrackCache() {
	audioTrackCache.clear();
}

/**
 * Share an Input while the library's asset is alive. A global ID map would
 * retain every opened project's file and could reuse another project's handle.
 */
export function getAudioTrack(source: AudioAsset | VideoAsset) {
	return audioTrackCache.get(source, async () => {
		let input: Input | undefined;
		try {
			const blob = await getAssetFile(source);
			input = new Input({
				formats: ALL_FORMATS,
				source: new BlobSource(blob),
			});
			const track = await input.getPrimaryAudioTrack();
			if (!track) input.dispose();
			return track;
		} catch (error) {
			input?.dispose();
			throw error;
		}
	}).catch(() => null);
}

type PlayOptions = {
	relativeFrom: number;
	relativeTo: number;
	trimStart: number;
	trimEnd: number;
	playbackRate: number;
	currentTime: number;
	relativeDelay: number;
}

export class AudioDecoder {
	readonly assetId: string;

	private readonly asset: AudioAsset | VideoAsset;
	private readonly mutex = new AsyncMutex();
	private readonly audioNodes = new Set<AudioBufferSourceNode>();

	private iterator: AsyncGenerator<WrappedAudioBuffer, void, unknown> | null = null;
	private firstBuffer: WrappedAudioBuffer | null = null;
	private lastBuffer: WrappedAudioBuffer | null = null;
	private stretcher: TimeStretcher | null = null;
	private nextTimestamp = 0;
	private audioTrack: InputAudioTrack | null = null;
	private sink: AudioBufferSink | null = null;
	private generation = 0;
	private disposed = false;

	public ready = false;

	public constructor(asset: AudioAsset | VideoAsset) {
		this.asset = asset;
		this.assetId = asset.id;
	}

	public async init() {
		const track = await getAudioTrack(this.asset);
		if (this.disposed) return;
		this.audioTrack = track;
		assert(this.audioTrack, 'Audio track not found');
		this.sink = new AudioBufferSink(this.audioTrack);
		this.ready = true;
	}

	private renderData(bus: AudioBus, options: PlayOptions, data: Float32Array[] | null, sampleRate: number) {
		if (!data) {
			return;
		}

		const { relativeDelay, playbackRate } = options;

		const trimStart = options.trimStart / playbackRate;
		const trimEnd = options.trimEnd / playbackRate;
		const context = bus.context;
		const input = bus.input;

		const newBuffer = new AudioBuffer({
			length: data[0]!.length,
			sampleRate,
			numberOfChannels: data.length,
		});
		for (let c = 0; c < data.length; c++) {
			newBuffer.copyToChannel(data[c] as Float32Array<ArrayBuffer>, c);
		}

		const newBufferTimestamp = this.nextTimestamp;
		this.nextTimestamp += newBuffer.duration;

		let start = relativeDelay + newBufferTimestamp;
		let offset = 0;
		let duration = newBuffer.duration;

		// Check if the buffer goes beyond the clip's end, and if so, truncate it
		if (newBufferTimestamp + duration > trimEnd) {
			duration = trimEnd - newBufferTimestamp;
		}

		// Check if the buffer starts before the clip's start, and if so, trim the start
		if (newBufferTimestamp < trimStart) {
			start += trimStart - newBufferTimestamp;
			offset += trimStart - newBufferTimestamp;
		}

		// Check if the start is before the context's current time (which is illegal)
		if (start < context.currentTime) {
			offset += context.currentTime - start;
			start = context.currentTime;
		}

		// Dumb, DIRTY hack. For some reason (probably due to some bug in the Web Audio API), sometimes a clicking noise
		// can be heard on the boundary between two audio clips. By shifting all audio buffers by half a sample, this is
		// typically avoided. My guess is that it forces the renderer into a sub-sample rendering algorithm which doesn't
		// have the buggy behavior.
		start += 0.5 / context.sampleRate;

		duration -= offset;
		duration = Math.max(0, duration);

		const bufferSource = context.createBufferSource();
		bufferSource.buffer = newBuffer;
		bufferSource.connect(input);
		bufferSource.start(start, offset, duration);

		this.audioNodes.add(bufferSource);
		bufferSource.onended = () => {
			this.audioNodes.delete(bufferSource);
			bufferSource.disconnect();
		};
	}

	public async playTo(bus: AudioBus | null, options: PlayOptions) {
		if (!this.asset.channels || !this.asset.sampleRate || !bus) {
			// Asset has no audio data
			return;
		}

		const { relativeFrom, relativeTo } = options;

		const generation = this.generation;
		const release = await this.mutex.acquire();

		const firstTs = this.firstBuffer?.timestamp ?? Number.POSITIVE_INFINITY;
		const lastTs = this.lastBuffer?.timestamp ?? Number.NEGATIVE_INFINITY;
		const isBufferOutOfRange = relativeFrom < firstTs || lastTs < relativeFrom - 1;

		try {
			if (this.disposed || generation !== this.generation || !this.ready || !this.sink) return;
			if (this.iterator == null || this.stretcher == null || isBufferOutOfRange) {
				// Close the previous iterator so its pre-decoded AudioSamples get released.
				await this.iterator?.return();
				if (generation !== this.generation) return;
				this.iterator = this.sink.buffers(relativeFrom);
				this.firstBuffer = null;
				this.lastBuffer = null;
				this.stretcher = null;
			}

			while (true) {
				const nextBuffer = (await this.iterator.next()).value;
				if (generation !== this.generation) return;
				// Use the actual decoded sample rate if available
				const sampleRate = nextBuffer?.buffer.sampleRate ?? this.asset.sampleRate;
				const numberOfChannels = nextBuffer?.buffer.numberOfChannels ?? this.asset.channels;
				const playbackRate = 1 / options.playbackRate;

				this.stretcher ??= new TimeStretcher(numberOfChannels, sampleRate, playbackRate);

				if (!nextBuffer) {
					this.renderData(bus, options, this.stretcher.finalize(), sampleRate);
					break;
				}

				if (!this.firstBuffer) {
					this.nextTimestamp = nextBuffer.timestamp / options.playbackRate;
				}

				if (this.lastBuffer) {
					const sampleGap = Math.round(
						nextBuffer.timestamp - (this.lastBuffer.timestamp + this.lastBuffer.duration)
					);

					if (sampleGap > 0) {
						this.renderData(
							bus,
							options,
							Array(numberOfChannels).fill(new Float32Array(sampleGap)),
							sampleRate
						);
					}
				}

				this.firstBuffer ??= nextBuffer;
				this.lastBuffer = nextBuffer;

				const buffers: Float32Array[] = [];
				for (let c = 0; c < nextBuffer.buffer.numberOfChannels; c++) {
					const channelData = nextBuffer.buffer.getChannelData(c);
					buffers.push(channelData);
				}

				// TODO: Handle gap in timestamps case

				this.renderData(bus, options, this.stretcher.append(buffers), sampleRate);

				if (nextBuffer.timestamp >= relativeTo) {
					break;
				}
			}
		} finally {
			release();
		}
	}

	public reset() {
		this.generation++;
		void this.iterator?.return().catch(() => {});
		this.iterator = null;
		this.firstBuffer = null;
		this.lastBuffer = null;
		this.stretcher = null;
		this.nextTimestamp = 0;

		for (const node of this.audioNodes) {
			node.onended = null;
			try { node.stop(); } catch { /* already ended */ }
			node.disconnect();
		}
		this.audioNodes.clear();
	}

	public dispose() {
		if (this.disposed) return;
		this.disposed = true;
		this.reset();
		this.ready = false;
		this.audioTrack = null;
		this.sink = null;
	}
}


type ResolvedAudioDecoder = {
	decoder: AudioDecoder;
	initPromise: Promise<void> | null;
};

export function resolveAudioDecoder(world: World, entity: Entity): ResolvedAudioDecoder | null {
	const assetId = entity.get(AssetId)?.value;
	if (!assetId) return null;

	const existing = entity.get(AudioDecoderHandle);
	if (existing && existing.assetId === assetId) {
		return {
			decoder: existing,
			initPromise: null,
		};
	}

	// Asset changed: reset old decoder and create a new one.
	if (existing) existing.dispose();

	const asset = getAsset(world, assetId);
	if (!asset || (asset.type !== 'AUDIO' && asset.type !== 'VIDEO')) return null;
	if (asset.type === 'VIDEO' && !asset.channels) return null;

	const decoder = new AudioDecoder(asset);
	entity.add(AudioDecoderHandle);
	entity.set(AudioDecoderHandle, decoder);
	return {
		decoder,
		initPromise: decoder.init(),
	};
}
