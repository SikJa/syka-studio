/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { createResource, createSignal, Show } from "solid-js";
import { toast } from "somoto";
import { MAIN_CHANNELS } from "@desktop/main-channels";
import { mainBridge } from "@/lib/ipc";
import { Button } from "@/components/ui/button";
import { TextField, TextFieldInput, TextFieldLabel } from "@/components/ui/text-field";
import { DashboardSurfaceSection } from "./shared";
import { OfficialLink, OnboardingDisclosure } from './syka-onboarding-settings';
import GroqLogo from '@/assets/providers/groq.svg';

/** Credentials enter main once; no renderer persistence, readback or API call. */
export function GroqSettings() {
  const [key, setKey] = createSignal("");
  const [saving, setSaving] = createSignal(false);
  const [editing, setEditing] = createSignal(false);
  const [status, { mutate }] = createResource(async () => {
    if (!window.desktop) return null;
    return mainBridge.call(MAIN_CHANNELS.SYKA_GROQ_STATUS, undefined);
  });
  const save = async (clear = false) => {
    setSaving(true);
    try {
      const result = await mainBridge.call(MAIN_CHANNELS.SYKA_GROQ_SET_KEY, { key: clear ? "" : key() });
      setKey("");
      setEditing(false);
      mutate(result);
      toast.success(clear ? "Clave de Groq eliminada" : "Clave de Groq guardada", {
        description: "No se realizó ninguna llamada al proveedor.",
      });
    } catch (error) {
      toast.error("No se pudo configurar Groq", { description: error instanceof Error ? error.message : "Error de configuración." });
    } finally { setSaving(false); }
  };
  return (
    <DashboardSurfaceSection title="Transcripción · Groq">
      <div id="syka-groq-settings" class="syka-onboarding flex flex-col gap-4 text-xs">
        <div class="flex items-center gap-3"><span class="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-muted [&_svg]:size-6" aria-hidden="true"><GroqLogo /></span><div><p class="font-medium text-sm">Groq</p><p class="text-muted-foreground">Audio a texto · con tu propia cuenta</p></div></div>
        <Show when={window.desktop}>
          <div class="rounded-xl border border-border bg-muted/40 p-4" role="status">
            <p class="font-medium">{status.loading ? "Leyendo configuración local…" : status.error ? "No se pudo consultar la configuración local." : status()?.configured ? "Tu clave de Groq ya está guardada" : "Conectá Groq con tu clave"}</p>
            <Show when={status()?.configured}><p class="mt-1 text-muted-foreground">No tenés que volver a pegarla. Syka la usa para transcribir y dictar; la ocultamos para protegerla. El acceso se comprueba al usarla.</p>
              <Button variant="ghost" class="mt-2" disabled={saving()} onClick={() => { setKey(''); setEditing(!editing()); }}>{editing() ? 'Cancelar cambio' : 'Cambiar clave'}</Button>
            </Show>
          </div>
        </Show>
        <p class="text-muted-foreground">Whisper Large V3 Turbo con tu cuenta propia. Solo se envía audio a Groq al pedir una transcripción; el editor funciona sin clave.</p>
        <OfficialLink href="https://console.groq.com/keys">Crear o administrar mi clave de Groq</OfficialLink>
        <OnboardingDisclosure title="Cómo conectar tu cuenta" description="Una clave propia · guardada de forma segura">
          <ol class="list-decimal pl-4 space-y-2">
            <li>Ingresá o creá tu cuenta en <OfficialLink href="https://console.groq.com/keys">Groq Console · API Keys</OfficialLink>.</li>
            <li>Creá una clave y pegala únicamente en el campo protegido de abajo. No la envíes por chat.</li>
            <li>Guardala. Syka la cifra en el host; nunca se devuelve al formulario.</li>
          </ol>
          <p>La próxima transcripción que vos pidas comprobará el acceso real y puede usar cuota de tu cuenta. No enviamos audio ni hacemos pruebas automáticas al guardar.</p>
          <OfficialLink href="https://console.groq.com/docs/quickstart">Guía oficial</OfficialLink>
          <OfficialLink href="https://console.groq.com/docs/speech-to-text">Transcripción y límites vigentes</OfficialLink>
        </OnboardingDisclosure>
        <Show when={window.desktop} fallback={<p>Disponible en la aplicación de escritorio.</p>}>
          <Show when={status() && !status()?.secureStorage}><p class="text-destructive">El almacenamiento seguro del sistema no está disponible. No se guardarán claves.</p></Show>
          <Show when={!status.loading && (!status()?.configured || editing())}><TextField value={key()} onChange={setKey}>
            <TextFieldLabel uiSize="compact">Clave propia de Groq</TextFieldLabel>
            <TextFieldInput type="password" autocomplete="off" placeholder="gsk_…" uiSize="compact" disabled={saving() || !status()?.secureStorage} />
          </TextField></Show>
          <div class="flex items-center gap-2">
            <Show when={!status()?.configured || editing()}><Button variant="secondary" disabled={saving() || !key().trim() || !status()?.secureStorage} onClick={() => void save()}>Guardar clave</Button></Show>
            <Show when={status()?.configured}><Button variant="ghost" disabled={saving()} onClick={() => void save(true)}>Eliminar clave</Button></Show>
          </div>
          <p class="text-muted-foreground">La clave se cifra con el almacenamiento seguro de Windows. Guardarla no valida el acceso ni consume cuota.</p>
        </Show>
      </div>
    </DashboardSurfaceSection>
  );
}
