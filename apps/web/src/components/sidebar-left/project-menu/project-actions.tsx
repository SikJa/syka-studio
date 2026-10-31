/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { createSignal, Show } from 'solid-js';
import { toast } from 'somoto';
import { chatState } from '@/agent-chat/store';
import { useProject } from '@/context/project';
import { drainProjectEdits } from '@/projects/edits';
import { createProjectTrial, duplicateProject, listProjects, renameProject } from '@/projects';
import { useNavigate } from '@solidjs/router';
import { projectRoute } from '@/hooks/use-project-route';
import { useLibrary } from '@/engine/library';
import { renderOverlay } from '@/context/render';
import { openProjectFromList } from '@/components/dashboard/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogPortal, DialogTitle } from '@/components/ui/dialog';
import type { SwitcherProject } from './projects-menu';

export type ProjectActionTarget = { project: SwitcherProject; x: number; y: number };
const working = (entry: SwitcherProject) => chatState.lists[entry.id || entry.name]?.some(chat => chat.status === 'running' || chat.status === 'waiting') === true;

/** Lives beside the main menu so closing its submenu cannot dismiss the dialog. */
export function ProjectActions(props: { target: ProjectActionTarget | null; onClose(): void; onDelete(project: SwitcherProject): void }) {
  const project = useProject();
  const library = useLibrary();
  const navigate = useNavigate();
  const [trialBusy, setTrialBusy] = createSignal(false);
  const [trialError, setTrialError] = createSignal('');
  const trialAction = async (entry: SwitcherProject, original = false) => {
    if (trialBusy()) return;
    setTrialBusy(true); setTrialError('');
    try {
      if (renderOverlay() || working(entry)) throw Error('Esperá a que termine la exportación o el turno de este proyecto.');
      await library()?.flush();
      await drainProjectEdits(project.dir());
      await drainProjectEdits(entry.dir);
      const origin = original ? (await listProjects()).find(p => p.id === entry.trialOf?.id) : undefined;
      const next = original ? origin && await openProjectFromList(origin) : await createProjectTrial(entry.dir);
      if (!next) throw Error('No encontramos el proyecto de origen en la lista.');
      props.onClose(); navigate(projectRoute(next.id));
    } catch (error) { setTrialError(error instanceof Error ? error.message : String(error)); }
    finally { setTrialBusy(false); }
  };
  const [renaming, setRenaming] = createSignal<SwitcherProject | null>(null);
  const [duplicating, setDuplicating] = createSignal(false);
  const duplicate = async (entry: SwitcherProject) => {
    if (duplicating()) return;
    setDuplicating(true); props.onClose();
    try {
      await drainProjectEdits(entry.dir);
      const copy = await duplicateProject(entry.dir);
      toast.success('Proyecto duplicado', { description: copy.displayName });
    } catch (error) { toast.error('No se pudo duplicar el proyecto', { description: error instanceof Error ? error.message : String(error) }); }
    finally { setDuplicating(false); }
  };
  return <>
    <Dialog open={!!props.target} onOpenChange={open => { if (!open && !trialBusy()) { setTrialError(''); props.onClose(); } }}>
      <DialogPortal>
        <DialogContent role="dialog" aria-label="Acciones del proyecto" class="sm:max-w-[340px]" showCloseButton={!trialBusy()}>
          <DialogTitle>{props.target?.project.displayName ?? 'Proyecto'}</DialogTitle>
          <DialogDescription>Elegí qué querés hacer con este proyecto.</DialogDescription>
          <div class="flex flex-col gap-2">
          <Button variant="secondary" disabled={trialBusy() || !props.target || !!props.target && working(props.target.project)} onClick={() => { const entry = props.target?.project; if (entry) void trialAction(entry); }}>{trialBusy() ? 'Preparando versión…' : 'Crear versión de prueba'}</Button>
          <p class="text-xs text-muted-foreground">Edición independiente con archivos propios. La original se conserva.</p>
          <Show when={props.target?.project.trialOf}><Button variant="ghost" disabled={trialBusy()} onClick={() => { const entry = props.target?.project; if (entry) void trialAction(entry, true); }}>Abrir proyecto de origen</Button></Show>
          <Show when={trialError()}><p role="alert" class="text-xs text-destructive">{trialError()}</p></Show>
          <Button variant="secondary" disabled={trialBusy() || !props.target || !!props.target && working(props.target.project)} onClick={() => {
            const entry = props.target?.project;
            if (entry) setRenaming(entry);
            props.onClose();
          }}>Renombrar</Button>
          <Button variant="secondary" disabled={trialBusy() || duplicating() || !props.target} onClick={() => { const entry = props.target?.project; if (entry) void duplicate(entry); }}>Duplicar</Button>
          <Button variant="destructive" disabled={trialBusy() || !props.target} onClick={() => {
            const entry = props.target?.project; if (entry) props.onDelete(entry); props.onClose();
          }}>Eliminar</Button>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
    <Show when={renaming()} keyed>{entry => <RenameProjectDialog entry={entry} onClose={() => setRenaming(null)} onSave={async name => {
      if (working(entry)) throw Error('Esperá a que termine el turno de este proyecto para renombrarlo.');
      await drainProjectEdits(entry.dir);
      if ((entry.id || entry.name) === project.id()) await project.rename(name);
      else await renameProject(entry.dir, name);
    }} />}</Show>
  </>;
}

export function RenameProjectDialog(props: { entry: SwitcherProject; onClose(): void; onSave(name: string): Promise<void> }) {
  const [name, setName] = createSignal(props.entry.displayName);
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal('');
  const save = async (event: SubmitEvent) => {
    event.preventDefault();
    const value = name().trim();
    if (!value || saving()) return;
    if (value === props.entry.displayName) { props.onClose(); return; }
    setSaving(true); setError('');
    try { await props.onSave(value); props.onClose(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setSaving(false); }
  };
  return <Dialog open onOpenChange={open => { if (!open && !saving()) props.onClose(); }}>
    <DialogPortal><DialogContent role="dialog" aria-label="Renombrar proyecto" class="sm:max-w-[360px]" showCloseButton={!saving()}>
      <DialogTitle>Renombrar proyecto</DialogTitle>
      <DialogDescription>{props.entry.displayName}</DialogDescription>
      <form class="flex flex-col gap-4" onSubmit={save}>
        <label class="flex flex-col gap-2 text-xs">Nombre del proyecto
          <input autofocus required maxLength={240} value={name()} disabled={saving()} onInput={event => setName(event.currentTarget.value)}
            onFocus={event => event.currentTarget.select()} class="h-8 rounded-md border border-border-input bg-transparent px-2 text-sm outline-none focus-ring" />
        </label>
        <Show when={error()}><p role="alert" class="text-xs text-destructive">{error()}</p></Show>
        <div class="flex justify-end gap-2">
          <Button type="button" variant="ghost" disabled={saving()} onClick={props.onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving() || !name().trim()}>{saving() ? 'Guardando…' : 'Guardar'}</Button>
        </div>
      </form>
    </DialogContent></DialogPortal>
  </Dialog>;
}
