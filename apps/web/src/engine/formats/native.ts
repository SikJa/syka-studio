import { authoredElement } from '@diffusionstudio/reconciler';
import { Computed, getAsset, getEntityChildren, Source } from '@diffusionstudio/runtime';
import type { Entity, World } from 'koota';
import { getDocumentEditor } from '../editor';
import { getEditHistory } from '../history';
import { FORMAT_PROP, SOURCE_PROP, canAdopt, detectFormat, parseDecision, planAdaptation, type FormatDecision, type LayoutNode, type Size } from './model';

export function sceneDecision(scene: Entity) { return parseDecision(authoredElement(scene)?.props[FORMAT_PROP]); }
export function sceneSize(scene: Entity): Size {
  const p = authoredElement(scene)?.props, bounds = scene.get(Computed);
  return { width: Number(p?.width ?? bounds?.width ?? 1920), height: Number(p?.height ?? bounds?.height ?? 1080) };
}
function snapshot(world: World, scene: Entity) {
  const entities = new Map<string, Entity>();
  const visit = (entity: Entity): LayoutNode | undefined => {
    const a = authoredElement(entity); if (!a) return;
    const id = entity.get(Source)?.value ?? String(entity.id());
    entities.set(id, entity);
    const b = entity.get(Computed);
    return { id, ...a, bounds: b ? { width: b.width, height: b.height } : undefined,
      children: getEntityChildren(world, entity).map(visit).filter((v): v is LayoutNode => !!v) };
  };
  const root = visit(scene)!;
  return { root, entities, signature: JSON.stringify(root) };
}
export function prepareAdaptation(world: World, scene: Entity, target: Size, fit: 'fit' | 'fill') {
  const current = snapshot(world, scene);
  return { ...planAdaptation(sceneSize(scene), target, current.root.children, fit), signature: current.signature };
}
export function applyAdaptation(world: World, scene: Entity, plan: ReturnType<typeof prepareAdaptation>, decision: FormatDecision) {
  const current = snapshot(world, scene);
  if (current.signature !== plan.signature) throw new Error('La escena cambió. Volvé a previsualizar antes de aplicar.');
  const editor = getDocumentEditor(world);
  getEditHistory(world).command(() => {
    for (const change of plan.changes) {
      const entity = current.entities.get(change.id)!;
      for (const [key, value] of Object.entries(change.props)) editor.editProperty(entity, key, value);
    }
    editor.editProperty(scene, 'width', plan.to.width);
    editor.editProperty(scene, 'height', plan.to.height);
    editor.editProperty(scene, FORMAT_PROP, JSON.stringify(decision));
  });
}
/** Asset library width/height already come from Mediabunny display dimensions. */
export function assetFormat(asset: { type?: string; width?: number; height?: number; duration?: number; rotation?: number }) {
  return detectFormat({ ...asset, dimensionsAreDisplay: true });
}
export function adoptFirstMedia(world: World, scene: Entity, asset: { type?: string; width?: number; height?: number; duration?: number; rotation?: number }) {
  const source = assetFormat(asset); if (!source) return;
  const decision = sceneDecision(scene);
  const count = getEntityChildren(world, scene).filter(e => !['solidPaint', 'audio'].includes(authoredElement(e)?.tag ?? '')).length;
  if (!canAdopt(decision, count)) return;
  const size = sceneSize(scene);
  if (decision?.initialScene && (size.width !== decision.initialScene.width || size.height !== decision.initialScene.height)) return;
  const editor = getDocumentEditor(world);
  editor.editProperty(scene, 'width', source.width);
  editor.editProperty(scene, 'height', source.height);
  editor.editProperty(scene, FORMAT_PROP, JSON.stringify({ ...decision!, source, awaitingFirstMedia: false, revision: decision!.revision + 1 }));
  return source;
}
export function firstSource(world: World, scene: Entity) {
  for (const entity of getEntityChildren(world, scene)) {
    try {
      const value = authoredElement(entity)?.props[SOURCE_PROP];
      if (typeof value === 'string') { const source = detectFormat({ ...JSON.parse(value), dimensionsAreDisplay: true }); if (source) return source; }
    } catch { /* Invalid optional metadata never changes the composition. */ }
    for (const child of [entity, ...getEntityChildren(world, entity)]) {
      const src = authoredElement(child)?.props.src;
      const asset = typeof src === 'string' ? getAsset(world, src) : undefined;
      if (asset) { const source = assetFormat(asset); if (source) return source; }
    }
  }
  return sceneDecision(scene)?.source;
}
