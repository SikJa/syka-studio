import '../index.css';
import { DAPI_WIRE, DapiError, isDapiError } from '@diffusionstudio/dapi';
import { Ai, FramePromises, Library, Mode, Playback, RenderSurface, Root, Silent, Time,
  GenAi, disposeDecoders, getActiveEntity, getEntityChildren, isScene, motionSystem,
  playbackSystem, setActive, transformSystem } from '@diffusionstudio/runtime';
import { warmupAssets } from '@diffusionstudio/encoder';
import { mount } from '@diffusionstudio/reconciler';
import { createEngine } from '@/engine/create-engine';
import { attachLibrary } from '@/engine/library';
import { attachPreviewBundle } from '@/engine/capture';
import { initializeFontCatalog } from '@/engine/fonts';
import { getDocumentEditor } from '@/engine/editor';
import { createEditWriter } from '@/projects/edits';
import { attachProjectReadiness } from '@/projects/readiness';
import { MAIN_CHANNELS } from '@desktop/main-channels';
import { mainBridge } from '@/lib/ipc';
import { handlers } from './handlers';
import { transcriptKey } from '@/utils/gen-ai';
import { isPartialAsset } from '@diffusionstudio/assets';
import type { DapiCall, DapiCancel, DapiReply } from '@diffusionstudio/dapi';
import type { ToolContext, ServedToolName } from './handler';
import type { Asset, AssetLibrary } from '@diffusionstudio/assets';
import type { Entity, World } from 'koota';

/** Reviewing a file must never implicitly start generation or a new transcription. */
class ReviewAi extends GenAi {
  private readonly library: AssetLibrary;
  constructor(library: AssetLibrary) { super(); this.library = library; }
  resolve(): Promise<Asset> { return Promise.reject(new DapiError('unsupported',
    'La revisión necesita el recurso generado guardado. No inicia generaciones automáticamente.')); }
  transcribe(_world: World, scene: Entity, seed: number): Promise<Asset> {
    const known = this.library.generated(transcriptKey(scene, seed));
    if (known && !isPartialAsset(known)) return Promise.resolve(known);
    return Promise.reject(new DapiError('unsupported',
      'Guardá primero la transcripción y usá su archivo en los subtítulos. La revisión no transcribe automáticamente.'));
  }
}

let active: AbortController | null = null;
let activeId: string | null = null;
window.desktop?.on(DAPI_WIRE.CANCEL, raw => {
  if ((raw as DapiCancel).id === activeId) active?.abort();
});
window.desktop?.on(DAPI_WIRE.CALL, raw => void dispatch(raw as DapiCall));
window.desktop?.send(DAPI_WIRE.PREVIEW_READY, {});

async function dispatch(call: DapiCall): Promise<void> {
  if (active) {
    window.desktop?.send(DAPI_WIRE.REPLY, { id: call.id, ok: false,
      error: { code: 'busy', message: 'La preview interna ya está revisando un proyecto.' } } satisfies DapiReply);
    return;
  }
  const controller = new AbortController();
  active = controller;
  activeId = call.id;
  let reply: DapiReply;
  try {
    reply = { id: call.id, ok: true, data: await review(call, controller.signal) };
  } catch (error) {
    reply = { id: call.id, ok: false, error: { message: error instanceof Error ? error.message : String(error),
      ...(isDapiError(error) ? { code: error.code } : {}) } };
  } finally {
    active = null;
    activeId = null;
  }
  if (!controller.signal.aborted) window.desktop?.send(DAPI_WIRE.REPLY, reply);
}

async function review(call: DapiCall, signal: AbortSignal): Promise<unknown> {
  const target = call.project;
  if (!target) throw new DapiError('invalid-input', 'La revisión no tiene proyecto asignado.');
  const info = await mainBridge.call(MAIN_CHANNELS.PROJECTS_GET, { dir: target.dir });
  if (!info || info.id !== target.id) throw new DapiError('not-found', 'La revisión pertenece a otro proyecto o su carpeta cambió.');
  if (call.tool === 'open') return { id: info.id, name: info.displayName, dir: info.dir };
  if (call.tool === 'export' || call.tool === 'screenshot') throw new DapiError('unsupported',
    'Usá capture/check para revisar la composición. La exportación y la interfaz pertenecen a la ventana del usuario.');
  const handler = handlers[call.tool as ServedToolName] as (args: unknown, ctx: ToolContext) => Promise<unknown>;
  if (!handler) throw new DapiError('unsupported', `No existe la herramienta ${call.tool}.`);

  const revision = async () => {
    const status = await mainBridge.call(MAIN_CHANNELS.PROJECTS_SOURCE_REVISION, { dir: info.dir });
    return status.revision;
  };
  const checkCanceled = () => {
    if (signal.aborted) throw new DapiError('canceled', 'Se canceló la revisión.');
  };

  // No canvas mount/start: the editor's playback/timeline loop never starts here.
  const engine = createEngine(info.id, { silent: true });
  const world = engine.world;
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 2;
  canvas.style.cssText = 'position:fixed;left:0;top:0;opacity:0;will-change:opacity;pointer-events:none;';
  document.body.appendChild(canvas);
  world.set(RenderSurface, { canvas, ctx: canvas.getContext('2d'), resolution: 1 });
  world.set(Mode, { value: 'offline-video' });
  world.add(Silent);
  world.set(FramePromises, { list: [] });
  world.set(Time, { now: 0, delta: 0 });
  const library = attachLibrary(world, info.dir);
  world.set(Ai, new ReviewAi(library));
  let mounted: ReturnType<typeof mount> | undefined;
  let detachBundle: (() => void) | undefined;
  let detachReady: (() => void) | undefined;
  let writer: ReturnType<typeof createEditWriter> | undefined;
  let unlisten: (() => void) | undefined;
  try {
    await Promise.all([initializeFontCatalog(), library.load()]);
    checkCanceled();
    // Asset/media/font tools need no compiled scene. Broken syntax must not
    // prevent importing assets or probing footage to repair the composition.
    const needsScene = ['context', 'capture', 'check', 'motion_events'].includes(call.tool)
      || (call.tool === 'assets' && (call.args as { action?: string }).action === 'rename');
    let sourceRevision: string | undefined;
    if (needsScene) {
      for (let attempt = 0; attempt < 3; attempt++) {
        const before = await revision();
        const compiled = await mainBridge.call(MAIN_CHANNELS.PROJECTS_COMPILE, { dir: info.dir });
        checkCanceled();
        if (!compiled.ok) throw new DapiError('invalid-input', `El proyecto no compiló: ${compiled.error}`);
        const after = await revision();
        if (before !== after) continue;
        sourceRevision = after;
        mounted = mount(compiled.code, world);
        detachBundle = attachPreviewBundle(world, compiled.code);
        break;
      }
      if (!mounted) throw new DapiError('busy', 'La fuente sigue cambiando. Terminá de guardar y repetí la revisión; no hace falta abrir este proyecto.');
      for (const node of world.query(Playback)) node.set(Playback, { playing: false });
      await warmupAssets(world);
      checkCanceled();
      playbackSystem(world);
      motionSystem(world);
      transformSystem(world);
      const first = getEntityChildren(world, world.get(Root)!).find(isScene);
      if (!getActiveEntity(world) && first) setActive(world, first);
      detachReady = attachProjectReadiness(world, async () => { checkCanceled(); });
      if (call.tool === 'assets') {
        writer = createEditWriter(info.dir, world);
        unlisten = getDocumentEditor(world).onEdit(edit => writer!.push(edit));
      }
    }
    const session = { world, engine, project: { dir: () => info.dir } };
    const ctx: ToolContext = { session: () => session, requireSession: () => session, signal, internalPreview: true,
      app: {
        async openProject(dir) {
          if (dir !== info.dir) throw new DapiError('invalid-input', 'Esta revisión no puede cambiar de proyecto.');
          return { id: info.id, name: info.displayName, dir: info.dir };
        },
        requireUser() { throw new DapiError('sign-in-required', 'La revisión interna no inicia generación en servicios externos.'); },
      } };
    const result = await handler(call.args, ctx);
    await writer?.drain();
    await library.flush();
    checkCanceled();
    if (sourceRevision && call.tool !== 'assets' && await revision() !== sourceRevision) {
      throw new DapiError('busy', 'La fuente cambió durante la revisión. Repetí check/capture para revisar la versión guardada actual.');
    }
    return result;
  } finally {
    // Only the renderer stays warm briefly. No project world survives a job.
    let cleanupError: unknown;
    for (const release of [unlisten, () => writer?.dispose(), detachReady, detachBundle,
      () => disposeDecoders(world, world.get(Root)!), () => mounted?.dispose()]) {
      try { release?.(); } catch (error) { cleanupError ??= error; }
    }
    try { await library.dispose(); } catch (error) { cleanupError ??= error; }
    try { world.set(Library, null); } finally { canvas.remove(); engine.dispose(); }
    if (cleanupError) throw cleanupError;
  }
}
