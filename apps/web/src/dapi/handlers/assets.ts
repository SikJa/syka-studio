/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
import { getLibrary } from '@diffusionstudio/runtime';
import { DapiError } from '@diffusionstudio/dapi';
import type { ToolHandler } from '../handler';
export const assets: ToolHandler<'assets'> = async (args, ctx) => {
  const {world} = ctx.requireSession();
  const library = getLibrary(world);
  await library.whenReady();
  const failures: {source: string; message: string}[] = [];
  if (args.action === 'import') {
    if (!args.source) throw new DapiError('invalid-input', 'Import requires source');
    const result = await library.import([args.source], {folder: args.folder, name: args.name, copy: args.copy});
    failures.push(...result.failed.map(f => ({source: f.source, message: f.error.message})));
  } else if (args.action === 'rename') {
    if (!args.source || !args.path) throw new DapiError('invalid-input', 'Rename requires an asset source/id and destination library path');
    const asset = library.get(args.source);
    if (!asset) throw new DapiError('invalid-input', 'Asset not found');
    const target = args.path.replaceAll('\\', '/');
    const split = target.lastIndexOf('/');
    library.move([asset], split < 0 ? '' : target.slice(0, split));
    library.rename(asset, target.slice(split + 1));
  } else if (args.action === 'folder') {
    if (!args.folder) throw new DapiError('invalid-input', 'Folder requires a library folder path');
    await library.createFolder(args.folder);
  }
  return { assets: library.list().map(a => ({id: a.id, path: a.path, source: a.source, type: a.type, mimeType: a.mimeType})), folders: [...library.folders()], failures };
};
