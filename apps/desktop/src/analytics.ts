/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export type AnalyticsEventData = Record<string, string | number | boolean>;

/** Packaged builds also stay local; no install or event telemetry is sent. */
export async function trackEvent(_name: string, _data: AnalyticsEventData = {}): Promise<void> {}
export async function trackInstall(): Promise<void> {}
