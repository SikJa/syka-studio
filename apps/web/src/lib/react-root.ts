/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { createRoot as createReactRoot, type Root } from 'react-dom/client';
import { locale } from '@/i18n';

export type { Root } from 'react-dom/client';

/** Subscribe the calling Solid effect without replacing the mounted React tree. */
export function createRoot(...args: Parameters<typeof createReactRoot>): Root {
  const root = createReactRoot(...args);
  const render = root.render.bind(root);
  root.render = node => {
    locale();
    render(node);
  };
  return root;
}
