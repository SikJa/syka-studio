/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { For, Show, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { MAIN_CHANNELS, type SykaGlossary, type SykaGlossaryEntry } from "@desktop/main-channels";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Switch, SwitchControl, SwitchInput, SwitchThumb } from "@/components/ui/switch";
import { TextField, TextFieldInput, TextFieldLabel, TextFieldTextArea } from "@/components/ui/text-field";
import { mainBridge } from "@/lib/ipc";
import { DashboardScrollView, DashboardSurfaceSection } from "./shared";
import { glossaryEntryFromDraft, matchingGlossaryEntries } from "./glossary-model";

export function DashboardGlossaryView() {
  const [glossary, setGlossary] = createSignal<SykaGlossary | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal("");
  const [status, setStatus] = createSignal("");
  const [search, setSearch] = createSignal("");
  const [formOpen, setFormOpen] = createSignal(false);
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [term, setTerm] = createSignal("");
  const [variantsText, setVariantsText] = createSignal("");
  const [formError, setFormError] = createSignal("");
  let disposed = false;
  onCleanup(() => { disposed = true; });
  const entries = () => glossary()?.entries ?? [];
  const matches = createMemo(() => matchingGlossaryEntries(entries(), search()));
  const disabled = () => loading() || saving() || !glossary();

  const load = async () => {
    if (!window.desktop) { setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const result = await mainBridge.call(MAIN_CHANNELS.SYKA_GLOSSARY_GET, undefined);
      if (!disposed) { setGlossary(result); setStatus("Guardado localmente"); }
    } catch (reason) {
      if (!disposed) setError(reason instanceof Error ? reason.message : "No se pudo leer el glosario local.");
    } finally { if (!disposed) setLoading(false); }
  };
  onMount(() => void load());

  const saveEntries = async (next: SykaGlossaryEntry[], message: string): Promise<boolean> => {
    const current = glossary();
    if (!current || saving()) return false;
    setSaving(true);
    setError("");
    setStatus("Guardando…");
    try {
      const result = await mainBridge.call(MAIN_CHANNELS.SYKA_GLOSSARY_SAVE, { expectedRevision: current.revision, entries: next });
      if (disposed) return false;
      setGlossary(result);
      setStatus(`${message} · guardado localmente`);
      return true;
    } catch (reason) {
      if (!disposed) { setError(reason instanceof Error ? reason.message : "No se pudo guardar el glosario."); setStatus("El cambio no se guardó"); }
      return false;
    } finally { if (!disposed) setSaving(false); }
  };

  const closeForm = () => { setFormOpen(false); setEditingId(null); setTerm(""); setVariantsText(""); setFormError(""); };
  const openForm = (entry?: SykaGlossaryEntry) => {
    setEditingId(entry?.id ?? null);
    setTerm(entry?.term ?? "");
    setVariantsText(entry?.variants.join("\n") ?? "");
    setFormError("");
    setFormOpen(true);
  };
  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    if (disabled()) return;
    setFormError("");
    const id = editingId();
    const original = id ? entries().find(entry => entry.id === id) : undefined;
    try {
      if (id && !original) throw new Error("Este término ya no existe. Cancelá la edición y agregalo como uno nuevo.");
      if (!id && entries().length >= 200) throw new Error("El glosario admite hasta 200 términos.");
      const next = glossaryEntryFromDraft({ id: id ?? crypto.randomUUID(), term: term(), variantsText: variantsText(), enabled: original?.enabled ?? true });
      const updated = id ? entries().map(entry => entry.id === id ? next : entry) : [...entries(), next];
      if (await saveEntries(updated, id ? "Término actualizado" : "Término agregado")) closeForm();
    } catch (reason) { setFormError(reason instanceof Error ? reason.message : "Revisá el término y sus variantes."); }
  };
  const remove = async (entry: SykaGlossaryEntry) => {
    if (await saveEntries(entries().filter(current => current.id !== entry.id), "Término eliminado")) {
      if (editingId() === entry.id) closeForm();
    }
  };

  return (
    <DashboardScrollView>
      <DashboardSurfaceSection title="Glosario" description="Tus nombres, marcas y términos, escritos como vos querés. Se aplica a las transcripciones nuevas.">
        <Show when={window.desktop} fallback={<p class="text-xs text-muted-foreground">El glosario local está disponible en la aplicación de escritorio.</p>}>
          <div class="flex items-center justify-between gap-3">
            <p class="text-xs text-muted-foreground" role="status" aria-live="polite">{loading() ? "Cargando glosario…" : status()}</p>
            <span class="shrink-0 text-xxs text-muted-foreground">{entries().length} / 200 términos</span>
          </div>
          <Show when={error()}>
            <div class="flex items-start justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3">
              <p class="text-xs text-destructive" role="alert">{error()} {formOpen() ? "Tus cambios sin guardar siguen en el formulario." : "El cambio no se guardó."}</p>
              <Button type="button" variant="secondary" disabled={loading() || saving()} onClick={() => void load()}>Recargar</Button>
            </div>
          </Show>
          <div class="flex items-center gap-2">
            <TextField value={search()} onChange={setSearch} class="flex-1">
              <TextFieldInput aria-label="Buscar en el glosario" placeholder="Buscar término o variante" uiSize="compact" />
            </TextField>
            <Button type="button" variant="secondary" disabled={disabled() || formOpen() || entries().length >= 200} onClick={() => openForm()}><Icon name="plus-add-small" class="mr-1 size-4" />Agregar término</Button>
          </div>
          <Show when={formOpen()}>
            <form class="flex flex-col gap-3 rounded-lg border border-border bg-background/30 p-3" onSubmit={event => void submit(event)} aria-label={editingId() ? "Editar término" : "Nuevo término"}>
              <div class="flex items-center justify-between gap-3"><p class="text-xs font-450">{editingId() ? "Editar término" : "Nuevo término"}</p><span class="text-xxs text-muted-foreground">Cambios sin guardar</span></div>
              <div class="grid gap-3 sm:grid-cols-2">
                <TextField value={term()} onChange={setTerm} disabled={saving()}>
                  <TextFieldLabel uiSize="compact">Término preferido</TextFieldLabel>
                  <TextFieldInput placeholder="Syka" uiSize="compact" autofocus />
                </TextField>
                <TextField value={variantsText()} onChange={setVariantsText} disabled={saving()}>
                  <TextFieldLabel uiSize="compact">Variantes o correcciones</TextFieldLabel>
                  <TextFieldTextArea class="min-h-20 text-xs" placeholder={"Sica\nZika"} rows={3} />
                  <p class="text-xxs text-muted-foreground">Una variante por línea. Opcional; hasta 12.</p>
                </TextField>
              </div>
              <Show when={formError()}><p role="alert" class="text-xs text-destructive">{formError()}</p></Show>
              <div class="flex items-center gap-2">
                <Button type="submit" disabled={disabled()}>{saving() ? "Guardando…" : editingId() ? "Guardar término" : "Guardar nuevo término"}</Button>
                <Button type="button" variant="ghost" disabled={saving()} onClick={closeForm}>Cancelar</Button>
              </div>
            </form>
          </Show>
          <Show when={!loading() && glossary()}>
            <div class="flex flex-col divide-y divide-border" aria-label="Términos guardados">
              <For each={matches()}>{entry => (
                <div class="flex flex-wrap items-center gap-x-3 gap-y-2 py-3" data-glossary-entry={entry.id}>
                  <div class="min-w-32 flex-1"><p class="text-xs font-450 break-words" classList={{ "text-muted-foreground": !entry.enabled }}>{entry.term}</p><p class="mt-1 text-xxs text-muted-foreground break-words">{entry.variants.length ? `${entry.variants.join(" · ")} → ${entry.term}` : "Término preferido, sin variantes"}</p></div>
                  <Switch checked={entry.enabled} disabled={disabled()} onChange={enabled => void saveEntries(entries().map(current => current.id === entry.id ? { ...current, enabled } : current), enabled ? "Término activado" : "Término desactivado")}>
                    <SwitchInput aria-label={`Activar ${entry.term}`} /><SwitchControl variant="compact"><SwitchThumb variant="compact" /></SwitchControl>
                  </Switch>
                  <Button type="button" variant="ghost" size="small" aria-label={`Editar ${entry.term}`} disabled={disabled() || formOpen()} onClick={() => openForm(entry)}>Editar</Button>
                  <Button type="button" variant="ghost" size="small" aria-label={`Eliminar ${entry.term}`} disabled={disabled()} onClick={() => void remove(entry)}>Eliminar</Button>
                </div>
              )}</For>
              <Show when={!matches().length}><p class="py-6 text-center text-xs text-muted-foreground">{search().trim() ? "No hay términos que coincidan con la búsqueda." : "Agregá tu primer término. Por ejemplo, «Syka» y las variantes «Sica» o «Zika»."}</p></Show>
            </div>
          </Show>
          <p class="border-t border-border pt-3 text-xxs text-muted-foreground">Ayuda a reconocer los términos activos y corrige sus variantes indicadas. Las transcripciones que ya guardaste se conservan.</p>
        </Show>
      </DashboardSurfaceSection>
    </DashboardScrollView>
  );
}
