import { For } from 'solid-js';
import { DashboardScrollView, DashboardSurfaceSection } from '@/components/dashboard/shared';
import { EDITOR_SHORTCUTS, platformShortcut } from '@/components/canvas/editor-shortcut-list';
import { t } from '@/i18n';
export function ShortcutsSettings() {
  return <DashboardScrollView>
    <DashboardSurfaceSection title="Accesos de Syka" description="Disponibles tanto en el inicio como en el editor.">
      <For each={[[ 'Ctrl + ,', 'Abrir configuración' ], [ 'Ctrl + Shift + ,', 'Abrir almacenamiento' ], [ 'F1', 'Consultar los atajos' ]]}>{([key, label]) => <div class="syka-settings-row"><span>{t(label)}</span><kbd>{platformShortcut(key)}</kbd></div>}</For>
    </DashboardSurfaceSection>
    <DashboardSurfaceSection title="Editar y revisar" description="Los atajos del video se usan cuando el foco está en el editor. Mientras escribís en el chat, tus teclas siguen escribiendo.">
      <For each={EDITOR_SHORTCUTS}>{([key, label]) => <div class="syka-settings-row"><span>{t(label)}</span><kbd>{platformShortcut(key)}</kbd></div>}</For>
    </DashboardSurfaceSection>
  </DashboardScrollView>;
}
