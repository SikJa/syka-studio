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
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { createSignal } from "solid-js";
import { toast } from "somoto";
import { trashProject } from "./shared";

import type { ProjectInfo } from "@/projects";
import { t } from '@/i18n';


type DeleteProjectDialogProps = {
  /** The project being deleted; `null` while the dialog is closed. */
  project: ProjectInfo | null;
  /** Asked for whenever the dialog should close, confirmed or not. */
  onClose(): void;
  /** The project is in the Trash — for the list that showed it to catch up. */
  onDeleted(project: ProjectInfo): void;
};

/**
 * The confirmation a project's deletion goes through. The view holds which
 * project is pending and renders this on it; the delete itself, and being
 * unclosable while it runs, are the dialog's own.
 */
export function DeleteProjectDialog(props: DeleteProjectDialogProps) {
  const [deleting, setDeleting] = createSignal(false);

  const confirm = async () => {
    const project = props.project;
    if (!project || deleting()) return;

    setDeleting(true);
    try {
      await trashProject(project);
      props.onDeleted(project);
    } catch (e) {
      toast.error("Failed to delete project", {
        description: (e as Error).message,
      });
    } finally {
      setDeleting(false);
      props.onClose();
    }
  };

  return (
    <AlertDialog
      open={props.project !== null}
      onOpenChange={(open) => {
        if (!open && !deleting()) props.onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete project</AlertDialogTitle>
          <AlertDialogDescription>
            {t('“{name}” se moverá a la papelera. ').replace('{name}', () => props.project?.displayName ?? '')}
            You can restore it from there until the Trash is emptied.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="secondary" disabled={deleting()} onClick={props.onClose}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={deleting()} onClick={confirm}>
            {deleting() ? "Deleting..." : "Delete"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
