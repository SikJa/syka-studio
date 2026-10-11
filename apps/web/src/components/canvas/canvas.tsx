/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { useWorld } from "@diffusionstudio/koota-solid";
import { getActiveEntity, Name, Source, SceneView, findSceneAt, screenToWorld, worldToLocal, Library, Root, Background, colorToHex, getCameraMatrix, setCameraMatrix, focusEntities, focusContent } from "@diffusionstudio/runtime";
import { useDerived } from '@/engine/hooks';
import { createSignal, Show, onMount, onCleanup } from 'solid-js';
import { CanvasPreview } from '@/engine/traits';
import { isCameraLocked, setCameraLocked } from '@/engine/camera';
import { CameraController, EngineCanvas } from "@/engine";
import { insertAsset } from "@/engine/insert-asset";
import { droppedFiles, importFiles } from "@/engine/asset-actions";
import { Toolbar } from "./toolbar";
import { DrawOverlay } from "./draw-overlay";
import { toast } from "somoto"
import { SceneInitOverlay } from "./scene-init-overlay";
import { ASSET_DRAG_TYPE } from "@/components/sidebar-left/folder-item";
import { SourceStatus } from './source-status';
import { LINKED_RESOURCE_DRAG_TYPE, readLinkedResourceDrop } from '@/engine/linked-resource-drag';
import { insertLinkedResource } from '@/engine/linked-resource-actions';
import { setFullscreenChatMount } from '@/agent-chat/chat-presentation';
import { VisualTargetPicker } from './visual-target-picker';
import { visualPickMode, setVisualPickMode, handleVisualSelectShortcut } from '@/agent-chat/visual-target-state';
import { AmbientLight } from './ambient-light';

import type { Asset } from "@diffusionstudio/assets";

export function Canvas() {
  const world = useWorld();
  const sceneName = useDerived(() => getActiveEntity(world)?.get(Name)?.value || 'Video');
  const stageBackground = useDerived(() => colorToHex(world.get(Root)?.get(Background)?.value ?? 0));
  let container!: HTMLDivElement;
  let chatMount!: HTMLDivElement;
  const [fullscreen, setFullscreen] = createSignal(false);
  let previousCamera: ReturnType<typeof getCameraMatrix> | undefined;
  let previousLock = true;
  let previousSceneView: ReturnType<typeof world.get<typeof SceneView>> | undefined;
  let restoreFrame = 0;
  const restoreView = () => {
    setFullscreenChatMount(null);
    world.set(CanvasPreview, { fullscreen: false });
    setFullscreen(false);
    setCameraLocked(world, previousLock);
    const sceneView = previousSceneView;
    previousSceneView = undefined;
    if (sceneView) world.set(SceneView, sceneView);
    const camera = previousCamera;
    previousCamera = undefined;
    cancelAnimationFrame(restoreFrame);
    // ResizeObserver first restores the ordinary viewport.
    restoreFrame = requestAnimationFrame(() => {
      restoreFrame = requestAnimationFrame(() => {
        if (camera && !previousLock) setCameraMatrix(world, camera);
        else if (sceneView?.overview) focusContent(world, 28);
        else { const scene = getActiveEntity(world); if (scene) focusEntities(world, [scene], 28); }
      });
    });
  };
  const toggleFullscreen = async () => {
    if (document.fullscreenElement === container) { await document.exitFullscreen(); return; }
    const scene = getActiveEntity(world);
    if (!scene) return;
    previousCamera = [...getCameraMatrix(world)] as ReturnType<typeof getCameraMatrix>;
    previousLock = isCameraLocked(world);
    previousSceneView = {...world.get(SceneView)!};
    world.set(SceneView, {overview:false,key:scene.get(Source)?.value || String(scene.id())});
    if (!world.has(CanvasPreview)) world.add(CanvasPreview);
    world.set(CanvasPreview, { fullscreen: true });
    setCameraLocked(world, true);
    setFullscreen(true);
    try { await container.requestFullscreen(); setFullscreenChatMount(chatMount); }
    catch (error) { restoreView(); toast.error('No se pudo abrir pantalla completa', { description: String(error) }); }
  };
  onMount(() => {
    const chatSize = new ResizeObserver(() => {
      // The compact composer can gain attachments or a second line. Keep the
      // transport above it instead of letting the two interactive areas overlap.
      const composer=chatMount.querySelector<HTMLElement>('.syka-mirel-composer');
      const height=composer?.getBoundingClientRect().height??50;
      container.style.setProperty('--syka-fullscreen-composer-height',Math.min(Math.max(50,height),innerHeight*.45)+'px');
    });
    chatSize.observe(chatMount);
    const changed = () => { if (fullscreen() && document.fullscreenElement !== container) restoreView(); };
    const key = (event: KeyboardEvent) => {
      if(event.key==='Escape'&&visualPickMode()){event.preventDefault();event.stopImmediatePropagation();setVisualPickMode(null);return;}
      const target = event.target as HTMLElement | null;
      if (handleVisualSelectShortcut(event)) return;
      if (target?.closest('input, textarea, [contenteditable="true"]')) return;
      if (event.key === 'Escape' && document.fullscreenElement === container
        && !container.querySelector('[data-slot="popover-content"][data-expanded], [data-slot="dropdown-menu-content"][data-expanded]')) {
        event.preventDefault(); event.stopImmediatePropagation(); void document.exitFullscreen(); return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !event.altKey && !event.shiftKey) {
        event.preventDefault(); event.stopImmediatePropagation(); void toggleFullscreen();
      }
    };
    document.addEventListener('fullscreenchange', changed);
    document.addEventListener('keydown', key, true);
    onCleanup(() => {
      document.removeEventListener('fullscreenchange', changed);
      document.removeEventListener('keydown', key, true);
      cancelAnimationFrame(restoreFrame);
      chatSize.disconnect();
      setFullscreenChatMount(null);
      if (world.has(CanvasPreview)) world.set(CanvasPreview, { fullscreen: false });
      if (document.fullscreenElement === container) void document.exitFullscreen();
    });
  });

  /**
   * Drops onto the canvas: library assets (dragged from the panel) land where
   * they were dropped, in the scene under the pointer; external files are
   * imported into the library first, then land the same way.
   *
   * With no scene under the pointer they land loose on the stage, like an
   * element drawn there (see DrawOverlay): the drop says where, so the active
   * scene — which is somewhere else entirely — is not the answer.
   */
  const handleDropEvent = async (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const library = world.get(Library);
    if (!library) return;

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const worldPt = screenToWorld(world, event.clientX - rect.left, event.clientY - rect.top);
    const scene = world.has(SceneView) && !world.get(SceneView)?.overview ? getActiveEntity(world) : findSceneAt(world, worldPt.x, worldPt.y);
    const parent = scene ?? world.get(Root)!;
    const localPt = scene ? worldToLocal(world, scene, worldPt.x, worldPt.y) : worldPt;

    if (event.dataTransfer?.types.includes(LINKED_RESOURCE_DRAG_TYPE)) {
      const resource = readLinkedResourceDrop(event.dataTransfer);
      if (!resource) return;
      try {
        await insertLinkedResource(world, library, resource, {
          parent,
          ...(resource.kind === 'sounds' ? {} : { x: localPt.x, y: localPt.y, center: true }),
        });
        toast.success(resource.title + ' agregado a la timeline');
      } catch (error) {
        toast.error('No se pudo agregar el recurso', { description: error instanceof Error ? error.message : String(error) });
      }
      return;
    }

    const place = (asset: Asset) => {
      const size = 'width' in asset && 'height' in asset ? { width: asset.width, height: asset.height } : { width: 500, height: 150 };
      const placed = insertAsset(world, asset, {
        parent,
        x: localPt.x - size.width / 2,
        y: localPt.y - size.height / 2,
      });
      if (!placed) toast("Nothing to insert into", { description: "Open a project first." });
    };

    const assetIds = event.dataTransfer?.getData(ASSET_DRAG_TYPE)?.split(',').filter(Boolean) ?? [];
    for (const id of assetIds) {
      const asset = library.get(id);
      if (asset) place(asset);
    }

    const files = droppedFiles(event);
    if (files.length) {
      for (const asset of await importFiles(library, files, '')) place(asset);
    }
  }

  const handleDragOver = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  }

  return (
    <div ref={container} class="syka-canvas-preview relative size-full bg-background" classList={{ 'is-fullscreen': fullscreen() }} style={{'--syka-preview-stage-background':stageBackground()}}>
      <div
        class="absolute inset-0"
        on:drop={handleDropEvent}
        on:dragover={handleDragOver}
      >
        <Toolbar fullscreen={fullscreen()} onFullscreen={() => void toggleFullscreen()} portalMount={container} />
        <Show when={!fullscreen()}><div class="syka-preview-caption"><span>Vista previa</span><strong title={sceneName()}>{sceneName()}</strong></div></Show>

        <Show when={!fullscreen()}><DrawOverlay /><SceneInitOverlay /><SourceStatus /></Show>
        <div class="syka-preview-surface"><EngineCanvas /><VisualTargetPicker/></div>
        <AmbientLight fullscreen={fullscreen()}/>
        <CameraController />
      </div>
      <div ref={chatMount} class="syka-fullscreen-chat" />
    </div>
  );
}
