/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import type { Accessor } from 'solid-js';
import { useAuth } from '@/context';

/** The normalized local raster; never fetch an avatar from a provider. */
export function useAvatar(): Accessor<string | null> {
  const auth = useAuth();
  return () => auth.localProfile().avatarDataUrl ?? null;
}
