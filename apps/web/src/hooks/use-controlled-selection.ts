/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { createSignal, type Accessor } from "solid-js";

type ControlledSelectionOptions<Item, Value> = {
  value?: Accessor<Value | undefined>;
  defaultValue: Value;
  getValue: (item: Item) => Value;
  onChange?: (item: Item) => void;
};

export function useControlledSelection<Item, Value>(
  options: ControlledSelectionOptions<Item, Value>,
) {
  const [internalValue, setInternalValue] = createSignal<Value>(options.defaultValue);
  const selectedValue = () => options.value?.() ?? internalValue();

  const select = (item: Item) => {
    if (!options.value) {
      setInternalValue(() => options.getValue(item));
    }
    options.onChange?.(item);
  };

  return [selectedValue, select] as const;
}
