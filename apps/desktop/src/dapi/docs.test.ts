/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { instructions } from "./docs";

// The docs in miniature, laid out like the repo's `docs/`.
const root = mkdtempSync(join(tmpdir(), "dapi-docs-"));
const docsDir = join(root, "docs");
const repoDocs = join(__dirname, "..", "..", "..", "..", "docs");

beforeAll(() => {
  mkdirSync(join(docsDir, "skills"), { recursive: true });
  writeFileSync(join(docsDir, "INSTRUCTIONS.md"), "Diffusion Studio is running.\n\nRead `skills/editor.md`.\n");
  writeFileSync(join(docsDir, "skills", "editor.md"), "# Editing\n\nHow to edit.\n");
  writeFileSync(join(docsDir, "skills", "watch.md"), "# Watching\n\nHow to watch.\n");
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("instructions", () => {
  it("is INSTRUCTIONS.md verbatim, followed by where the docs sit on disk", () => {
    const text = instructions(docsDir);
    expect(text.startsWith("Diffusion Studio is running.\n\nRead `skills/editor.md`.")).toBe(true);
    expect(text).toContain(`The docs, including every page named above, are the files at \`${docsDir}\``);
  });

  it("falls back to a one-liner when nothing is staged", () => {
    const text = instructions(null);
    expect(text).toContain("The tools are the whole API");
    expect(text).not.toContain("skills/editor.md");
  });

  it("builds from the repo's own docs without broken instructions", () => {
    if (!existsSync(repoDocs)) return;
    const text = instructions(repoDocs);
    expect(text).toContain(repoDocs);
    expect(text).not.toContain("dapi://");
    expect(text).not.toContain("\\`");
  });
});

describe("the repo's INSTRUCTIONS.md", () => {
  it("names the skills, and every page it names exists", () => {
    if (!existsSync(repoDocs)) return;
    const text = readFileSync(join(repoDocs, "INSTRUCTIONS.md"), "utf8");
    const pages = [...text.matchAll(/`((?:skills|reference|guides|examples|brand)\/[^`]*?\.(?:md|tsx?))`/g)].map((m) => m[1]);
    expect(pages).toContain("skills/editor.md");
    expect(pages).toContain("skills/watch.md");
    for (const page of pages) expect(existsSync(join(repoDocs, ...page.split("/")))).toBe(true);
  });
});
