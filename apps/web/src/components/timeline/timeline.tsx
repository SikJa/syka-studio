/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { createSignal, onCleanup, onMount, Show } from 'solid-js';
import { toast } from 'somoto';
import { useWorld } from '@diffusionstudio/koota-solid';
import { FrameRate, framesToSeconds, getActiveEntity } from '@diffusionstudio/runtime';
import { droppedFiles, importFiles } from '@/engine/asset-actions';
import { insertAsset } from '@/engine/insert-asset';
import { insertAssetsInNewScene } from '@/engine/new-scene';
import { useLibrary } from '@/engine/library';
import { useTimeline } from '@/context/timeline';
import { ASSET_DRAG_TYPE } from '@/components/sidebar-left/folder-item';
import { RESOURCE_DRAG_TYPE } from '@/components/sidebar-right/library-model';
import { TimelineSurface } from '@/engine/timeline/surface';
import { contextClip } from '@/engine/timeline/context-target';
import { ClipContextMenu } from './clip-context-menu';
import { LINKED_RESOURCE_DRAG_TYPE, readLinkedResourceDrop } from '@/engine/linked-resource-drag';
import { insertLinkedResource } from '@/engine/linked-resource-actions';

/**
 * The timeline's canvas. What is drawn on it is the timeline system's
 * business (see `@/engine/timeline`); this is the element it draws on and
 * what dropping an asset onto it means.
 */
export function Timeline() {
  const world = useWorld();
  const timeline = useTimeline();
  const library = useLibrary();
  const [dropPoint, setDropPoint] = createSignal<{ x: number; start: number }>();
  const [inserting, setInserting] = createSignal(false);

  onMount(() => timeline.attachCanvas());
  onCleanup(() => timeline.detachCanvas());
  onMount(() => {
    const clear = () => setDropPoint(undefined);
    window.addEventListener('dragend', clear);
    onCleanup(() => window.removeEventListener('dragend', clear));
  });

  /**
   * Assets dropped on the timeline start where they were dropped, unlike
   * ones dropped on the canvas, which start at the playhead: the whole point
   * of aiming at a place on the timeline is to say when.
   *
   * With no scene to drop into, they get one of their own rather than
   * landing loose at the root, sized to the last of them that has a size
   * (see `insertAssetsInNewScene`).
   */
  const handleDrop = async (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setDropPoint(undefined);

    if (event.dataTransfer?.types.includes(LINKED_RESOURCE_DRAG_TYPE)) {
      const resource = readLinkedResourceDrop(event.dataTransfer);
      const lib = library();
      if (!resource || !lib) return;
      if (inserting()) { toast('Esperá a que termine de agregarse el recurso anterior.'); return; }
      const fps = world.get(FrameRate)?.value ?? 30;
      const start = framesToSeconds(Math.max(0, timeline.clientToFrame(event.clientX)), fps);
      setInserting(true);
      try {
        await insertLinkedResource(world, lib, resource, { start });
        toast.success(resource.title + ' agregado a la timeline');
      } catch (error) {
        toast.error('No se pudo agregar el recurso', { description: error instanceof Error ? error.message : String(error) });
      } finally { setInserting(false); }
      return;
    }

    const resourceId = event.dataTransfer?.getData(RESOURCE_DRAG_TYPE);
    if (resourceId) {
      const fps = world.get(FrameRate)?.value ?? 30;
      const target = contextClip(world, world.get(TimelineSurface)?.pointer?.hitAt(event.clientX, event.clientY) ?? null);
      window.dispatchEvent(new CustomEvent('syka-editor-resource-drop', { detail: { id: resourceId, targetId: target?.id(), start: framesToSeconds(Math.max(0, timeline.clientToFrame(event.clientX)), fps) } }));
      return;
    }
    const lib = library();
    if (!lib) return;

    const fps = world.get(FrameRate)?.value ?? 30;
    const start = framesToSeconds(Math.max(0, timeline.clientToFrame(event.clientX)), fps);

    // Read the transfer before the first await: it is gone by the time an
    // import resolves.
    const ids = event.dataTransfer?.getData(ASSET_DRAG_TYPE)?.split(',').filter(Boolean) ?? [];
    const files = droppedFiles(event);

    const assets = ids.map((id) => lib.get(id)).filter((asset) => asset != null);
    if (files.length) assets.push(...await importFiles(lib, files, ''));
    if (!assets.length) return;

    if (!getActiveEntity(world)) {
      if (!insertAssetsInNewScene(world, assets, { start })) {
        toast("Nothing to insert into", { description: "Open a project first." });
      }
      return;
    }

    for (const asset of assets) {
      if (!insertAsset(world, asset, { start })) {
        toast("Nothing to insert into", { description: "Open a scene first." });
      }
    }
  };

  const handleDragOver = (event: DragEvent) => {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = inserting() ? 'none' : 'copy';
    if (event.dataTransfer?.types.includes(LINKED_RESOURCE_DRAG_TYPE) && library() && !inserting()) {
      const rect = (event.currentTarget as HTMLCanvasElement).getBoundingClientRect();
      const fps = world.get(FrameRate)?.value ?? 30;
      setDropPoint({ x: Math.max(0, event.clientX - rect.left), start: framesToSeconds(Math.max(0, timeline.clientToFrame(event.clientX)), fps) });
    }
  };

  return (
    <ClipContextMenu>
      <canvas
        class="absolute inset-0"
        id="timeline-canvas"
        on:drop={handleDrop}
        on:dragover={handleDragOver}
        on:dragleave={() => setDropPoint(undefined)}
        aria-busy={inserting()}
      />
      <Show when={dropPoint()}>{point => <div class="absolute top-0 bottom-0 z-10 pointer-events-none border-l-2 border-primary" style={{left:point().x+'px'}} aria-hidden="true">
        <span class="absolute top-6 rounded-md bg-card px-2 py-1 text-xxs whitespace-nowrap border border-border" style={{transform:'translateX(-50%)'}}>Soltar en {point().start.toFixed(2)} s</span>
      </div>}</Show>
    </ClipContextMenu>
  );
}
