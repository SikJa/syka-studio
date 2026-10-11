/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Stages the docs into apps/desktop/docs so electron-forge can ship them as
// an app resource (Contents/Resources/docs). The app's MCP server sends
// INSTRUCTIONS.md on connect along with this folder's path; agents read the
// rest as plain files. The tree is copied as it is in the repo, because the
// relative links between the pages assume that layout.

import { cpSync, copyFileSync, existsSync, lstatSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { bundledSkills } from '../../../scripts/bundled-skills.mjs';
import { checkSoundCatalog } from '../../../scripts/check-sound-catalog.mjs';
import { assertStagingDirectory } from '../../../scripts/lib/staging-path.mjs';
import { execFileSync } from 'node:child_process';

const desktopDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(desktopDir, "..", "..");
const stageDir = resolve(desktopDir, 'docs');

// Never ship local QA reports, machine-specific audits or personal brand assets.
// Public attributed SVG catalogs are explicitly included under resources.
// Relative support links remain intact inside these public documentation trees.
export const publicEntries = ['INSTRUCTIONS.md', 'SKILLS_INCLUDED.md', 'SERVICE_MAP_SYKA.md', 'THIRD_PARTY_NOTICES_HYPERFRAMES.md', 'licenses', 'reference', 'skills', 'guides', 'examples', 'resources'];
assertStagingDirectory(desktopDir, stageDir, 'docs');

await bundledSkills(join(repoRoot,'docs'));
await checkSoundCatalog(join(repoRoot, 'docs'));
rmSync(stageDir, { recursive: true, force: true });
mkdirSync(stageDir, { recursive: true });
for (const entry of publicEntries) cpSync(join(repoRoot, 'docs', entry), join(stageDir, entry), {
  recursive: true,
  filter: path => !lstatSync(path).isSymbolicLink() && !path.endsWith('.DS_Store') && !path.endsWith('.gitkeep'),
});
for (const name of ['LICENSE', 'CREDITS.md', 'LICENSE_POLICY.md']) {
  if (!existsSync(join(repoRoot, name))) throw Error(`Missing publication notice: ${name}`);
  copyFileSync(join(repoRoot, name), join(stageDir, name));
}
execFileSync(process.execPath, [join(desktopDir, 'scripts/stage-licenses.mjs')], { stdio: 'inherit', windowsHide: true });

const inventory=await bundledSkills(stageDir);
const sounds=await checkSoundCatalog(stageDir);
console.log(`stage-docs: staged ${inventory.count} bundled skills and the public docs at ${stageDir}`);
console.log(`stage-docs: verified ${sounds.count} sounds (${sounds.mebibytes} MiB), hashes and licenses`);
