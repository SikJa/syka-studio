import { For, Show, type JSX } from 'solid-js';
import { Dialog, DialogPortal, DialogContent, DialogTitle, DialogCloseButton } from '@/components/ui/dialog';
import { PreviewIcon } from '@/components/canvas/preview-icon';

export function LibraryPagination(props: { total: number; offset: number; size: number; busy?: boolean; onPage(offset: number): void }) {
  const pages = () => Math.max(1, Math.ceil(props.total / props.size));
  const current = () => Math.floor(props.offset / props.size);
  const visible = () => { const start = Math.max(0,Math.min(current()-2,pages()-5)); return Array.from({length:Math.min(5,pages())},(_,i)=>start+i); };
  return <Show when={props.total>0}><nav class="syka-library-pagination" aria-label="Páginas de la biblioteca">
    <span>{props.total} resultados</span>
    <div><button aria-label="Página anterior" disabled={props.busy||current()===0} onClick={()=>props.onPage((current()-1)*props.size)}>‹</button>
    <For each={visible()}>{page=><button aria-label={'Página '+(page+1)} aria-current={current()===page?'page':undefined} disabled={props.busy} onClick={()=>props.onPage(page*props.size)}>{page+1}</button>}</For>
    <button aria-label="Página siguiente" disabled={props.busy||current()+1>=pages()} onClick={()=>props.onPage((current()+1)*props.size)}>›</button></div>
    <small>Página {current()+1} de {pages()}</small>
  </nav></Show>;
}

export function LibraryPreview(props: { open: boolean; title: string; onClose(): void; children: JSX.Element; footer?: JSX.Element; gallery?: boolean }) {
  return <Dialog open={props.open} onOpenChange={open=>{if(!open)props.onClose();}}><DialogPortal>
    <DialogContent class={'syka-library-preview '+(props.gallery?'syka-library-gallery':'')} showCloseButton={false} onKeyDown={event=>event.stopPropagation()}>
      <header><DialogTitle>{props.title}</DialogTitle><DialogCloseButton aria-label="Cerrar vista ampliada"><PreviewIcon name="close"/></DialogCloseButton></header>
      <div class="syka-library-preview-body">{props.children}</div>
      <Show when={props.footer}><footer>{props.footer}</footer></Show>
    </DialogContent>
  </DialogPortal></Dialog>;
}

export function LibrarySelection(props: { title: string; children: JSX.Element; onClose(): void }) {
  return <section class="syka-library-selection" aria-label="Recurso seleccionado">
    <header><strong>{props.title}</strong><button aria-label="Quitar selección" onClick={props.onClose}><PreviewIcon name="close"/></button></header>
    <div>{props.children}</div>
  </section>;
}
