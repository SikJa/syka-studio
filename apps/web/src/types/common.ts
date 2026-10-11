/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | '3:4';
export type ModelOutput = 'image' | 'video' | 'audio';

export const DataTransferType = {
  ASSET_IDS: 'asset_ids',
  TRANSITION: 'transition',
} as const;

export type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;
