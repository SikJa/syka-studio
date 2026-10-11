/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { isAbsoluteSource } from "@diffusionstudio/assets";
import { DapiError } from "@diffusionstudio/dapi";

import type { ToolHandler } from "../handler";

// The app has no working directory a relative path could mean anything
// against (the CLI resolves one before calling), so it is refused here
// rather than surfacing as an ENOENT from mkdir.
export const open: ToolHandler<"open"> = ({ dir }, ctx) => {
  if (!isAbsoluteSource(dir)) {
    throw new DapiError("invalid-input", `The project folder must be an absolute path (got "${dir}").`);
  }
  return ctx.app.openProject(dir);
};
