import { createSignal } from 'solid-js';
import { toast } from 'somoto';
import { MAIN_CHANNELS } from '@desktop/main-channels';
import { mainBridge } from '@/lib/ipc';
import { getEditHistory } from '@/engine/history';
import type { World } from 'koota';

/** The desktop journal is authoritative across source edits and manual batches. */
export function attachProjectHistory(world: World, dir: string, writer: {
  drain(): Promise<void>;
  pending(): boolean;
  reload(): Promise<void>;
}): () => void {
  if (typeof window === 'undefined' || !window.desktop) return () => {};
  const [status, setStatus] = createSignal({ canUndo: false, canRedo: false });
  const [busy, setBusy] = createSignal(false);
  const [problem, setProblem] = createSignal<string | undefined>('Cargando el historial del proyecto…');
  let disposed = false;
  let generation = 0;
  let lastNotifiedProblem: string | undefined;
  const blockEditing = (event: Event) => {
    if (busy()) { event.preventDefault(); event.stopImmediatePropagation(); }
  };
  document.addEventListener('keydown', blockEditing, true);
  document.addEventListener('beforeinput', blockEditing, true);
  const refresh = async () => {
    const request = ++generation;
    try {
      const result = await mainBridge.call(MAIN_CHANNELS.SYKA_EDIT_HISTORY_STATUS, { dir });
      if (disposed || request !== generation) return;
      if (!result.ok) throw new Error(result.error);
      setProblem(undefined);
      lastNotifiedProblem = undefined;
      setStatus(result);
    } catch (error) {
      if (disposed || request !== generation) return;
      const description = error instanceof Error ? error.message : String(error);
      setStatus({ canUndo: false, canRedo: false });
      setProblem(description);
      if (lastNotifiedProblem !== description) {
        lastNotifiedProblem = description;
        toast.error('Historial bloqueado: se preservó el archivo actual', { description });
      }
    }
  };
  const restore = async (direction: 'undo' | 'redo') => {
    if (busy() || disposed || problem()) return;
    setBusy(true);
    ++generation;
    try {
      await writer.drain();
      if (disposed) return;
      const result = await mainBridge.call(direction === 'undo' ? MAIN_CHANNELS.SYKA_EDIT_HISTORY_UNDO : MAIN_CHANNELS.SYKA_EDIT_HISTORY_REDO, { dir });
      if (!result.ok) throw new Error(result.error);
      if (disposed) return;
      setStatus(result);
      await writer.reload();
    } catch (error) {
      if (!disposed) toast.error('No se pudo restaurar el cambio', { description: error instanceof Error ? error.message : String(error) });
    } finally {
      if (!disposed) { await refresh(); setBusy(false); }
    }
  };
  const unbind = getEditHistory(world).bindBackend({
    problem,
    canUndo: () => !problem() && (status().canUndo || writer.pending()),
    canRedo: () => !problem() && !writer.pending() && status().canRedo,
    busy,
    refresh,
    undo: () => { void restore('undo'); },
    redo: () => { void restore('redo'); },
  });
  void refresh();
  return () => {
    disposed = true; ++generation; unbind();
    document.removeEventListener('keydown', blockEditing, true);
    document.removeEventListener('beforeinput', blockEditing, true);
  };
}
