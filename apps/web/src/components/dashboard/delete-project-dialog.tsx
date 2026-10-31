/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogPortal,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { createEffect, createSignal, Show } from "solid-js";
import { trashProject } from "./shared";

import type { ProjectInfo } from "@/projects";
import { t } from '@/i18n';


export type DeletableProject = Pick<ProjectInfo, 'id' | 'dir' | 'displayName'>;

type DeleteProjectDialogProps<Project extends DeletableProject> = {
  /** The project being deleted; `null` while the dialog is closed. */
  project: Project | null;
  /** Asked for whenever the dialog should close, confirmed or not. */
  onClose(): void;
  /** The project is in the Trash — for the list that showed it to catch up. */
  onDeleted(project: Project): void;
  beforeDelete?(project: Project): Promise<void>;
};

/**
 * The confirmation a project's deletion goes through. The view holds which
 * project is pending and renders this on it; the delete itself, and being
 * unclosable while it runs, are the dialog's own.
 */
export function DeleteProjectDialog<Project extends DeletableProject>(props: DeleteProjectDialogProps<Project>) {
  const [deleting, setDeleting] = createSignal(false);
  const [error, setError] = createSignal('');
  createEffect(() => { props.project?.dir; setError(''); });

  const confirm = async () => {
    const project = props.project;
    if (!project || deleting()) return;

    setDeleting(true); setError('');
    try {
      await props.beforeDelete?.(project);
      await trashProject(project);
      props.onDeleted(project);
      props.onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar el proyecto.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AlertDialog
      open={props.project !== null}
      onOpenChange={(open) => {
        if (!open && !deleting()) props.onClose();
      }}
    >
      <AlertDialogPortal><AlertDialogContent role="alertdialog" aria-label="Eliminar proyecto" class="sm:max-w-[380px]">
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminar proyecto</AlertDialogTitle>
          <AlertDialogDescription>
            {t('“{name}” se moverá a la papelera. ').replace('{name}', () => props.project?.displayName ?? '')}
            Se quitará de la lista de proyectos.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Show when={error()}><p role="alert" class="text-xs text-destructive">{error()}</p></Show>
        <AlertDialogFooter>
          <Button variant="secondary" disabled={deleting()} onClick={props.onClose}>
            Cancelar
          </Button>
          <Button variant="destructive" disabled={deleting()} onClick={confirm}>
            {deleting() ? "Eliminando…" : "Eliminar"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent></AlertDialogPortal>
    </AlertDialog>
  );
}
