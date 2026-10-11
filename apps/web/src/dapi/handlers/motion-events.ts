import { FrameRate, Source, Workarea, getActiveEntity, resolveMotionEvents } from '@diffusionstudio/runtime';
import type { ToolHandler } from '../handler';
import { requireScene } from '../lib/scene';

export const motionEvents: ToolHandler<'motion_events'> = async (args, ctx) => {
  const session = ctx.session();
  if (!session) throw Error('Abrí un proyecto para resolver sus eventos.');
  const id = args.id ?? getActiveEntity(session.world)?.get(Source)?.value;
  if (!id) throw Error('Elegí una escena para resolver sus eventos.');
  const scene = requireScene(session.world, id, 'motion_events'), frameRate = session.world.get(FrameRate)?.value ?? 30;
  return { projectDir: session.project.dir(), composition: scene.get(Source)?.value ?? null, frameRate,
    exportStartSeconds: (scene.get(Workarea)?.start ?? 0) / frameRate,
    events: resolveMotionEvents(session.world, args.events, scene) };
};
