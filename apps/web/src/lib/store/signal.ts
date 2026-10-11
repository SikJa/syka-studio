/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { createSignal } from 'solid-js';

import type { StorageItem } from '@/lib/store';

export function createStoredSignal<S>(storageItem: StorageItem<S>) {
  const [value, setValue] = createSignal<S>(storageItem.value);

  const updateValue = (newValue: S) => {
    if (newValue === value()) return;

    setValue(() => newValue);
    storageItem.value = newValue;
  };

  return [value, updateValue] as const;
}
