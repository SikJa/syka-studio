import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

/** Local non-secret login generation, separate from the CLI's credential store. */
export async function profileScope(profileDir: string): Promise<string> {
  let generation = "initial";
  try { generation = await readFile(join(profileDir, "syka-login-generation"), "utf8"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  return createHash("sha256").update(resolve(profileDir)).update("\0").update(generation).digest("hex");
}
export async function advanceProfileScope(profileDir: string): Promise<void> {
  await writeFile(join(profileDir, "syka-login-generation"), randomUUID(), "utf8");
}
