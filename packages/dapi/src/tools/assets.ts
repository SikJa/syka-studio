/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
import { z } from 'zod';
import { defineTool } from '../tool';
export const assets = defineTool({
  name: 'assets', title: 'Project assets',
  description: 'List the open project asset library, import a local file or direct media URL, rename/move an asset within the library, or create a library folder. Local import links originals by default; copy:true stores independent project bytes without changing the original. Use copy:true for logos/shared library files needed in a portable project. Use the returned path/id in JSX src.',
  input: z.object({ action: z.enum(['list', 'import', 'rename', 'folder']), source: z.string().optional(), path: z.string().optional(), folder: z.string().optional(), name: z.string().optional(), copy: z.boolean().optional() }),
  output: z.object({ assets: z.array(z.object({ id: z.string(), path: z.string(), source: z.string(), type: z.string(), mimeType: z.string() })), folders: z.array(z.string()), failures: z.array(z.object({ source: z.string(), message: z.string() })) }),
  environment: 'renderer',
});
