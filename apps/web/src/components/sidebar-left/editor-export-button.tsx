import { createSignal } from 'solid-js';
import { useWorld } from '@diffusionstudio/koota-solid';
import { getActiveEntity } from '@diffusionstudio/runtime';
import { useDerived } from '@/engine/hooks';
import { useExport } from '@/context/export';
import { toast } from 'somoto';
import './editor-export-button.css';

/** The same export command used by File and the keyboard shortcut. */
export function EditorExportButton() {
  const world = useWorld();
  const scene = useDerived(() => getActiveEntity(world));
  const { exportScene, exporting } = useExport();
  const [opening, setOpening] = createSignal(false);
  const busy = () => opening() || exporting();
  const run = async () => {
    const active = scene();
    if (!active || busy()) return;
    setOpening(true);
    try { await exportScene(active); }
    catch (error) { toast.error('No se pudo exportar', { description: error instanceof Error ? error.message : String(error) }); }
    finally { setOpening(false); }
  };
  return <button type="button" class="syka-header-export" data-tour-target="export" aria-label="Exportar video" title="Exportar la escena actual" aria-busy={busy()} disabled={!scene() || busy()} onClick={() => void run()}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4m-4 4 4-4 4 4M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" /></svg>
    <span>{exporting() ? 'Exportando…' : 'Exportar'}</span>
  </button>;
}
