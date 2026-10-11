/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { Show, createMemo, createSignal, onMount } from "solid-js";
import { Canvas } from "@/components/canvas";
import { leftSidebarWidth } from "@/agent-chat";
import { Timeline, Layers } from "@/components/timeline";
import { TimelineToolbar } from '@/components/timeline/toolbar';
import { Soundboard, RightSidebar } from "@/components/sidebar-right";
import { EditorTitleBar, FloatingProjectHeader, SidebarLeft } from "@/components/sidebar-left";
import { useLayout, MIN_TIMELINE_HEIGHT } from "@/context/layout";
import { useEditorApi } from "@/dapi";
import { RULER_HEIGHT } from "@/engine/timeline";
import { createEffect, onCleanup, untrack } from 'solid-js';
import { toast } from 'somoto';
import { useWorld } from '@diffusionstudio/koota-solid';
import { mount } from '@diffusionstudio/reconciler';
import { getDocumentEditor } from '@/engine/editor';
import { getEditHistory } from '@/engine/history';
import { setInspectEntries } from '@/engine/inspect';
import { attachLibrary, isLibraryFile } from '@/engine/library';
import { attachAi } from '@/utils/gen-ai';
import { attachProjectConfig, isProjectConfigFile } from '@/engine/project-config';
import { loadProjectBundle, rememberProjectBundle } from '@/lib/db';
import { isCacheFile } from '@diffusionstudio/assets';
import { createEditWriter } from '@/projects/edits';
import { attachProjectHistory } from '@/projects/history';
import { attachProjectReadiness, waitForProjectTask } from '@/projects/readiness';
import { compileProject, isWindowsDesktop, refreshProject, watchProject } from '@/projects/host';
import { MAIN_CHANNELS } from '@desktop/main-channels';
import { mainBridge } from '@/lib/ipc';
import { notifyOperation, resolveOperation } from '@/lib/studio-notifications';
import { DapiError } from '@diffusionstudio/dapi';
import { captureProjectCover } from '@/projects/cover';
import { useProject } from "@/context/project";
import { useEngineContext } from "@/engine";

import type { Mount } from '@diffusionstudio/reconciler';
import type { EditWriter } from '@/projects/edits';

const MIN_CANVAS_HEIGHT = 200;
const INSPECTOR_WIDTH = 264;
// View state is persisted, but never makes the rendered content diverge.
const VIEW_ONLY_PROPS = new Set(['selected', 'active', 'camera', 'expanded', 'clipHeight', 'timeline', 'playhead']);

export function EditorPage() {
  const { uiVisible, timelineMinimized, timelineHeight, setTimelineHeight } = useLayout();
  const { isDesktop, isFullscreen } = useEditorApi();
  const [resizing, setResizing] = createSignal(false);
  const project = useProject();
  const world = useWorld();
  const engine = useEngineContext();

  // Keyed on the folder, not the project: a rename moves it, and everything
  // below holds a path — the watcher, the library, the writer — so all of it
  // is torn down and re-attached where the project now is.
  createEffect(() => {
    const dir = project.dir();
    if (!dir) return;

    let mounted: Mount | undefined;
    let mountedCode: string | undefined;
    let documentEdited = false;
    let writer: EditWriter | undefined;
    let unlisten: (() => void) | undefined;
    let disposed = false;
    let generation = 0;
    let lastCompileWarning: string | undefined;
    let lastFlushWarning: string | undefined;
    let loading: Promise<void> | undefined;
    let readyRevision: string | undefined;
    let mountedFrame = -1;
    let sourceEpoch = 0;
    let mountedEpoch = -1;
    let loadFailure: { revision?: string; epoch: number; message: string } | undefined;
    let blockingTimer: ReturnType<typeof setTimeout> | undefined;
    const notifyFailure = () => {
      clearTimeout(blockingTimer);
      const failure = loadFailure;
      if (!failure) return;
      // Source writes can briefly be incomplete. Notify only a stable failure.
      blockingTimer = setTimeout(() => {
        if (!disposed && loadFailure === failure) void notifyOperation({ id: untrack(project.id), dir }, { kind: 'blocked', operationId: 'compiler', message: failure.message });
      }, 2000);
    };

    const sourceRevision = async (): Promise<string> => {
      const status = await mainBridge.call(MAIN_CHANNELS.SYKA_EDIT_HISTORY_STATUS, { dir });
      if (!status.ok) throw new DapiError('invalid-input', `No se puede verificar la fuente actual: ${status.error}`);
      return status.revision;
    };

    // The library first: a mounted project's `src` values name its assets.
    const library = attachLibrary(world, dir);
    // The generation service over it: what `generate.*` sources resolve through.
    attachAi(world, library, dir);
    // The project's own settings (package.json `diffusion`), next to the scene.
    const config = attachProjectConfig(world, dir);

    const unmount = (): void => {
      // Before the entities go: what the editor changed is still owed to the
      // file, whatever happens to the scene that showed it.
      unlisten?.();
      unlisten = undefined;
      writer?.dispose();
      writer = undefined;
      mounted?.dispose();
      mounted = undefined;
      mountedCode = undefined;
      documentEdited = false;
      // The entries hold the dead mount's signals; the inspector must not.
      setInspectEntries(world, []);
    };

    /** Puts `code` on the stage, unless it is what is there already. */
    const applyBundle = (code: string): void => {
      // Manual edits mutate this world without replacing mountedCode. Undo
      // can return to that original bundle: equal source must still remount
      // when the currently displayed document was edited in the meantime.
      if (code === mountedCode && !documentEdited) return;
      const replaced = mountedCode !== undefined;
      // The old render goes first: there is only one stage per world.
      unmount();
      mounted = mount(code, world);
      mountedCode = code;
      // The `@inspect` variables this mount declared, for the inspector.
      setInspectEntries(world, mounted.inspect);
      // The rendered scene knows which element every entity came from, so
      // from here on an edit in the editor can find its way back.
      writer = createEditWriter(dir, world, (result) => {
        // A manual write persists the already edited world. Only advance a
        // contiguous journal transition; a foreign edit in between still
        // requires a compile. This must not remount or reset manual Undo.
        if (result.revision && result.previousRevision === readyRevision) {
          readyRevision = result.revision;
          mountedFrame = engine.frame();
        }
      });
      const editor = getDocumentEditor(world);
      unlisten = editor.onEdit((edit) => {
        if (edit.kind !== 'prop' || !VIEW_ONLY_PROPS.has(edit.name)) documentEdited = true;
        writer?.push(edit);
      });
      // A mount comes from the file: edits recorded against the document it
      // replaced cannot be replayed against this one.
      getEditHistory(world).reset(replaced
        ? 'Se recargó el código del proyecto y empezó un historial manual nuevo. Los cambios del chat se deshacen desde el chat; no se mezclan con Ctrl+Z.'
        : undefined);
      void getEditHistory(world).refresh();
    };

    const performLoad = async (current: number): Promise<void> => {
      let revisionBefore: string | undefined;
      let epochBefore = sourceEpoch;
      loadFailure = undefined;
      try {
        // Settle debounced manual batches before compiling an externally changed file.
        // Otherwise unmount can strand pending insert ids in the old writer.
        try {
          await writer?.drain();
          lastFlushWarning = undefined;
        } catch (error) {
          // A rejected stale write must not stop the protected compiler from
          // showing the external file. The failed batch is never adopted.
          if (disposed || current !== generation) return;
          const description = error instanceof Error ? error.message : String(error);
          if (description !== lastFlushWarning) {
            lastFlushWarning = description;
            toast.error('No se guardaron los cambios pendientes; se mostrará el archivo actual', { description });
          }
        }
        if (disposed || current !== generation) return;
        // Stamping ids may itself advance the journal once. Retry a changed
        // revision instead of certifying a bundle built across two versions.
        for (let attempt = 0; attempt < 3; attempt++) {
          epochBefore = sourceEpoch;
          revisionBefore = await sourceRevision().catch(() => undefined);
          if (disposed || current !== generation) return;
          const compiling = compileProject(dir);
          const loading = library.load();

          // First open only: the bundle the last session mounted, straight from
          // the app's database, goes on the stage while the compile chews
          // through the sources — unless the compile wins the race outright. A
          // bundle the sources have outgrown can fail against today's assets;
          // the compile that is already running replaces it either way.
          if (current === 1 && attempt === 0) {
            // Neither arm may reject: the loser would be an unhandled rejection,
            // and the compile's real failure is dealt with below.
            const cached = await Promise.race([
              Promise.all([loadProjectBundle(untrack(project.id)), loading])
                .then(([code]) => code, () => null),
              compiling.then(() => null, () => null),
            ]);
            if (disposed || current !== generation) return;
            if (cached && mountedCode === undefined) {
              try {
                applyBundle(cached);
              } catch {
                // The compile lands next, with a toast of its own if it must.
              }
            }
          }

          const [result] = await Promise.all([compiling, loading]);
          if (disposed || current !== generation) return;

          // A broken edit keeps the last good render on the canvas.
          if (!result.ok) {
            loadFailure = { revision: revisionBefore, epoch: epochBefore, message: `El proyecto no compiló: ${result.error}` };
            console.error('[projects] compile failed:', result.error);
            toast.error('Project failed to compile', { description: result.error });
            notifyFailure();
            return;
          }

          const revisionAfter = await sourceRevision().catch(() => undefined);
          if (disposed || current !== generation) return;
          if (revisionBefore && revisionAfter && revisionBefore !== revisionAfter) continue;

          if (result.warning && result.warning !== lastCompileWarning) {
            toast('Fuente externa preservada; deshacer bloqueado', { description: result.warning });
          }
          lastCompileWarning = result.warning;

          try {
            applyBundle(result.code);
            clearTimeout(blockingTimer);
            void resolveOperation(dir, 'blocked', 'compiler');
            readyRevision = revisionBefore === revisionAfter ? revisionAfter : undefined;
            mountedEpoch = epochBefore;
            mountedFrame = engine.frame();
            // What an export renders a second time, and the next open's head
            // start (see `rememberProjectBundle`) — recorded only once it has
            // actually mounted, so the record never runs ahead of the canvas.
            rememberProjectBundle(untrack(project.id), result.code).catch((error) =>
              console.error('[projects] could not save the bundle', error));
          } catch (error) {
            loadFailure = { revision: revisionBefore, epoch: epochBefore, message: `El proyecto no pudo cargar la composición: ${error instanceof Error ? error.message : String(error)}` };
            console.error('[projects] render failed:', error);
            toast.error('Project failed to render', { description: (error as Error).message });
            notifyFailure();
          }
          return;
        }
        // Continuous edits are left to the next watcher/check pass. The
        // inspection deadline is bounded; normal editing remains available.
        readyRevision = undefined;
      } catch (error) {
        if (!disposed && current === generation) {
          loadFailure = { revision: revisionBefore, epoch: epochBefore, message: `El proyecto no pudo compilarse o cargarse: ${error instanceof Error ? error.message : String(error)}` };
          notifyFailure();
        }
        throw error;
      }
    };

    const loadProject = (): Promise<void> => {
      const task = performLoad(++generation).finally(() => { if (loading === task) loading = undefined; });
      loading = task;
      return task;
    };

    const load = (): void => {
      loadProject().catch((error) => {
        console.error('[projects] load failed:', error);
        toast.error('Project failed to load', { description: (error as Error).message });
      });
    };

    const detachHistory = attachProjectHistory(world, dir, {
      drain: () => writer?.drain() ?? Promise.resolve(),
      pending: () => writer?.hasPendingEdits() ?? false,
      reload: loadProject,
    });
    const detachReadiness = attachProjectReadiness(world, async (signal) => {
      while (!disposed) {
        signal.throwIfAborted();
        // A check made in the same turn as an inspector edit must include
        // that edit, while leaving its live entities and Undo stack intact.
        await waitForProjectTask(writer?.drain() ?? Promise.resolve(), signal);
        const revision = await waitForProjectTask(sourceRevision(), signal);
        if (disposed) break;
        if (loading) {
          try { await waitForProjectTask(loading, signal); }
          catch { signal.throwIfAborted(); }
          continue;
        }
        if (loadFailure && loadFailure.revision === revision && loadFailure.epoch === sourceEpoch) {
          throw new DapiError('invalid-input', `${loadFailure.message}\nNo se revisó la última vista previa válida. Corregí la fuente y volvé a ejecutar check.`);
        }
        if (readyRevision === revision && mountedEpoch === sourceEpoch) {
          if (engine.frame() > mountedFrame) return;
          // Computed traits are updated by the engine, not by mount itself.
          await waitForProjectTask(new Promise<void>(resolve => requestAnimationFrame(() => resolve())), signal);
          continue;
        }
        // Source tools commit the journal before fs.watch's debounced event.
        // Reading it closes that race without guessing a sleep duration.
        try { await waitForProjectTask(loadProject(), signal); }
        catch { signal.throwIfAborted(); }
      }
      throw new DapiError('canceled', 'El proyecto cambió durante la revisión.');
    });
    load();
  
    // A burst arrives as the whole set of files it touched, so a checkout that
    // rewrites the library and the sources at once reloads both — reading only
    // the last path of a burst would answer for one of them and drop the rest.
    const unwatch = watchProject(dir, (paths) => {
      const changed = paths.filter((path) => !isCacheFile(path));
      if (changed.some(isLibraryFile)) library.load();

      const source = changed.filter((path) => !isLibraryFile(path));
      if (!source.length) return;
      // package.json is the config and the record (`main`, `displayName`)
      // in one, so a hand edit to it reloads both; the app's own config
      // writes never reach here (main keeps them from the watcher).
      if (source.some(isProjectConfigFile)) {
        config.load();
        project.refresh();
      }
      // An immediate check may already have loaded this burst, before the
      // watcher's coalescing timer fired. Do not remount a later manual edit.
      if (mountedEpoch === sourceEpoch && !loading) return;
      load();
    }, 80, (path) => {
      if (!isCacheFile(path) && !isLibraryFile(path)) {
        sourceEpoch++;
      }
    });

    onCleanup(() => {
      disposed = true;
      clearTimeout(blockingTimer);
      detachReadiness();
      detachHistory();
      captureProjectCover(dir, engine.snapshot());
      refreshProject(dir);
      unwatch();
      unmount();
      config.dispose();
      library.dispose();
    });
  });

  // The left column follows the sidebar's tab (264 px on Assets, 340 px on
  // Chat) and animates between the two — except on load, where the stored
  // tab is read before first paint and the transition only comes on after
  // the first frame. Toggling `uiVisible` changes the track count, which
  // Chromium does not interpolate, so that still snaps as before.
  const [animateColumns, setAnimateColumns] = createSignal(false);
  onMount(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    requestAnimationFrame(() => requestAnimationFrame(() => setAnimateColumns(true)));
  });

  const timelineStyles = createMemo(() => {
    if (!uiVisible()) return;

    const height = timelineMinimized() ? RULER_HEIGHT : timelineHeight();

    return {
      'grid-template-columns': `${leftSidebarWidth()}px 1px 1fr 1px ${INSPECTOR_WIDTH}px`,
      'grid-template-rows': timelineMinimized() ? `1fr 1px ${height}px` : `1fr 1px 36px ${height}px`,
      ...(animateColumns() ? { transition: 'grid-template-columns 200ms ease-out' } : {}),
    };
  });

  const handleResizeStart = (e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startHeight = timelineHeight();
    setResizing(true);

    const handleMove = (ev: PointerEvent) => {
      const deltaY = startY - ev.clientY;
      const maxHeight = Math.max(
        MIN_TIMELINE_HEIGHT,
        window.innerHeight - MIN_CANVAS_HEIGHT - 1,
      );
      const next = Math.max(MIN_TIMELINE_HEIGHT, Math.min(maxHeight, startHeight + deltaY));
      setTimelineHeight(next);
    };

    const handleEnd = () => {
      setResizing(false);
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleEnd);
    };

    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleEnd);
  };

  return (
    <div
      class="bg-sidebar h-screen w-full overflow-hidden grid pt-(--titlebar-height)"
      classList={{
        'grid-cols-[1fr]': !uiVisible(),
        'grid-rows-[1fr]': !uiVisible(),
      }}
      style={timelineStyles()}
    >
      <EditorTitleBar leftWidth={leftSidebarWidth() + 1} controlsWidth={INSPECTOR_WIDTH + 1} />
      <Show when={isDesktop && !isWindowsDesktop() && !isFullscreen()}>
        <div class="fixed top-0 left-0 right-0 h-10 z-20" style="-webkit-app-region: drag;" />
      </Show>
      <Show when={uiVisible()}>
        <SidebarLeft />
        <div class="bg-border-strong" />
      </Show>
      <Canvas />
      <Show when={uiVisible()}>
        <div class="bg-border-strong" />
        <RightSidebar />
      </Show>
      <Show when={uiVisible()}>
        <div class="col-span-full bg-border-strong relative">
          <Show when={!timelineMinimized()}>
            <div
              class="absolute left-0 right-0 -top-px h-0.75 z-10 cursor-ns-resize group"
              onPointerDown={handleResizeStart}
            >
              <div
                class="absolute left-0 right-0 top-px h-px transition-colors group-hover:bg-primary"
                classList={{ 'bg-primary': resizing() }}
              />
            </div>
          </Show>
        </div>
      </Show>
      <Show when={uiVisible() && !timelineMinimized()}><TimelineToolbar /></Show>
      <Show when={uiVisible()}>
        <Layers />
        <div class="bg-border-strong" />
      </Show>
      <Show when={uiVisible()}>
        <Timeline />
      </Show>
      <Show when={uiVisible()}>
        <div class="bg-border-strong" />
        <Show when={!timelineMinimized()}>
          <Soundboard />
        </Show>
      </Show>
      {/* The Windows title bar stays up with the UI hidden and offers the same. */}
      <Show when={!uiVisible() && !isWindowsDesktop()}>
        <FloatingProjectHeader />
      </Show>
      <Show when={getEditHistory(world).busy()}>
        <div class="fixed inset-0 z-[100] cursor-wait bg-background/15 flex items-center justify-center" role="status" aria-live="polite">
          <span class="rounded-md border border-border bg-background px-4 py-2 text-xs shadow-lg">Restaurando el proyecto…</span>
        </div>
      </Show>
    </div>
  );
}
