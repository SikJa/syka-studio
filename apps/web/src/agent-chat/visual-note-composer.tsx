import { createEffect, onCleanup, onMount } from 'solid-js';
import { createRoot, type Root } from '@/lib/react-root';
import { t } from '@/i18n';
import { createElement } from 'react';
import { AgentComposer } from '@/mirel-chat/features/agents/agent-composer';
import './mirel-adapter.css';

/** Local review note using the exact chat composer and Groq dictation lifecycle. */
export function VisualNoteComposer(props: {
  value: string;
  disabled: boolean;
  hasCapture: boolean;
  contextKey: string;
  onChange(value: string): void;
  onSubmit(): void;
}) {
  let element!: HTMLDivElement;
  let root: Root | undefined;
  onMount(() => {
    root = createRoot(element);
    createEffect(() => root?.render(createElement(AgentComposer, {
      value: props.value, onChange: props.onChange, onSubmit: props.onSubmit,
      placeholder: t('Añadí una indicación (opcional)'), ariaLabel: t('Qué mejorar de esta referencia'),
      disabled: props.disabled, hasContext: props.hasCapture, variant: 'reference', submitLabel: t('Añadir a revisión'),
      dictationContext: props.contextKey, maxRows: 2, className: 'syka-visual-note-composer',
    })));
  });
  onCleanup(() => root?.unmount());
  return <div ref={element} class="syka-visual-note-input syka-mirel-composer"/>;
}
