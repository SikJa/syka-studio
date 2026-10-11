import { createSignal, For, Show } from 'solid-js';
import { visualNotes, editVisualNote, removeVisualNote } from './visual-review-state';
import { PreviewIcon } from '@/components/canvas/preview-icon';
import './visual-review-tray.css';

export function VisualReviewTray(props: { chatKey: string; disabled: boolean; submitting: boolean; onSend(): void }) {
  const [expanded, setExpanded] = createSignal(true);
  // Use the chat's send path: it snapshots notes, retains them on failure and
  // removes them only once the host accepts the message.
  const send = () => { if (!props.disabled && visualNotes(props.chatKey).length) props.onSend(); };
  return <Show when={visualNotes(props.chatKey).length}>
    <section class="syka-visual-review t-panel-slide" data-open="true" data-expanded={expanded()} aria-label="Notas sobre el video">
      <header><button class="syka-review-toggle" onClick={() => setExpanded(!expanded())} aria-expanded={expanded()} aria-label={expanded()?'Contraer notas sobre el video':'Expandir notas sobre el video'}><PreviewIcon name="comment"/><span>{visualNotes(props.chatKey).length} {visualNotes(props.chatKey).length === 1 ? 'nota sobre el video' : 'notas sobre el video'}</span><span class="syka-review-toggle-hint">{expanded()?'Contraer':'Expandir'}</span><PreviewIcon name="chevron"/></button>
        <button class="syka-review-apply" disabled={props.disabled} onClick={send}>{props.submitting ? 'Enviando…' : 'Enviar notas'} <PreviewIcon name="chat"/></button></header>
      <div class="syka-review-collapse t-accordion" inert={!expanded()} aria-hidden={!expanded()}><div class="syka-review-items"><For each={visualNotes(props.chatKey)}>{note => <article>
        <Show when={note.preview}><img src={note.preview} alt="Referencia de la nota"/></Show>
        <div><label for={'visual-note-' + note.id}>{note.title}<small>{Number(note.context.timeSeconds ?? 0).toFixed(2)} s</small></label><textarea id={'visual-note-' + note.id} aria-label={'Editar nota: ' + note.title} placeholder="Indicación opcional" value={note.instruction} disabled={props.submitting} onInput={event => editVisualNote(props.chatKey, note.id, event.currentTarget.value)} rows="2"/></div>
        <button class="syka-review-remove" disabled={props.submitting} aria-label={'Quitar nota: ' + note.title} title="Quitar nota" onClick={() => removeVisualNote(props.chatKey, note.id)}><PreviewIcon name="close"/></button>
      </article>}</For></div></div>
    </section>
  </Show>;
}
