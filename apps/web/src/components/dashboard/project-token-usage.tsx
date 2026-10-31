/* MPL-2.0. Compact project usage with a provider/model breakdown on hover. */
import { createEffect, For, onCleanup, Show } from 'solid-js';
import { HARNESS_LABELS } from '@diffusionstudio/agent-chat';
import { compactTokens, exactTokens, observeProjectUsage, projectUsage, projectUsageError } from '@/agent-chat/project-usage';
import { Tooltip, TooltipContent, TooltipPortal, TooltipTrigger } from '@/components/ui/tooltip';
import { t } from '@/i18n';

export function ProjectTokenUsageLabel(props: { projectId: string }) {
  createEffect(() => { onCleanup(observeProjectUsage(props.projectId)); });
  const usage = () => projectUsage(props.projectId);
  const known = () => !!usage()?.models.length;
  const label = () => known() ? compactTokens(usage()!.tokens.totalTokens) : projectUsageError(props.projectId) ? 'Consumo: sin conexión' : !usage() ? 'Consultando consumo…' : usage()?.activity?.chats === 0 ? 'Sin chat asociado' : 'Consumo no reportado';
  return (
    <Tooltip openDelay={250}>
      <TooltipTrigger as="span" class="shrink-0 text-[11px] tabular-nums text-muted-foreground" aria-label={label()}>
        {label()}
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent class="block max-w-80 p-3 text-left font-normal">
          <p class="font-medium">Consumo del proyecto</p>
          <Show when={known()} fallback={<p class="mt-1 text-muted-foreground">{projectUsageError(props.projectId) ? 'No se pudo consultar el registro de consumo. Se reintentará al reconectar.' : usage()?.activity?.chats === 0 ? 'Este proyecto no tiene una conversación asociada en Syka. Las copias y las ediciones realizadas desde otro agente no transfieren automáticamente sus contadores.' : 'El proveedor todavía no reportó métricas para esta conversación, o el historial anterior no conserva esos datos. No se estima el consumo.'}</p>}>
            <p class="mt-1 font-medium tabular-nums">{exactTokens(usage()!.tokens.totalTokens)} tokens reportados</p>
            <div class="mt-2 space-y-1 border-t border-border pt-2">
              <For each={usage()?.models}>{entry => (
                <div class="flex min-w-0 items-start justify-between gap-3">
                  <span class="min-w-0 break-words">{HARNESS_LABELS[entry.harness]}<span class="block text-[11px] text-muted-foreground">{entry.model || 'Modelo sin desglosar'}</span></span>
                  <span class="shrink-0 tabular-nums">{exactTokens(entry.tokens.totalTokens)}</span>
                </div>
              )}</For>
            </div>
            <div class="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-border pt-2 tabular-nums">
              <For each={[
                ['Entrada', usage()?.tokens.inputTokens],
                ['Salida', usage()?.tokens.outputTokens],
                ['Caché leída', usage()?.tokens.cachedInputTokens],
                ['Caché escrita', usage()?.tokens.cacheWriteInputTokens],
                ['Razonamiento', usage()?.tokens.reasoningOutputTokens],
              ] as const}>{([label, value]) => <Show when={value !== undefined}><span class="text-muted-foreground">{t(label)}</span><span class="text-right">{exactTokens(value!)}</span></Show>}</For>
            </div>
            <p class="mt-2 text-[11px] text-muted-foreground">Registro desde {new Date(usage()!.trackedSince).toLocaleDateString('es-AR')}. Puede incluir historial recuperado de sesiones. Cobertura parcial; no indica saldo de la suscripción ni costo. Caché y razonamiento son desgloses del proveedor.</p>
          </Show>
        </TooltipContent>
      </TooltipPortal>
    </Tooltip>
  );
}
