import { Computed, FrameRate, getActiveEntity, Library, Root, Source, store } from '@diffusionstudio/runtime';
import type { AssetLibrary } from '@diffusionstudio/assets';
import type { Entity, World } from 'koota';
import { insertAsset, type InsertAssetOptions } from './insert-asset';
import { insertAssetsInNewScene } from './new-scene';
import { linkedResourceVolume, type LinkedResource } from './linked-resource-drag';
import { getEditHistory } from './history';

/** Click and drop share copying, gains, selection and the native editable insertion. */
export async function insertLinkedResource(
  world: World, library: AssetLibrary, resource: LinkedResource, options: InsertAssetOptions & { center?: boolean } = {},
): Promise<void> {
  if (resource.kind === 'motions' && resource.componentPath)
    throw Error('Arrastrá este motion al chat o elegí «Usar con el agente» para agregarlo editable.');
  const root = world.get(Root);
  const source = root?.get(Source)?.value;
  const scene = getActiveEntity(world);
  const parent = options.parent ?? scene;
  const start = options.start ?? (parent ? store(world, Computed).localTimeInSeconds[parent.id()] ?? 0 : 0);
  const fps = world.get(FrameRate)?.value ?? 30;
  if (!root || !source) throw Error('Abrí un proyecto para agregar recursos.');
  if (!Number.isFinite(start) || start < 0 || !Number.isSafeInteger(Math.round(start * fps)))
    throw Error('El tiempo de inserción no es válido.');
  const report = await library.import([resource.path], { folder: resource.kind, copy: true });
  if (report.failed.length) throw report.failed[0].error;
  const asset = report.assets[0];
  if (!asset) throw Error('No se pudo importar el recurso.');
  // An import may outlive its project or scene. Never insert into a new selection.
  if (world.get(Library) !== library || world.get(Root) !== root || root.get(Source)?.value !== source
    || getActiveEntity(world) !== scene || (parent && !parent.isAlive())) {
    throw Error('Cambió el proyecto o la escena. El recurso quedó importado; volvé a insertarlo.');
  }
  const position = options.center && options.x !== undefined && options.y !== undefined
    ? { x: options.x - ('width' in asset ? asset.width : 500) / 2,
        y: options.y - ('height' in asset ? asset.height : 150) / 2 } : {};
  const placement = { ...options, ...position, start, label: resource.title, volume: linkedResourceVolume(resource) };
  const inserted: Entity | null = getEditHistory(world).command(() => parent
    ? insertAsset(world, asset, { ...placement, parent })
    : insertAssetsInNewScene(world, [asset], placement));
  if (!inserted) throw Error('No se pudo insertar el recurso en la escena.');
}
