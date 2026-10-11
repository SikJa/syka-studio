/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { useLocation, useParams } from "@solidjs/router";
import { createMemo } from 'solid-js';

/**
 * Route for the editor with the project `id` loaded (see `/projects/*ref` in
 * app.tsx). The id, not the folder name: a project keeps it when it is
 * renamed, so the link keeps working (and so does the restored last route).
 */
export const projectRoute = (id: string): string => `/projects/${encodeURIComponent(id)}`;

/** Route state of the editor: where leaving it goes back to. */
export type ProjectRouteState = { returnTo?: string };

/**
 * State for a navigation into the editor from the current page, so that
 * leaving the editor lands back here (the dashboard view it was opened from).
 */
export function useReturnHere() {
  const location = useLocation();
  return (): ProjectRouteState => ({ returnTo: location.pathname + location.search });
}

/**
 * The `/projects/*ref` segment: a project id, or a folder name for links made
 * before ids existed. `resolveProject` in @/projects decides which it is; the
 * editor then rewrites the URL to the id it finds.
 */
export function useProjectRef() {
  const params = useParams<{ ref?: string }>();
  return createMemo(() => params.ref ?? '');
}
