/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { createTRPCClient, TRPCClientError } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import type { AppRouter } from "@diffusionstudio/api-contract";

/** Fail closed: no auth, billing, signed uploads or AI requests to Diffusion. */
export const trpc = createTRPCClient<AppRouter>({
  links: [() => ({ op }) => observable((observer) => {
    observer.error(TRPCClientError.from(new Error("El servicio externo de Diffusion «" + op.path + "» está desactivado en Syka local.")));
  })],
});
