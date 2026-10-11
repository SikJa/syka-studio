/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { formatLogEntry } from './logs';
import { ISSUE_LOG_TAIL } from '@diffusionstudio/dapi';
import type { MainHandler } from '../handler';
export const report: MainHandler<'report'> = async (args, ctx) => {
  const directory = join(process.env.SYKA_RUNTIME_ROOT || process.cwd(), 'reports');
  await mkdir(directory, {recursive: true});
  const path = join(directory, `syka-report-${randomUUID()}.md`);
  const logs = (args.logs ?? ISSUE_LOG_TAIL) === 0 ? [] : ctx.logs().slice(-(args.logs ?? ISSUE_LOG_TAIL)).map(formatLogEntry);
  await writeFile(path, ['# ' + args.title, 'App: ' + ctx.version, args.body || '', 'Commands:', ...(args.commands || []), 'Logs:', ...logs].join('\n\n'), {flag:'wx'});
  return {url:path};
};
