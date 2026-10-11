import { createEffect, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { toast } from 'somoto';
import { Button } from '@/components/ui/button';
import { editorTourVisible } from '@/components/onboarding/editor-tour-model';
import { latestPostExport, postExportVisible, postExportBusy, postExportWaiting, markPostExportOffered, dismissPostExport, preparePostExport } from '@/projects/post-export';
import './post-export-offer.css';

export function PostExportOffer(props: { projectId: string; exporting: boolean }) {
  const visible = () => postExportVisible(props.projectId) && !props.exporting && !editorTourVisible();
  createEffect(() => { if (visible()) markPostExportOffered(props.projectId); });
  const prepare = () => void preparePostExport(props.projectId).catch(error => toast.error('No se pudo preparar el pedido', { description: error.message }));
  return <Show when={latestPostExport(props.projectId)}>
    <Portal>
      <section class="syka-post-export-offer" data-open={visible()} inert={!visible()} aria-hidden={!visible()} aria-label="Después de exportar">
        <p class="text-sm font-medium">¿Preparamos portada y textos?</p>
        <p class="mt-1 text-xs text-muted-foreground">El archivo ya se guardó. Revisá el video antes de publicarlo.</p>
        <Show when={postExportWaiting(props.projectId)}>
          <p class="mt-2 text-xs text-muted-foreground">Respondé primero la pregunta pendiente del chat.</p>
        </Show>
        <div class="mt-3 flex flex-wrap items-center gap-2">
          <Button class="h-8 rounded-xl px-3 text-xs" disabled={!!postExportBusy() || postExportWaiting(props.projectId)} onClick={prepare}>
            {postExportBusy() ? 'Preparando pedido…' : 'Preparar en este chat'}
          </Button>
          <Button variant="ghost" class="h-8 rounded-xl px-3 text-xs text-muted-foreground" disabled={!!postExportBusy()} onClick={() => dismissPostExport(props.projectId)}>Ahora no</Button>
        </div>
      </section>
    </Portal>
  </Show>;
}
