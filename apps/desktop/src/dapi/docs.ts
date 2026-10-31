/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { readFileSync } from "node:fs";
import { join } from "node:path";

export const INSTRUCTIONS_FILE = "INSTRUCTIONS.md";

const FALLBACK_INSTRUCTIONS =
  "Syka Studio, a local video editor, is running on this machine and you are connected to it. The tools are the whole API; their descriptions are authoritative.";

/**
 * The text every client gets on connect: INSTRUCTIONS.md from the docs, then
 * where the docs sit on disk. The page names the skills and everything else
 * it wants read — adding one is editing that file, not this one; the paths in
 * it are relative to the docs, and the sentence below is what anchors them.
 */
export function instructions(docsDir: string | null, profile: 'full' | 'progressive' = 'full'): string {
  // The embedded harness already supplies the audiovisual contract and task
  // guidance. Some MCP clients prefix these instructions to EVERY tool; do not
  // multiply the full manual when they discover three unrelated tool schemas.
  // External clients retain the existing complete instructions by default.
  if (profile === 'progressive') {
    return [
      'Syka Studio is a local audiovisual editor. Work in the bound project; preserve originals and unrelated edits. Preview failure never changes the editable-video deliverable. Verify edits with check/capture; before replying on a new or reworked animated piece, run gate on its scene, fix every error and run it again; export is manual. Tool schemas and handlers are unchanged.',
      'Image tools return real local PNG paths. Open relevant images with the native view_image tool to inspect pixels; a file receipt alone is not visual verification. Never print image bytes/base64 as text.',
      docsDir ? `Read-only app documentation: ${JSON.stringify(docsDir)}. INSTRUCTIONS.md and skills/reference pages remain available on demand through syka_read_reference/syka_skills. Load only the relevant procedure; the embedded harness supplies the always-on product contract.` : 'Documentation is unavailable; report the limitation instead of inventing API behavior.',
    ].join('\n');
  }
  const text = docsDir ? readText(join(docsDir, INSTRUCTIONS_FILE)) : null;
  const parts = [text?.trim() || FALLBACK_INSTRUCTIONS];
  if (docsDir) {
    parts.push(
      `The docs, including every page named above, are the files at \`${docsDir}\`: the skills, the tool and JSX reference, guides, runnable examples, and reusable code examples (upstream branding is excluded). They belong to the app; read them, never edit them.`,
    );
  }
  return parts.join("\n\n");
}

function readText(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}
