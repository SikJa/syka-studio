/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

export type UpdatePhase = 'disabled' | 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error';
export type UpdateState = {
  phase: UpdatePhase;
  currentVersion: string;
  availableVersion?: string;
  releaseUrl?: string;
  checkedAt?: string;
  message?: string;
};
export type UpdateRequest = { action: 'status' | 'check' | 'download' | 'install' | 'notes'; locale?: 'es' | 'en' | 'pt-BR' };
