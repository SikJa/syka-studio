/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { DashboardPermissionsSection } from "./permissions";
import { toast } from "somoto";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { pickProjectsRoot, projectsRoot } from "@/projects";
import { openSettings } from '@/components/settings/state';
import { UpdateSettings } from './update-menu';
import { For } from 'solid-js';
import { locale, setLocale, t, type Locale } from '@/i18n';

import {
  DashboardInfoActionRow,
  DashboardScrollView,
  DashboardSurfaceSection,
} from "./shared";

export function DashboardProjectsFolderSection() {
  const handleChange = async () => {
    try {
      await pickProjectsRoot();
    } catch (e) {
      toast.error("No se pudo elegir la carpeta", { description: (e as Error).message });
    }
  };

  return (
    <DashboardSurfaceSection title="Carpeta de proyectos">
      <DashboardInfoActionRow
        title="Guardar proyectos en"
        leading={<Icon name="navigation.folder" class="text-foreground" />}
        description={projectsRoot() ?? "Sin carpeta seleccionada"}
        action={
          <Button variant="secondary" onClick={handleChange}>
            Cambiar…
          </Button>
        }
      />
    </DashboardSurfaceSection>
  );
}

export function DashboardSettingsView() {
  return (
    <DashboardScrollView>
      <DashboardProjectsFolderSection />
      <DashboardSurfaceSection title={t('Idioma de la interfaz')} description={t('El idioma cambia los controles del editor. No modifica tus proyectos ni los mensajes del chat.')}>
        <div class="flex flex-wrap gap-2" role="group" aria-label={t('Idioma')}>
          <For each={[['es', 'Español'], ['en', 'English'], ['pt-BR', 'Português (Brasil)']] as const}>{([code, label]) =>
            <Button variant={locale() === code ? 'default' : 'secondary'} aria-pressed={locale() === code} onClick={() => {
              try { setLocale(code as Locale); } catch { toast.error(t('No se pudo guardar la preferencia.')); }
            }}>{label}</Button>
          }</For>
        </div>
      </DashboardSurfaceSection>
      <DashboardSurfaceSection title="Actualizaciones de Syka"><UpdateSettings /></DashboardSurfaceSection>
      <DashboardSurfaceSection title="Accesos rápidos" description="Los ajustes que más usás, a mano.">
        <div class="syka-storage-actions justify-start"><Button variant="secondary" onClick={() => openSettings('storage')}>Almacenamiento</Button><Button variant="secondary" onClick={() => openSettings('shortcuts')}>Atajos</Button><Button variant="secondary" onClick={() => openSettings('tools')}>Grabaciones y herramientas</Button></div>
        <p class="text-xxs text-muted-foreground">Ctrl / ⌘ + , abre configuración. Ctrl / ⌘ + Shift + , abre almacenamiento. F1 muestra los atajos.</p>
      </DashboardSurfaceSection>
      <DashboardPermissionsSection />
    </DashboardScrollView>
  );
}
