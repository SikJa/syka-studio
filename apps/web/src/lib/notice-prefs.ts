/**
 * Settings › Notificaciones, read by main from the desktop preference
 * `dspro.ui.notifications.v1` before each notice: on/off, only while Syka is
 * behind another window, which kinds, and the sound.
 */
import type { NoticeKind } from '../../../../packages/agent-chat/src/notifications';
export type { NoticeKind };
export type NoticePrefs = { enabled: boolean; onlyWhenAway: boolean; sound: boolean; kinds: Partial<Record<NoticeKind, boolean>> };
export const DEFAULT_NOTICE_PREFS: NoticePrefs = { enabled: true, onlyWhenAway: false, sound: true, kinds: {} };
export const NOTICE_PREFS_KEY = 'dspro.ui.notifications.v1';

function storage(): Pick<Storage, 'getItem' | 'setItem'> | undefined {
  try { return window.desktop?.preferences ?? window.localStorage; } catch { return undefined; }
}

export function noticePrefs(): NoticePrefs {
  try { return { ...DEFAULT_NOTICE_PREFS, ...JSON.parse(storage()?.getItem(NOTICE_PREFS_KEY) ?? '{}') }; }
  catch { return DEFAULT_NOTICE_PREFS; }
}

export function updateNoticePrefs(patch: Partial<NoticePrefs>): NoticePrefs {
  const next = { ...noticePrefs(), ...patch };
  try { storage()?.setItem(NOTICE_PREFS_KEY, JSON.stringify(next)); } catch { /* This session only. */ }
  return next;
}
