/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

type AnalyticsData = Record<string, string | number | boolean | undefined>;

/** Syka local does not load telemetry scripts or forward product events. */
export function initAnalytics(): void {}
export function track(_event: string, _data?: AnalyticsData): void {}
export function identify(_userId: string, _traits?: AnalyticsData): void {}
export function resetIdentity(): void {}
