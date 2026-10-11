/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { onCleanup, onMount, createSignal } from "solid-js";
import { MAIN_CHANNELS } from '@desktop/main-channels';
import { mainBridge } from '@/lib/ipc';
import type { StudioPermission } from '@desktop/syka-permission-types';

export type PermissionState = "granted" | "denied" | "prompt" | "unsupported";

export function usePermissionState(name: string) {
  const [state, setState] = createSignal<PermissionState>("prompt");
  let status: PermissionStatus | null = null;
  const handleChange = () => {
    if (status) setState(status.state as PermissionState);
  };
  const nativeId = ({ 'local-fonts': 'fonts', 'clipboard-read': 'clipboard', microphone: 'microphone', notifications: 'notifications' } as Record<string, StudioPermission>)[name];
  const refreshNative = async () => {
    try { const settings = await mainBridge.call(MAIN_CHANNELS.SYKA_PERMISSIONS, { action: 'get' }); setState(settings[nativeId] ? 'granted' : 'denied'); }
    catch { setState('unsupported'); }
  };

  onMount(async () => {
    if (window.desktop && nativeId) {
      window.addEventListener('focus', refreshNative);
      window.addEventListener('syka:permissions-changed', refreshNative);
      await refreshNative();
      return;
    }
    if (!navigator.permissions?.query) {
      setState("unsupported");
      return;
    }
    try {
      status = await navigator.permissions.query({ name: name as PermissionName });
      setState(status.state as PermissionState);
      status.addEventListener("change", handleChange);
    } catch {
      setState("unsupported");
    }
  });

  onCleanup(() => {
    window.removeEventListener('focus', refreshNative);
    window.removeEventListener('syka:permissions-changed', refreshNative);
    status?.removeEventListener("change", handleChange);
  });

  return state;
}
