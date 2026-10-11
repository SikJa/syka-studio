/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { DashboardScrollView, DashboardSurfaceSection } from './shared';
import { useLocation } from '@solidjs/router';
import { Show } from 'solid-js';
import { Button } from '@/components/ui/button';
import { closeSettings } from '@/components/settings/state';
import { requestEditorTour } from '@/components/onboarding/editor-tour-model';

export function DashboardHelpView() {
  const location = useLocation();
  return (
    <DashboardScrollView>
      <DashboardSurfaceSection title="Syka Studio">
        <p class="text-xs text-muted-foreground">
          Un editor de video local con timeline, biblioteca, composiciones editables y exportación. Conectá tu asistente desde Modelos e IA para trabajar con el agente.
        </p>
      </DashboardSurfaceSection>
      <DashboardSurfaceSection title="Comunidad de Syka">
        <p class="text-xs text-muted-foreground">Compartí tus trabajos, consultá dudas y encontrá recursos con la comunidad.</p>
        <a href="https://discord.gg/Sy5dtySQG9" target="_blank" rel="noreferrer" class="text-xs text-primary hover:underline">Abrir Discord de Syka ↗</a>
      </DashboardSurfaceSection>
      <DashboardSurfaceSection title="Conocé el editor">
        <p class="text-xs text-muted-foreground">Un recorrido breve por el chat, la previsualización, las correcciones, la timeline y la biblioteca. Podés cerrarlo cuando quieras.</p>
        <Show when={location.pathname.startsWith('/projects/')} fallback={<p class="text-xs text-muted-foreground">Abrí un proyecto y entrá en Menú → Ayuda → Recorrer el editor.</p>}>
          <Button variant="secondary" onClick={() => { closeSettings(); setTimeout(requestEditorTour, 180); }}>Recorrer el editor</Button>
        </Show>
      </DashboardSurfaceSection>
      <DashboardSurfaceSection title="Código abierto y licencias">
        <p class="text-xs text-foreground">Syka Studio, creado por Sikora (SikJa). Basado en Diffusion Studio.</p>
        <p class="text-xs text-muted-foreground">
          Syka se basa en Diffusion Studio. El código original y sus modificaciones conservan la licencia MPL 2.0; las dependencias mantienen sus propias licencias.
        </p>
        <a href="https://github.com/diffusionstudio/editor" target="_blank" rel="noreferrer" class="text-xs text-primary hover:underline">Código de Diffusion Studio</a>
        <a href="https://www.mozilla.org/MPL/2.0/" target="_blank" rel="noreferrer" class="text-xs text-primary hover:underline">Mozilla Public License 2.0</a>
        <a href="https://github.com/SikJa/syka-studio" target="_blank" rel="noreferrer" class="text-xs text-primary hover:underline">Código de esta versión de Syka</a>
        <a href="https://github.com/SikJa/syka-studio/blob/main/CREDITS.md" target="_blank" rel="noreferrer" class="text-xs text-primary hover:underline">Créditos y licencias de terceros</a>
      </DashboardSurfaceSection>
    </DashboardScrollView>
  );
}
