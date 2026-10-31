/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { StorageItem } from './storage-item';

export type Deserializer<T> = (data: any) => Promise<T> | T;

export class Store {
	public readonly storageEngine: Storage;
	public readonly namespace?: string;

	public constructor(namespace?: string, storageEngine = localStorage) {
		this.storageEngine = storageEngine;
		this.namespace = namespace;
	}

	public define<T>(key: string, defaultValue: T, deserializer?: Deserializer<T>): StorageItem<T> {
		const storedValue = this.get<T>(key);

		if (storedValue === null) {
			this.set(key, defaultValue);
			return new StorageItem<T>(this, key, defaultValue);
		}
		if (deserializer && storedValue != undefined) {
			return new StorageItem<T>(this, key, deserializer(storedValue));
		}

		return new StorageItem<T>(this, key, storedValue);
	}

	public set<T>(key: string, value: T): void {
		const id = this.getStorageId(key), serialized = JSON.stringify({ value });
		if (this.namespace === 'dspro.ui') window.desktop?.preferences?.setItem(id, serialized);
		this.storageEngine.setItem(
			id, serialized,
		);
	}

	public get<T>(key: string): T | null {
		const id = this.getStorageId(key);
		const durable = this.namespace === 'dspro.ui' ? window.desktop?.preferences : undefined;
		const persisted = durable?.getItem(id);
		const item = persisted ?? this.storageEngine.getItem(id);
		// Import existing choices only when the stable store has no value yet.
		if (persisted == null && item != null) durable?.setItem(id, item);

		if (item) {
			return JSON.parse(item).value as T;
		}

		return null;
	}

	public remove(key: string): void {
		if (this.namespace === 'dspro.ui') window.desktop?.preferences?.removeItem(this.getStorageId(key));
		this.storageEngine.removeItem(this.getStorageId(key));
	}

	private getStorageId(key: string): string {
		if (this.namespace) {
			return `${this.namespace}.${key}`;
		}
		return key;
	}
}
