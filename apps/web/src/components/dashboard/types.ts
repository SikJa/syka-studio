/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export type DashboardView = "home" | "projects" | "templates" | "account" | "settings" | "glossary" | "mcp" | "preferences" | "help" | "zernio" | "publication";
export type ProjectSortOption = | "last-viewed" | "alphabetical" | "date-created";
export type TemplateSourceOption = "official" | "custom";
export type TemplatePreviewKind = "landscape" | "portrait" | "square";

export type TemplateCard = {
  name: string;
  resolution: string;
  badge: string;
  previewKind: TemplatePreviewKind;
};
