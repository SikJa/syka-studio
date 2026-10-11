/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { SceneView, Scene, Source, Selected, Culled, Playback, Tickers, getEntityTree, getEntityChildren, Group, Root, focusEntities, setActive, getActiveEntity, assetSystem, renderSystem, transformSystem, playbackSystem, motionSystem, AudioEngine, createRuntimeWorld, Geometry, Mode, RenderSurface, Time, ChildOf, syncInteractiveState } from '@diffusionstudio/runtime';
import { hudSystem } from './hud';
import { createSignal, type Accessor, type Setter } from 'solid-js';
import { AssetSelection, CameraNavigation, Hud, Keys, MODIFIER_KEYS, ObjectMaskTool, Pointer, PointerEvents, ProjectConfig, SnapLines } from './traits';
import { inputSystem } from './input/input-system';
import { clearClipFrames, clearClipPeaks, clearMedia, clearPeaks, timelineSystem, TimelineSurface } from './timeline';
import { clearObjectTrackOf, clearObjectTracks } from './object-mask';
import { shortcutSystem } from './input/shortcuts';
import { initializeFontCatalog } from './fonts';
import { PreviewFramePacer } from './preview-frame-pacer';

import type { RuntimeWorld } from '@diffusionstudio/runtime';
import type { CanvasPointerEvent, PointerEventType } from '@diffusionstudio/runtime';

export interface EngineOptions {
  /** Internal visual reviews own no live audio output. */
  silent?: boolean;
	/**
	 * Inject an existing AudioContext (e.g. shared across projects). When
	 * omitted, the engine creates and owns one; it is closed on dispose().
	 */
	audioContext?: AudioContext;
}

class Engine {
	readonly world: RuntimeWorld;

	private canvas: HTMLCanvasElement | null = null;
	private canvasPointerId: number | null = null;
	private rafId: number | null = null;
	private lastTimestamp: number | null = null;
	private readonly framePacer = new PreviewFramePacer();
	private resizeObserver = new ResizeObserver(this.resize.bind(this));

	private readonly audioContext: AudioContext | undefined;
	private readonly ownsAudioContext: boolean;

	private unsubscribe: (() => void)[] = [];
	private interactiveDirty = true;

	public running: Accessor<boolean>;
	private setRunning: Setter<boolean>;

	/**
	 * Ticks once per frame, after the systems ran. The one signal derived
	 * state is sampled against (see `useDerived`); a plain Solid signal, so
	 * following the tick costs no koota subscription.
	 */
	public frame: Accessor<number>;
	private setFrame: Setter<number>;

	public constructor(projectId: string, options: EngineOptions = {}) {
		this.world = createRuntimeWorld(projectId);
		void initializeFontCatalog();
		this.world.add(Pointer, Keys, SnapLines, Hud, ObjectMaskTool, PointerEvents, AssetSelection, CameraNavigation, ProjectConfig, TimelineSurface, SceneView);

		this.unsubscribe.push(
			this.world.onAdd(ChildOf('*'), () => (this.interactiveDirty = true)),
			this.world.onRemove(ChildOf('*'), () => (this.interactiveDirty = true)),
			// The timeline keeps a clip's waveform and thumbnails by entity id,
			// and koota hands ids back out: a clip that is gone has to take its
			// pictures with it, or the next clip to be given its id inherits them.
			this.world.onRemove(Geometry, (entity) => {
				clearClipPeaks(entity.id());
				clearClipFrames(entity.id());
				clearObjectTrackOf(entity);
			}),
		);

		[this.running, this.setRunning] = createSignal(false);
		[this.frame, this.setFrame] = createSignal(0);

		this.ownsAudioContext = !options.silent && options.audioContext === undefined;
		this.audioContext = options.silent ? undefined : options.audioContext ?? new AudioContext({ latencyHint: 'playback' });
		this.world.set(AudioEngine, { context: this.audioContext ?? null });
	}

	private readonly onClick = (event: MouseEvent) => {
		this.addEvent('click', event);
	}

	private readonly onDoubleClick = (event: MouseEvent) => {
		this.addEvent('dblclick', event)
	}

	private readonly onPointerDown = (event: PointerEvent) => {
		this.canvasPointerId = event.pointerId;
		this.addEvent('pointerdown', event)
	}

	private readonly onPointerMove = (event: PointerEvent) => {
		this.addEvent('pointermove', event)
	}

	private readonly onPointerUp = (event: PointerEvent) => {
		// Window receives releases from inspector popovers and the library too.
		// Only finish gestures that actually started on this engine's canvas.
		if (this.canvasPointerId !== event.pointerId) return;
		this.canvasPointerId = null;
		this.addEvent('pointerup', event)
	}

	/**
	 * Whether the pointer is on the stage, which a shortcut reads to tell a
	 * press that could start a canvas gesture from one that could not.
	 */
	private readonly onPointerEnter = () => {
		this.world.set(Pointer, { over: true });
	}

	private readonly onPointerLeave = () => {
		this.world.set(Pointer, { over: false });
	}

	private readonly onBlur = () => {
		// Key-up never arrives when focus leaves mid-hold (⌘-tab, devtools).
		this.world.get(Keys)!.held.clear();
	}

	private readonly onActivity = (event: Event) => {
		if (event instanceof PointerEvent && event.type === 'pointermove' && !event.buttons) return;
		this.framePacer.wake(performance.now());
	};

	/**
	 * Only records: what a press does is decided once a frame by the shortcut
	 * system. Presses in text fields belong to the field. The one thing
	 * decided here is whether the browser gets the event, since that cannot
	 * wait for the frame — backspace would have navigated by then.
	 */
	private readonly onKeyDown = (event: KeyboardEvent) => {
		if (
			event.target instanceof HTMLInputElement
			|| event.target instanceof HTMLTextAreaElement
			|| (event.target instanceof HTMLElement && event.target.isContentEditable)
			|| (event.target instanceof HTMLElement && event.target.closest('.syka-agent-chat'))
		) return;

		// A drag selection in the transcript can leave keyboard focus on body.
		// Let the browser copy that text instead of invoking canvas shortcuts.
		const selection = window.getSelection?.();
		if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c'
			&& selection && !selection.isCollapsed && selection.anchorNode?.parentElement?.closest('.syka-agent-chat')) return;

		const keys = this.world.get(Keys)!;
		const key = event.key.toLowerCase();
		const isMod = event.key === 'Meta' || event.key === 'Control';

		keys.held.add(key);
		if (isMod) keys.held.add('mod');
		if (!event.repeat) {
			keys.pressed.add(key);
			if (isMod) keys.pressed.add('mod');
		}

		event.preventDefault();
	}

	private readonly onKeyUp = (event: KeyboardEvent) => {
		const keys = this.world.get(Keys)!;
		const key = event.key.toLowerCase();
		const isMod = event.key === 'Meta' || event.key === 'Control';

		keys.held.delete(key);
		keys.lifted.add(key);

		if (!isMod) return;

		keys.held.delete('mod');
		keys.lifted.add('mod');

		for (const stale of [...keys.held]) {
			// macOS never delivers the key-up of a key released while ⌘ is held
			if (!MODIFIER_KEYS.has(stale)) keys.held.delete(stale);
		}
	};

	private readonly loop = (timestamp: number): void => {
		const continuous = this.interactiveDirty || this.canvasPointerId !== null
			|| !!this.world.get(Keys)?.held.size || !!this.world.get(PointerEvents)?.queue.length
			|| (this.world.get(Mode)?.value ?? 'realtime') !== 'realtime'
			|| !!this.world.get(Tickers)?.size
			|| this.world.query(Scene, Playback).some(scene => scene.get(Playback)?.playing);
		if (!this.framePacer.shouldTick(timestamp, continuous)) {
			this.rafId = requestAnimationFrame(this.loop);
			return;
		}
		const delta = this.lastTimestamp === null ? 0 : timestamp - this.lastTimestamp;
		this.lastTimestamp = timestamp;
		this.world.set(Time, { now: timestamp, delta });

		if (this.interactiveDirty) {
			syncInteractiveState(this.world);
			this.interactiveDirty = false;
		}

		this.runSystems();
		this.setFrame((count) => count + 1);

		const keys = this.world.get(Keys);
		keys?.pressed.clear();
		keys?.lifted.clear();

		this.rafId = requestAnimationFrame(this.loop);
	}

	private resize(): void {
		this.framePacer.wake(performance.now());
		const parent = this.canvas?.parentElement;
		if (!parent || !this.canvas) return;

		const { width, height } = parent.getBoundingClientRect();
		const dpr = window.devicePixelRatio;

		const pixelWidth = Math.round(width * dpr);
		const pixelHeight = Math.round(height * dpr);

		if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
			this.canvas.width = pixelWidth;
			this.canvas.height = pixelHeight;
		}
		this.canvas.style.width = `${width}px`;
		this.canvas.style.height = `${height}px`;

		this.world.set(RenderSurface, { resolution: dpr });

		this.runSystems();
		// Locked preview stays fitted when the window or timeline is resized.
		if (this.world.get(CameraNavigation)?.locked) {
			const scene = getActiveEntity(this.world);
			if (scene) focusEntities(this.world, [scene], 28);
		}
	}

	private addEvent(type: PointerEventType, event: PointerEvent | MouseEvent): void {
		this.framePacer.wake(performance.now());
		if (!this.canvas) return;
		const rect = this.canvas.getBoundingClientRect();
		const resolution = this.world.get(RenderSurface)?.resolution ?? 1;

		this.world.get(PointerEvents)?.queue.push({
			type,
			clientX: (event.clientX - rect.left) * resolution,
			clientY: (event.clientY - rect.top) * resolution,
			button: event.button,
		} as CanvasPointerEvent);
	};

	private runSystems(): void {
		inputSystem(this.world);
		shortcutSystem(this.world);
		assetSystem(this.world);
		playbackSystem(this.world);
		motionSystem(this.world);
		transformSystem(this.world);
		const view = this.world.get(SceneView)!;
		if (!view.overview) {
			const scenes = getEntityChildren(this.world, this.world.get(Root)!).filter(e => e.has(Scene));
			const scene = scenes.find(e => (e.get(Source)?.value || String(e.id())) === view.key) ?? scenes[0];
			if (scene && getActiveEntity(this.world) !== scene) setActive(this.world, scene);
			const key = scene ? (scene.get(Source)?.value || String(scene.id())) : '';
			if (scene && key !== view.key) {
				for (const selected of this.world.query(Selected)) selected.remove(Selected);
				this.world.set(SceneView, { key });
				focusEntities(this.world, [scene], 28);
			}
			// Hidden compositions must also stop receiving hits and decoding media.
			// Transform recomputes these tags when the optional overview is enabled.
			if (scene) {
				for (const root of this.world.query(ChildOf(this.world.get(Root)!))) {
					if (root === scene) continue;
					for (const node of getEntityTree(this.world, root)) {
						if (!node.has(Geometry) && !node.has(Group)) continue;
						if (!node.has(Culled)) node.add(Culled);
						if (node.has(Selected)) node.remove(Selected);
					}
				}
			}
		}
		renderSystem(this.world);
		hudSystem(this.world);
		timelineSystem(this.world);
	}

	public start(): void {
		if (this.running()) return;
		// Chromium can retain an occluded canvas surface after an offline
		// capture, despite subsequent draw calls updating its pixel buffer.
		// Reallocate it once on resume; the next frame redraws at the same
		// size, camera and playhead. Do not read pixels or reset scene state.
		if (this.canvas && this.frame() > 0) {
			const width = this.canvas.width;
			this.canvas.width = width;
		}
		this.setRunning(true);
		this.lastTimestamp = null;
		this.framePacer.reset();
		this.framePacer.wake(performance.now());
		this.rafId = requestAnimationFrame(this.loop);
	}

	public stop(): void {
		this.setRunning(false);
		if (this.rafId !== null) {
			cancelAnimationFrame(this.rafId);
			this.rafId = null;
		}
	}

	public mount(canvas: HTMLCanvasElement): void {
		this.unsubscribeEventListeners();

		this.canvas = canvas;
		this.world.set(RenderSurface, { canvas, ctx: canvas.getContext('2d') });

		canvas.addEventListener('click', this.onClick);
		canvas.addEventListener('dblclick', this.onDoubleClick);
		canvas.addEventListener('pointerdown', this.onPointerDown);
		canvas.addEventListener('pointermove', this.onPointerMove);
		canvas.addEventListener('pointerenter', this.onPointerEnter);
		canvas.addEventListener('pointerleave', this.onPointerLeave);
		window.addEventListener('pointerup', this.onPointerUp);
		window.addEventListener('pointercancel', this.onPointerUp);
		window.addEventListener('keydown', this.onKeyDown);
		window.addEventListener('keyup', this.onKeyUp);
		window.addEventListener('blur', this.onBlur);
		window.addEventListener('pointerdown', this.onActivity, { passive: true });
		window.addEventListener('pointermove', this.onActivity, { passive: true });
		window.addEventListener('input', this.onActivity);
		window.addEventListener('keydown', this.onActivity);
		window.addEventListener('wheel', this.onActivity, { passive: true });

		this.resizeObserver.observe(canvas.parentElement!);
	}

	public snapshot(): Promise<Blob | null> {
		const canvas = this.canvas;
		if (!canvas?.width || !canvas.height) return Promise.resolve(null);

		const mode = this.world.get(Mode)?.value ?? 'realtime';
		this.world.set(Mode, { value: 'offline-video' });
		renderSystem(this.world);

		const encoded = new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));

		this.world.set(Mode, { value: mode });
		renderSystem(this.world);
		hudSystem(this.world);

		return encoded;
	}

	public dispose(): void {
		this.stop();
		if (this.ownsAudioContext && this.audioContext) {
			void this.audioContext.close();
		}

		// The timeline's decoded pictures and peaks are of this project's
		// files, and are held outside the world: they go with the engine.
		clearPeaks();
		clearMedia();
		clearObjectTracks();

		this.unsubscribeEventListeners();
		this.unsubscribe.forEach(unsubscribe => unsubscribe());
		this.unsubscribe.length = 0;
		this.world.get(PointerEvents)?.queue.splice(0);
		this.world.destroy();
	}

	private unsubscribeEventListeners(): void {
		this.canvasPointerId = null;
		this.canvas?.removeEventListener('click', this.onClick);
		this.canvas?.removeEventListener('dblclick', this.onDoubleClick);
		this.canvas?.removeEventListener('pointerdown', this.onPointerDown);
		this.canvas?.removeEventListener('pointermove', this.onPointerMove);
		this.canvas?.removeEventListener('pointerenter', this.onPointerEnter);
		this.canvas?.removeEventListener('pointerleave', this.onPointerLeave);
		window.removeEventListener('pointerup', this.onPointerUp);
		window.removeEventListener('pointercancel', this.onPointerUp);
		window.removeEventListener('keydown', this.onKeyDown);
		window.removeEventListener('keyup', this.onKeyUp);
		window.removeEventListener('blur', this.onBlur);
		window.removeEventListener('pointerdown', this.onActivity);
		window.removeEventListener('pointermove', this.onActivity);
		window.removeEventListener('input', this.onActivity);
		window.removeEventListener('keydown', this.onActivity);
		window.removeEventListener('wheel', this.onActivity);
		this.resizeObserver.disconnect();
	}
}

export function createEngine(projectId: string, options: EngineOptions = {}): Engine {
	return new Engine(projectId, options);
}

export type { Engine };
