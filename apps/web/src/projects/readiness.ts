import { DapiError } from '@diffusionstudio/dapi';
import type { World } from 'koota';

type ReadinessGuard = (signal: AbortSignal) => Promise<void>;
const guards = new WeakMap<World, ReadinessGuard>();

/** The editor owns loading; inspection waits for it without locking playback. */
export function attachProjectReadiness(world: World, guard: ReadinessGuard): () => void {
  guards.set(world, guard);
  return () => { if (guards.get(world) === guard) guards.delete(world); };
}

/** Stop waiting without canceling the editor's normal compile or source writes. */
export function waitForProjectTask<T>(task: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const cancel = () => { cleanup(); reject(signal.reason); };
    const cleanup = () => signal.removeEventListener('abort', cancel);
    if (signal.aborted) { task.catch(() => {}); reject(signal.reason); return; }
    signal.addEventListener('abort', cancel, { once: true });
    task.then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
  });
}

/** Never certify a cached/previous render as the current source revision. */
export async function awaitProjectReady(world: World, caller: AbortSignal, timeoutMs = 4000): Promise<void> {
  const guard = guards.get(world);
  if (!guard) throw new DapiError('busy', 'El proyecto todavía está abriendo. Volvé a ejecutar check cuando termine de cargar.');
  const controller = new AbortController();
  const cancel = () => controller.abort(new DapiError('canceled', 'Se canceló la revisión del proyecto.'));
  caller.addEventListener('abort', cancel, { once: true });
  if (caller.aborted) cancel();
  const timer = setTimeout(() => controller.abort(new DapiError('busy',
    'El proyecto sigue compilando o cargando. No se revisó la versión anterior; volvé a ejecutar check en unos segundos.')), timeoutMs);
  try {
    await waitForProjectTask(guard(controller.signal), controller.signal);
  } finally {
    clearTimeout(timer);
    caller.removeEventListener('abort', cancel);
  }
}
