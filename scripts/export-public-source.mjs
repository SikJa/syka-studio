/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportPublicSource, inventoryPublicSource, writeAudit } from './lib/public-source.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argumentsList = process.argv.slice(2);
const supported = new Set(['--dry-run', '--write', '--media-approvals']);
if (argumentsList.some((arg, index) => arg.startsWith('--') && !supported.has(arg) && argumentsList[index - 1] !== '--media-approvals') || argumentsList.includes('--dry-run') && argumentsList.includes('--write')) {
  console.error('Use --dry-run (default), or --write after review; optional --media-approvals <local-json-file>.');
  process.exit(2);
}
try {
  let approvedMedia = [];
  const approvalIndex = argumentsList.indexOf('--media-approvals');
  if (approvalIndex !== -1) {
    const approvalFile = resolve(argumentsList[approvalIndex + 1] ?? '');
    if (!argumentsList[approvalIndex + 1] || approvalFile !== resolve(root, '.runtime/release-audit/media-approvals.json')) throw Object.assign(Error('Invalid approval file.'), { code: 'INVALID_APPROVAL_FILE' });
    approvedMedia = JSON.parse(await readFile(approvalFile, 'utf8'));
    if (!Array.isArray(approvedMedia) || approvedMedia.some(item => typeof item.path !== 'string' || !/^[a-f0-9]{64}$/.test(item.sha256))) throw Object.assign(Error('Invalid media approvals.'), { code: 'INVALID_APPROVAL_FILE' });
  }
  const inventory = await inventoryPublicSource(root, { approvedMedia });
  await writeAudit(root, inventory);
  console.log(JSON.stringify({ mode: argumentsList.includes('--write') ? 'write' : 'dry-run', ...inventory.summary, manifestSha256: inventory.manifestSha256, report: '.runtime/release-audit/public-source-report.md' }, null, 2));
  for (const finding of inventory.findings.slice(0, 60)) console.log(finding.path + ':' + finding.line + ' ' + finding.type + ' [' + finding.severity + ']');
  if (inventory.findings.length > 60) console.log('Additional findings are in the local report; matched values are never recorded.');
  if (argumentsList.includes('--write')) console.log(JSON.stringify(await exportPublicSource(root, inventory), null, 2));
  else if (!inventory.summary.ready) process.exitCode = 2;
} catch (error) {
  // Never print exception text: parsing errors may include source/credential excerpts.
  console.error('Public source operation failed: ' + (typeof error.code === 'string' ? error.code : 'AUDIT_ERROR') + '. Existing source and snapshot directories were not deleted.');
  process.exitCode = 1;
}
