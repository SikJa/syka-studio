import type { Entity } from 'koota';
import { computeOutputSize } from '@diffusionstudio/encoder';
import { sceneConfigKey, type ExportConfig } from '../project-config';
import { sceneDecision, sceneSize } from './native';
import { formatOutput } from './model';
/** Read at export time. Consumers must attach an actual successful file separately. */
export function sceneFormatOutput(scene: Entity, config?: ExportConfig) {
  const size = sceneSize(scene);
  return { ...formatOutput(sceneConfigKey(scene) ?? String(scene.id()), size, sceneDecision(scene)),
    output: computeOutputSize(size.width, size.height, config?.video?.resolution ?? 1080),
    publicationStatus: 'draft' as const };
}
