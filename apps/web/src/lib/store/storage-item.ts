/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import type { Store } from './store';

export class StorageItem<T> {
	private _key: string;
	private _value: T | undefined;
	private _store: Store;

	public loaded = false;

	public constructor(store: Store, key: string, value: T | Promise<T>) {
		this._store = store;
		this._key = key;
		this.initValue(value);
	}

	public get key(): string {
		return this._key;
	}

	public get value(): T {
		return this._value!;
	}

	public set value(newValue: T) {
		this._value = newValue;
		this._store.set(this._key, newValue);
	}

	private async initValue(value: T | Promise<T>) {
		if (value instanceof Promise) {
			this._value = await value;
		} else {
			this._value = value;
		}
		this.loaded = true;
	}
}
