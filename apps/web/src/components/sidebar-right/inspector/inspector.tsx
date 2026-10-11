/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { ControlScrollArea } from "@/components/ui/control-scrollarea";
import { Show, createMemo } from "solid-js";
import {
  ToolType,
  getParentNode,
  isAdjustmentLayer,
  isAudio,
  isCaption,
  isGroup,
  isClipPath,
  isScene,
  isSequence,
  isShape,
  isText,
} from "@diffusionstudio/runtime";
import { useAssetSelection, useSelection, useTool } from "@/engine/hooks";
import { BackgroundSettings } from "./background";
import { VariablesSettings } from "./variables";
import { SceneTemplatePanel } from "./scene-template";
import { AssetInfoPanel } from "./asset-info";
import { TimeSettings } from "./time";
import { AppearanceSettings } from "./appearance";
import { Alignment } from "./alignment";
import { FormatPanel } from "./format-panel";
import { ExportPanel, PostExportEntry } from "./export";
import { LayoutPanel } from "./layout";
import { TransformSettings } from "./transform";
import { CaptionSettings } from "./caption-settings";
import { TextPanel } from "./text";
import { FillsSettings } from "./fills";
import { StrokesSettings } from "./strokes";
import { ShadowsSettings } from "./shadows";
import { EffectsSettings } from "./effects";
import { AnimationsSettings } from "./animations";
import { TransitionSettings } from "./transition";
import { ClipPathsSettings } from "./clip-paths";
import { TrackingSettings } from "./tracking";
import { AudioSettings } from "./audio";
import { InterpolationSettings } from "./interpolation";

import type { Entity } from "koota";

export type SelectionTarget =
  | "scene-tool"
  | "keyframe"
  | "asset"
  | "scene"
  | "clip-path"
  | "sequence"
  | "caption"
  | "caption-selection"
  | "audio"
  | "adjustment"
  | "text"
  | "shape"
  | "group"
  | "stage";

function classifyNode(entity: Entity): SelectionTarget {
  if (isScene(entity)) return "scene";
  if (isClipPath(entity)) return "clip-path";
  if (isSequence(entity)) return "sequence";
  if (isCaption(entity)) return "caption";
  if (isAudio(entity)) return "audio";
  if (isAdjustmentLayer(entity)) return "adjustment";
  if (isText(entity)) return "text";
  if (isShape(entity)) return "shape";
  if (isGroup(entity)) return "group";
  return "stage";
}

export type InspectorSection = "all" | "basic" | "style" | "effects" | "animation" | "transition" | "audio";

export function Inspector(props: { section?: InspectorSection } = {}) {
  const visible = (section: InspectorSection) => !props.section || props.section === "all" || props.section === section;
  const tool = useTool();
  const { nodes, keyframes, first } = useSelection();
  const { asset, partial } = useAssetSelection();

  // For ExportPanel (root scenes only) and TransitionSettings (sequence items).
  const parent = createMemo(() => getParentNode(first()));
  const isNested = createMemo(() => parent() !== null);
  const isSequenceChild = createMemo(() => {
    const entity = parent();
    return entity !== null && isSequence(entity);
  });

  const selectionTarget = createMemo<SelectionTarget>(() => {
    if (tool() === ToolType.SCENE) return "scene-tool";
    if (keyframes().length > 0) return "keyframe";
    if (asset() || partial()) return "asset";
    if (nodes().length > 1 && nodes().every(isCaption)) return "caption-selection";
    const entity = first();
    if (nodes().length === 1 && entity) return classifyNode(entity);
    return "stage";
  });

  // Remounts the panels when the selection changes
  const selectionHash = createMemo(() => {
    return [...nodes(), ...keyframes(), asset()?.id ?? partial()?.id ?? ""].join(",") + selectionTarget();
  });

  const includesTarget = (...targets: SelectionTarget[]) => {
    return targets.includes(selectionTarget());
  };

  const sectionHasControls = () => {
    switch (props.section) {
      case 'style': return includesTarget('shape', 'text', 'scene', 'caption', 'group');
      case 'effects': return includesTarget('shape', 'text', 'scene', 'caption');
      case 'animation': return includesTarget('shape', 'text', 'caption', 'group', 'clip-path');
      case 'transition': return includesTarget('shape') && isSequenceChild();
      case 'audio': return includesTarget('shape', 'audio', 'group');
      default: return true;
    }
  };

  return (
    <div class="h-full min-h-0 flex flex-col" data-right-sidebar>
      <Show when={selectionHash()} keyed>
        <ControlScrollArea class="flex-1 min-h-0" scrollKey={selectionHash()}>
          <Show when={!sectionHasControls()}><p class="syka-panel-note px-4">Esta sección no se aplica a la selección actual. Seleccioná otro elemento o abrí Todo para ver sus controles.</p></Show>
          <Show when={visible("basic") && (includesTarget("scene-tool"))}>
            <SceneTemplatePanel />
          </Show>

          <Show when={visible("basic") && (nodes().length > 1)}>
            <Alignment />
          </Show>

          <Show when={visible("basic") && (includesTarget("scene") && !isNested())}>
            <FormatPanel scene={nodes()[0]!} />
            <ExportPanel selection={nodes()} />
          </Show>

          <Show when={visible("basic") && (includesTarget("stage"))}>
            <BackgroundSettings />
          </Show>

          <Show when={visible("basic") && (includesTarget("stage"))}>
            <VariablesSettings />
          </Show>

          <Show when={visible("basic") && (includesTarget("shape", "text", "audio", "scene", "caption", "group", "clip-path", "adjustment"))}>
            <TimeSettings selection={nodes()} />
          </Show>

          <Show when={visible("basic") && (includesTarget("shape", "text", "audio", "scene", "caption", "group", "clip-path", "adjustment"))}>
            <TransformSettings selection={nodes()} />
          </Show>

          <Show when={visible("basic") && (includesTarget("shape", "text", "audio", "scene", "clip-path"))}>
            <LayoutPanel selection={nodes()} />
          </Show>

          <Show when={visible("basic") && (includesTarget("shape", "text", "scene", "caption", "group", "audio", "clip-path"))}>
            <AppearanceSettings selection={nodes()} />
          </Show>

          <Show when={visible("basic") && (includesTarget("caption", "caption-selection"))}>
            <CaptionSettings selection={nodes()} />
          </Show>

          <Show when={visible("basic") && (includesTarget("text", "caption"))}>
            <TextPanel selection={nodes()} />
          </Show>

          <Show when={visible("style") && (includesTarget("shape", "text", "scene"))}>
            <FillsSettings selection={nodes()} />
          </Show>

          <Show when={visible("effects") && (includesTarget("shape"))}>
            <TrackingSettings selection={nodes()} />
          </Show>

          <Show when={visible("style") && (includesTarget("shape", "text", "scene", "caption"))}>
            <StrokesSettings selection={nodes()} />
          </Show>

          <Show when={visible("style") && (includesTarget("shape", "text", "scene"))}>
            <ShadowsSettings selection={nodes()} />
          </Show>

          <Show when={visible("effects") && (includesTarget("shape", "text", "scene", "caption"))}>
            <EffectsSettings selection={nodes()} />
          </Show>

          <Show when={visible("animation") && (includesTarget("shape", "text", "caption", "group", "clip-path"))}>
            <AnimationsSettings selection={nodes()} />
          </Show>

          <Show when={visible("transition") && (includesTarget("shape") && isSequenceChild())}>
            <TransitionSettings selection={nodes()} />
          </Show>

          <Show when={visible("style") && (includesTarget("shape", "text", "caption", "group"))}>
            <ClipPathsSettings selection={nodes()} />
          </Show>

          <Show when={visible("audio") && (includesTarget("shape", "audio", "group"))}>
            <AudioSettings selection={nodes()} />
          </Show>

          <Show when={visible("basic") && (includesTarget("asset"))}>
            <AssetInfoPanel />
          </Show>

          <Show when={visible("basic") && (includesTarget("keyframe"))}>
            <InterpolationSettings selection={keyframes()} />
          </Show>
        </ControlScrollArea>
      </Show>
      <PostExportEntry />
    </div>
  );
}
