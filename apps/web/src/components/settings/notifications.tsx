import { createSignal, For, Show } from 'solid-js';
import { NOTICE_TITLES } from '../../../../../packages/agent-chat/src/notifications';
import { noticePrefs, updateNoticePrefs, type NoticeKind, type NoticePrefs } from '@/lib/notice-prefs';
import { SettingsGroup, SettingsRow, SettingsSwitch } from './kit';

/** The notices Syka Studio shows, in the order people meet them. */
const KINDS: readonly { kind: NoticeKind; description: string }[] = [
  { kind: 'question', description: 'El agente necesita una decisión tuya para seguir.' },
  { kind: 'complete', description: 'Un proyecto entregado y revisado.' },
  { kind: 'review', description: 'Una versión nueva lista para que la mires.' },
  { kind: 'export', description: 'Un video exportado y guardado.' },
  { kind: 'blocked', description: 'Algo falló o falta un archivo para continuar.' },
  { kind: 'auth', description: 'Una cuenta o clave que hay que volver a conectar.' },
  { kind: 'download', description: 'Un video importado desde un enlace.' },
  { kind: 'analysis', description: 'Un análisis largo de audio, motion o referencias.' },
];

/** Settings › Notificaciones, Syka Code's sections with Syka Studio's desktop notices. */
export function NotificationSettings() {
  const [prefs, setPrefs] = createSignal<NoticePrefs>(noticePrefs());
  const set = (patch: Partial<NoticePrefs>) => setPrefs(updateNoticePrefs(patch));
  return <>
    <SettingsGroup title="Preferencias">
      <SettingsRow title="Notificaciones" description="Avisos en el escritorio cuando un chat termina, pregunta o necesita tu atención.">
        <SettingsSwitch label="Notificaciones" checked={prefs().enabled} onChange={enabled => set({ enabled })} />
      </SettingsRow>
      <SettingsRow title="Solo si estás en otra ventana" description="Mientras usás Syka, los avisos esperan en el chat.">
        <SettingsSwitch label="Solo si estás en otra ventana" checked={prefs().onlyWhenAway} disabled={!prefs().enabled} onChange={onlyWhenAway => set({ onlyWhenAway })} />
      </SettingsRow>
      <SettingsRow title="Sonido" description="Un sonido corto al aparecer un aviso.">
        <SettingsSwitch label="Sonido" checked={prefs().sound} disabled={!prefs().enabled} onChange={sound => set({ sound })} />
      </SettingsRow>
    </SettingsGroup>
    <Show when={prefs().enabled}>
      <SettingsGroup title="Cuándo avisarme">
        <For each={KINDS}>{entry =>
          <SettingsRow title={NOTICE_TITLES[entry.kind]} description={entry.description}>
            <SettingsSwitch label={NOTICE_TITLES[entry.kind]} checked={prefs().kinds[entry.kind] !== false}
              onChange={on => set({ kinds: { ...prefs().kinds, [entry.kind]: on } })} />
          </SettingsRow>}
        </For>
      </SettingsGroup>
    </Show>
  </>;
}
