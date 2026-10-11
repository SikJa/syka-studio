/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { createMemo, untrack, type Accessor } from 'solid-js';

import { useEngineContext } from '../context';

/**
 * Reactive read of state the systems write without events (the Computed
 * store, anything else written through `store()`), which `useTrait` cannot
 * follow. `read` is sampled once per engine tick (`Engine.frame`, one
 * signal shared by every caller), after the systems ran, and the accessor
 * notifies only when the sample differs from the last one (`===` unless
 * `equals` says otherwise, so return primitives or pass a comparator).
 * Signals `read` touches are not tracked; the tick is the only trigger.
 */
export function useDerived<T>(read: () => T, equals?: (prev: T, next: T) => boolean): Accessor<T> {
	const { frame } = useEngineContext();

	const sample = () => {
		frame();
		return untrack(read);
	};

	// An explicit `equals: undefined` would switch the memo's default
	// comparison off, not leave it alone.
	return equals ? createMemo(sample, undefined, { equals }) : createMemo(sample);
}
