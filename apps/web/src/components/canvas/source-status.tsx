/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { createSignal, For, Show } from 'solid-js';
import { useWorld } from '@diffusionstudio/koota-solid';
import { getActiveEntity, getSceneAncestor, SourceError } from '@diffusionstudio/runtime';
import { authoredElement } from '@diffusionstudio/reconciler';
import { pickFiles, importFiles } from '@/engine/asset-actions';
import { useLibrary } from '@/engine/library';
import { useDerived } from '@/engine/hooks/use-derived';
import { getDocumentEditor } from '@/engine/editor';
import { getEditHistory } from '@/engine/history';
import { toast } from 'somoto';

/** An unresolved source must be actionable, not look like a silent black video. */
export function SourceStatus() {
  const world = useWorld();
  const library = useLibrary();
  const [busy, setBusy] = createSignal(false);
  const failures = () => world.query(SourceError).filter(entity =>
    getSceneAncestor(entity) === getActiveEntity(world) &&
    typeof authoredElement(entity)?.props.src === 'string');
  const sources = useDerived(() => [...new Set(failures().map(entity =>
    authoredElement(entity)!.props.src as string))].sort(),
    (a, b) => a.length === b.length && a.every((value, i) => value === b[i]));

  async function relink(source: string) {
    const lib = library();
    if (!lib || busy()) return;
    setBusy(true);
    try {
      const files = await pickFiles({ multiple: false });
      if (!files.length) return;
      const [asset] = await importFiles(lib, files, 'Recuperados');
      if (!asset) return;
      // Persist the asset first. A src must never point at an unsaved entry.
      await lib.flush();
      const targets = failures().filter(entity => authoredElement(entity)?.props.src === source);
      if (!targets.length) return;
      const editor = getDocumentEditor(world);
      getEditHistory(world).command(() => {
        for (const target of targets) editor.editProperty(target, 'src', asset.path);
      });
      toast.success('Medio reenlazado', { description: 'Podés deshacer este cambio desde la timeline.' });
    } catch (error) {
      toast.error('No se pudo reenlazar el medio', { description: String(error instanceof Error ? error.message : error) });
    } finally { setBusy(false); }
  }

  return <Show when={sources().length}>
    <details class="absolute left-3 top-3 z-20 max-w-[calc(100%-24px)] rounded-md border border-amber-500/30 bg-background/95 px-3 py-2 text-xs shadow-md" aria-label="Medios no disponibles">
      <summary class="cursor-pointer text-amber-300">{sources().length} {sources().length === 1 ? 'medio no disponible' : 'medios no disponibles'} · Reenlazar</summary>
      <p class="mt-2 max-w-sm text-muted-foreground">El archivo falta o no se pudo abrir. Elegí su ubicación para recuperar la imagen.</p>
      <For each={sources()}>{source => <div class="mt-2 flex items-center gap-3">
        <span class="max-w-xs truncate" title={source}>{source}</span>
        <button class="ml-auto shrink-0 rounded border px-2 py-1 hover:bg-secondary disabled:opacity-50" disabled={busy()} onClick={() => void relink(source)} aria-label={`Reenlazar ${source}`}>Reenlazar</button>
      </div>}</For>
    </details>
  </Show>;
}
