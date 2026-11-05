/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

export type UpdatePhase = 'disabled' | 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error';
export type UpdateState = {
  phase: UpdatePhase;
  currentVersion: string;
  installation?: 'squirrel' | 'installer';
  availableVersion?: string;
  releaseUrl?: string;
  checkedAt?: string;
  message?: string;
  simulation?: 'preview' | 'complete';
  /** Download progress, 0–1, while an installer downloads. */
  progress?: number;
};
export type UpdateRequest = { action: 'status' | 'check' | 'download' | 'install' | 'notes' | 'demo-reset'; locale?: 'es' | 'en' | 'pt-BR' };
